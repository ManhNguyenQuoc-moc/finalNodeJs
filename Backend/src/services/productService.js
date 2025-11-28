// src/services/productService.js
const productRepo = require("../repositories/productRepository");
const BrandService = require("./BrandService");
const CategoryService = require("./CategoryService");
const ColorService = require("./ColorService");
const SizeService = require("./SizeService");

const { uploadFiles, deleteFiles } = require("../utils/fileHandler");
const { handleTransaction } = require("../utils/transaction");

const { toAddProductResponse } = require("../mappers/product/output/AddProductResponseMapper");
const AddProductRequestMapper = require("../mappers/product/input/AddProductRequestMapper");

// -------------------- CREATE PRODUCT --------------------
async function createProduct(dto) {
  return handleTransaction(async (session) => {
    console.log("Creating product with DTO:", dto);

    // Upload images trước
    const uploadedProductImages = await uploadFiles(dto.productImages, "products", "Product");

    const uploadedVariantImagesMap = [];
    for (const variant of dto.variants || []) {
      const uploaded = await uploadFiles(variant.uploadedFiles, "variants", `Variant ${variant.sku}`);
      uploadedVariantImagesMap.push(uploaded);
    }

    // Validate brand & category
    const brand = await BrandService.getBrandById(dto.brand);
    if (!brand) throw new Error("Brand not found");

    const category = await CategoryService.getCategoryById(dto.category);
    if (!category) throw new Error("Category not found");

    // Check slug unique
    const existing = await productRepo.findOne({ slug: dto.slug });
    if (existing) throw new Error("Product already exists with this slug");
    if (Array.isArray(dto.variants) && dto.variants.length) {
      const combos = new Set();
      for (const v of dto.variants) {
        const key = `${String(v.color)}__${String(v.size)}`;
        if (combos.has(key)) {
          throw new Error(`Duplicate variant color/size combination: color=${v.color}, size=${v.size}`);
        }
        combos.add(key);
      }
    }
    // Map DTO → Product entity
    const productEntity = AddProductRequestMapper.toProductEntity(dto, uploadedProductImages);

    // Save Product với session
    const createdProduct = await productRepo.createProduct(productEntity, session);

    // Map DTO → Variant entities
    const variantEntities = AddProductRequestMapper.toVariantEntities(
      dto.variants,
      uploadedVariantImagesMap,
      createdProduct._id
    );

    // 7️Save Variants, validate color & size
    const savedVariants = [];
    for (const variantEntity of variantEntities) {
      const color = await ColorService.getColorById(variantEntity.color);
      if (!color) throw new Error(`Color not found: ${variantEntity.color}`);

      const size = await SizeService.getSizeById(variantEntity.size);
      if (!size) throw new Error(`Size not found: ${variantEntity.size}`);

      console.log("Variant ready to save:", variantEntity);
      const savedVariant = await productRepo.createVariant(variantEntity, session);
      savedVariants.push(savedVariant);
    }

    console.log("Created product:", createdProduct);
    console.log("With variants:", savedVariants);

    // 8️ Response DTO
    return toAddProductResponse(createdProduct, savedVariants);
  });
}

// -------------------- ADD VARIANT --------------------
async function addVariant(productId, dto) {
  return handleTransaction(async (session) => {
    const product = await productRepo.findById(productId);
    if (!product) throw new Error("Product not found");
    console.log(dto);
    const uploadedVariantImages = await uploadFiles(dto.uploadedFiles, "variants", `Variant ${dto.sku}`);

    const color = await ColorService.getColorById(dto.color);
    if (!color) throw new Error(`Color not found: ${dto.color}`);

    const size = await SizeService.getSizeById(dto.size);
    if (!size) throw new Error(`Size not found: ${dto.size}`);

    const variantEntity = {
      product: product._id,
      color: dto.color,
      size: dto.size,
      sku: dto.sku,
      price: dto.price,
      stock_quantity: dto.stock_quantity,
      images: uploadedVariantImages,
    };

    return await productRepo.createVariant(variantEntity, session);
  });
}

async function updateProduct(productId, dto) {
  return handleTransaction(async (session) => {
    // 1) Lấy product (nếu repo của bạn đã nhận {session} thì sẽ dùng, nếu chưa vẫn chạy ổn)
    const product = await productRepo.findById(productId, { session });
    if (!product) throw new NotFoundError("Product not found");

    // 2) Ép kiểu và validate cơ bản cho variants
    const toNum = (v) => (v === null || v === undefined ? v : Number(v));
    for (const v of dto.variants || []) {
      if (v.price !== undefined) v.price = toNum(v.price);
      if (v.stock_quantity !== undefined) v.stock_quantity = toNum(v.stock_quantity);
      if (v.price !== undefined && Number.isNaN(v.price)) {
        throw new ValidationError("Invalid price");
      }
      if (v.stock_quantity !== undefined && Number.isNaN(v.stock_quantity)) {
        throw new ValidationError("Invalid stock_quantity");
      }
    }

    // 3) Kiểm tra brand/category (nếu có)
    let brandId = product.brand && product.brand._id ? product.brand._id : product.brand;
    let categoryId = product.category && product.category._id ? product.category._id : product.category;

    if (dto.brand) {
      const brand = await BrandService.getBrandById(dto.brand, { session });
      if (!brand) throw new NotFoundError("Brand not found");
      brandId = dto.brand;
    }
    if (dto.category) {
      const category = await CategoryService.getCategoryById(dto.category, { session });
      if (!category) throw new NotFoundError("Category not found");
      categoryId = dto.category;
    }

    // 4) Update trường text cơ bản trên biến local (chưa ghi DB)
    let name = product.name;
    let slug = product.slug;
    let short_description = product.short_description;
    let long_description = product.long_description;
    let statusName = product.productStatus?.statusName || "New";
    if (dto.name) name = dto.name;
    if (dto.slug) {
      slug = await productRepo.normalizeAndEnsureUniqueSlug(dto.slug, productId, { session });
    }
    if (dto.short_description) short_description = dto.short_description;
    if (dto.long_description) long_description = dto.long_description;
    if (dto.statusName) {
      statusName = dto.statusName;
    } else if (dto.productStatus && dto.productStatus.statusName) {
      statusName = dto.productStatus.statusName;
    }
    // 5) ẢNH — upload mới trước, nhưng KHÔNG xóa cũ ngay (đánh dấu để xoá post-commit)
    const productImagesToDelete = Array.isArray(dto.imagesToDelete) ? dto.imagesToDelete : [];

    const uploadedToCleanup = []; // nếu transaction fail sẽ xoá những cái vừa upload

    const uploadedProductImages = await uploadFiles(dto.newProductImages || [], "products", "Product")
      .then((res) => {
        uploadedToCleanup.push(...res.map((x) => x.public_id));
        return res;
      });

    const uploadedVariantsMap = [];
    for (const variantDto of dto.variants || []) {
      const filesForVariant =
        variantDto.newImages ||
        variantDto.files ||
        variantDto.uploadedFiles ||
        [];

      const res = await uploadFiles(filesForVariant, "variants", `Variant ${variantDto.sku || ""}`)
        .then(r => { uploadedToCleanup.push(...r.map(x => x.public_id)); return r; });

      uploadedVariantsMap.push(res);
    }
    // 6) Tính mảng images mới cho PRODUCT (lọc xoá + merge dedupe)
    const currentImages = Array.isArray(product.images) ? product.images : [];
    let nextProductImages = currentImages;

    if (productImagesToDelete.length) {
      nextProductImages = nextProductImages.filter((img) => !productImagesToDelete.includes(img.public_id));
    }
    if (uploadedProductImages.length) {
      const map = new Map(nextProductImages.map((i) => [i.public_id, i]));
      for (const img of uploadedProductImages) map.set(img.public_id, img);
      nextProductImages = Array.from(map.values());
    }

    // 7) Ghi PRODUCT (payload tường minh, tránh truyền document đã populate)
    const productPayload = {
      name,
      slug,
      short_description,
      long_description,
      brand: brandId,
      category: categoryId,
      images: nextProductImages,
      productStatus: { statusName },
    };

    const updatedProduct = await productRepo.updateProduct(productId, productPayload, session);

    // 8) VARIANTS
    const existingVariants = await productRepo.findVariantsByProduct(updatedProduct._id, session);
    const seen = new Set();
    let createdVariants = [];
    for (let i = 0; i < (dto.variants || []).length; i++) {
      const variantDto = dto.variants[i];
      const uploadedVariantImages = uploadedVariantsMap[i] || [];

      if (variantDto.id) {
        const variant = await productRepo.findVariantById(variantDto.id, { session });
        if (!variant || String(variant.product) !== String(updatedProduct._id)) {
          throw new NotFoundError(`Variant not found: ${variantDto.id}`);
        }

        let colorId = variant.color && variant.color._id ? variant.color._id : variant.color;
        let sizeId = variant.size && variant.size._id ? variant.size._id : variant.size;

        if (variantDto.color) {
          const color = await ColorService.getColorById(variantDto.color, { session });
          if (!color) throw new NotFoundError(`Color not found: ${variantDto.color}`);
          colorId = variantDto.color;
        }
        if (variantDto.size) {
          const size = await SizeService.getSizeById(variantDto.size, { session });
          if (!size) throw new NotFoundError(`Size not found: ${variantDto.size}`);
          sizeId = variantDto.size;
        }

        // ảnh
        const currentVImgs = Array.isArray(variant.images) ? variant.images : [];
        let nextVImgs = currentVImgs;
        if (Array.isArray(variantDto.imagesToDelete) && variantDto.imagesToDelete.length) {
          nextVImgs = nextVImgs.filter(img => !variantDto.imagesToDelete.includes(img.public_id));
        }
        const uploadedVariantImages = uploadedVariantsMap[i] || [];
        if (uploadedVariantImages.length) {
          const vmap = new Map(nextVImgs.map(i => [i.public_id, i]));
          for (const img of uploadedVariantImages) vmap.set(img.public_id, img);
          nextVImgs = Array.from(vmap.values());
        }

        const variantPayload = {
          sku: variantDto.sku ?? variant.sku,
          price: variantDto.price ?? variant.price,
          stock_quantity: variantDto.stock_quantity ?? variant.stock_quantity,
          color: colorId,
          size: sizeId,
          images: nextVImgs,
        };

        console.log("Updating variant", variant._id.toString(), "payload:", {
          price: variantPayload.price,
          stock_quantity: variantPayload.stock_quantity,
          del: variantDto.imagesToDelete,
          add: uploadedVariantImages.map(x => x.public_id),
        });

        await productRepo.updateVariant(variant._id, variantPayload, session);
        seen.add(String(variant._id));
      }
      else {
        // CREATE
        if (variantDto.color) {
          const color = await ColorService.getColorById(variantDto.color, { session });
          if (!color) throw new NotFoundError(`Color not found: ${variantDto.color}`);
        }
        if (variantDto.size) {
          const size = await SizeService.getSizeById(variantDto.size, { session });
          if (!size) throw new NotFoundError(`Size not found: ${variantDto.size}`);
        }

        const newVariant = {
          product: updatedProduct._id,
          sku: variantDto.sku,
          price: variantDto.price,
          stock_quantity: variantDto.stock_quantity,
          color: variantDto.color,
          size: variantDto.size,
          images: uploadedVariantImages,
        };

        const created = await productRepo.createVariant(newVariant, session);
        console.log("Created variant:", created?._id?.toString());
        createdVariants.push(created);
      }
    }
    // 9) Lấy variants mới nhất để trả response
    const variants = await productRepo.findVariantsByProduct(updatedProduct._id, session);

    // 10) Trả về response + dọn ảnh sau commit
    return {
      response: toAddProductResponse(updatedProduct, variants),
      postCommit: async () => {
        // XÓA ẢNH CŨ (product)
        if (productImagesToDelete.length) {
          await deleteFiles(productImagesToDelete);
        }
        // XÓA ẢNH CŨ (variants)
        for (const v of dto.variants || []) {
          if (Array.isArray(v.imagesToDelete) && v.imagesToDelete.length) {
            await deleteFiles(v.imagesToDelete);
          }
        }
      },
      onRollback: async () => {
        // Nếu transaction fail → xoá các ảnh vừa upload để tránh rác
        if (uploadedToCleanup.length) {
          await deleteFiles(uploadedToCleanup);
        }
      },
    };
  });
}
// -------------------- DELETE PRODUCT --------------------
async function deleteProduct(productId) {
  return handleTransaction(async (session) => {
    const product = await productRepo.findById(productId);
    if (!product) throw new Error("Product not found");

    // Xoá product images trên Cloudinary
    await deleteFiles((product.images || []).map(img => img.public_id));

    // Xoá variants + images
    const variants = await productRepo.findVariantsByProduct(product._id);
    for (const variant of variants) {
      await deleteFiles((variant.images || []).map(img => img.public_id));
      await productRepo.deleteVariant(variant._id, session);
    }

    await productRepo.deleteProduct(product._id, session);

    return { success: true, message: "Product deleted successfully" };
  });
}

// -------------------- DELETE VARIANT --------------------
async function deleteVariant(variantId) {
  return handleTransaction(async (session) => {
    const variant = await productRepo.findVariantById(variantId);
    if (!variant) throw new Error("Variant not found");

    await deleteFiles((variant.images || []).map(img => img.public_id));
    await productRepo.deleteVariant(variant._id, session);

    return { success: true, message: "Variant deleted successfully" };
  });
}
async function getAllVariants(page = 1, limit = 50) {
  page = Number(page) || 1;
  limit = Number(limit) || 50;
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ProductVariant.find({})
      .populate("product")
      .populate("color")
      .populate("size")
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductVariant.countDocuments({})
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}
async function getVariantById(id) {
  const variant = await ProductVariant.findById(id)
    .populate("product")
    .populate("color")
    .populate("size")
    .lean();

  if (!variant) throw new Error("Variant not found");
  return variant;
}

async function updateVariantStock(variantId, dto) {
  const toNum = (v) =>
    v === null || v === undefined || v === "" ? undefined : Number(v);

  return handleTransaction(async (session) => {
    const variant = await ProductVariant.findById(variantId).session(session);
    if (!variant) throw new Error("Variant not found");

    const next = {};

    if (dto.price !== undefined) {
      const p = toNum(dto.price);
      if (p !== undefined && Number.isNaN(p)) {
        throw new Error("Invalid price");
      }
      if (p !== undefined) next.price = p;
    }

    if (dto.stock_quantity !== undefined) {
      const sq = toNum(dto.stock_quantity);
      if (sq !== undefined && Number.isNaN(sq)) {
        throw new Error("Invalid stock_quantity");
      }
      if (sq !== undefined) next.stock_quantity = sq;
    }

    Object.assign(variant, next);

    await variant.save({ session });

    // trả về lean để FE dễ xài
    const fresh = await ProductVariant.findById(variantId)
      .populate("product")
      .populate("color")
      .populate("size")
      .lean()
      .session(session);

    return fresh;
  });
}
// ===== ADD AT BOTTOM OF src/services/productService.js =====
const { ProductVariant } = require("../models");
async function normalizeProductsColors(products) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const ids = products.map(p => p?._id).filter(Boolean);

  // lấy variants theo nhóm product và populate color để đọc tên/code
  const variants = await ProductVariant.find({ product: { $in: ids } })
    .populate("color")
    .lean();

  // map: productId -> (colorId -> {color,color_id,color_code,imageUrls[]})
  const byProduct = new Map();

  for (const v of variants) {
    const pid = String(v.product);
    const colorId = v.color?._id ? String(v.color._id) : "no-color";
    const urls = (v.images || [])
      .map(im => (typeof im === "string" ? im : im?.url))
      .filter(Boolean);

    if (!byProduct.has(pid)) byProduct.set(pid, new Map());
    const byColor = byProduct.get(pid);

    if (!byColor.has(colorId)) {
      byColor.set(colorId, {
        color: v.color?.color_name || "Default",
        color_id: v.color ? { _id: v.color._id, color_name: v.color.color_name } : null,
        color_code: v.color?.color_code || "",
        imageUrls: []
      });
    }

    byColor.get(colorId).imageUrls.push(...urls);
  }

  // chuẩn hoá từng product
  for (const p of products) {
    const key = String(p?._id || "");
    const byColor = byProduct.get(key);

    const fallbackImg =
      (Array.isArray(p?.images) && (p.images[0]?.url || p.images[0])) ||
      "/images/default.png";

    if (byColor && byColor.size) {
      const arr = Array.from(byColor.values()).map(c => ({
        ...c,
        imageUrls: Array.from(new Set(c.imageUrls)).length
          ? Array.from(new Set(c.imageUrls))
          : [fallbackImg],
      }));
      p.colors = arr;
    } else {
      // không có variant ảnh -> 1 màu mặc định để FE vẫn render swatch
      p.colors = [{
        color: "Default",
        color_id: null,
        color_code: "",
        imageUrls: [fallbackImg],
      }];
    }

    // các field “an toàn”
    p.short_description = (p.short_description || p.long_description || "").trim();
    p.avg_rating = Number((p.avg_rating || 0).toFixed(1));
    p.rating_count = p.rating_count || 0;

    // nếu chưa có price ở product -> lấy min price từ variants thuộc product đó
    if (p.price == null) {
      const mine = variants
        .filter(v => String(v.product) === key && typeof v.price === "number")
        .map(v => v.price);
      if (mine.length) p.price = Math.min(...mine);
    }
  }

  return products;
}
async function getAllProducts() {
  const { products, total, page, limit } = await productRepo.findAllWithStats();
  console.log(products);
  return {
    products,
    total,
    page,
    limit,
  };
}

// BY ID
async function getProductById(id) {
  const result = await productRepo.findOneWithVariantsAndStats(id);
  if (!result) throw new Error("Product not found");
  return result;
}


module.exports = {
  createProduct,
  addVariant,
  deleteProduct,
  deleteVariant,
  updateProduct,
  getProductById,
  getAllProducts,
  normalizeProductsColors,
  getAllVariants,
  getVariantById,
  updateVariantStock,
};
