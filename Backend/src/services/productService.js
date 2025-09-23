const mongoose = require("mongoose");
const fs = require("fs").promises;
const { uploadToCloudinary } = require("../utils/cloudinary");
const productRepo = require("../repositories/ProductRepository");
const {ProductCreateOutputDTO} = require("../DTO/product/input/AddProductRequest");
const Brand = require("../BrandService");
const Color = require("../ColorService");
const Size = require("../ColorService");
const Category = require("../CategoryService");

// -------------------- HELPER --------------------
async function safeUnlink(file) {
  if (file?.path) await fs.unlink(file.path).catch(() => {});
}

async function requireImages(images, folder, context = "unknown") {
  if (!images || images.length === 0) throw new Error(`${context} is missing images`);

  const filesToDelete = images.filter(f => f.path);

  try {
    const uploaded = await uploadToCloudinary(images, folder);

    // Xóa file local ngay sau khi upload thành công
    for (const file of filesToDelete) await safeUnlink(file);

    return uploaded;
  } catch (err) {
    // Đảm bảo xóa file local nếu upload lỗi
    for (const file of filesToDelete) await safeUnlink(file);
    throw err;
  }
}

// async function getOrCreateColor(color_name, color_code, session) {
//   let color = await productRepo.findColorByName(color_name);
//   if (!color) color = await productRepo.createColor({ color_name, color_code }, session);
//   return color;
// }

// async function getOrCreateSize(size_name, size_order, session) {
//   let size = await productRepo.findSizeByName(size_name);
//   if (!size) size = await productRepo.createSize({ size_name, size_order }, session);
//   return size;
// }

// -------------------- HANDLE TRANSACTION --------------------
async function handleTransaction(dto, taskFn) {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Lưu tất cả file local để xóa khi bất kỳ lỗi nào xảy ra
  const filesToDelete = [
    ...(dto.productImages || []).filter(f => f.path),
    ...((dto.variants || []).flatMap(v => (v.uploadedFiles || []).filter(f => f.path))),
  ];

  try {
    const result = await taskFn(session);
    await session.commitTransaction();
    session.endSession();

    // Xóa file local còn lại (nếu chưa xóa)
    for (const file of filesToDelete) await safeUnlink(file);
    return result;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Xóa file local khi lỗi
    for (const file of filesToDelete) await safeUnlink(file);
    throw err;
  }
}

// -------------------- CREATE PRODUCT --------------------
async function createProduct(dto) {
  // dto {
  //   this.name = body.name;
  //   this.slug = body.slug;
  //   this.brand = body.brand;
  //   this.category = body.category;
  //   this.short_description = body.short_description;
  //   this.long_description = body.long_description;
  //   // this.productImages = files.filter(f => f.fieldname === "productImages");
  //   this.productImages[];
  //   this.variant[];
  // }
  
  return handleTransaction(dto, async (session) => {
    // 1. Check brand & category
    const brand = await Brand.getBrandById(dto.brand);
    if (!brand) throw new Error("Brand not found");

    const category = await Category.getCategoryById(dto.category);
    if (!category) throw new Error("Category not found");
    // 2. Check slug unique
    const existingProduct = await productRepo.findOne({ slug: dto.slug });
    if (existingProduct) throw new Error("Product already exists with this slug");
    // Xử lý ảnh sản phẩm và ảnh Variant 
    // 3. Upload product images local
    const productImages = await requireImages(dto.productImages, "products", "Product")
    // Thêm Map DTO sang entity
    // 4. Create product
    const createdProduct = await productRepo.createProduct(
      {
        name: dto.name,
        slug: dto.slug,
        brand: dto.brand,
        category: dto.category,
        short_description: dto.short_description,
        long_description: dto.long_description,
        images: productImages,
      },
      session
    );

    // 5. Create variants
    for (const variantDto of dto.variants || []) {
      await addVariant(createdProduct._id, variantDto, session);
    }

    const savedVariants = await productRepo.findVariantsByProduct(createdProduct._id);
    return new ProductCreateOutputDTO(createdProduct, savedVariants);
  });
}

// -------------------- VARIANT --------------------
async function addVariant(productId, variantDto, sessionOverride = null) {
  const taskFn = async (session) => {
    session = sessionOverride || session;

    const color = await getOrCreateColor(variantDto.color_name, variantDto.color_code, session);
    const size = await getOrCreateSize(variantDto.size_name, variantDto.size_order, session);

    const images = await requireImages(variantDto.uploadedFiles, "variants", `Variant ${variantDto.sku}`);

    return productRepo.createVariant(
      {
        product: productId,
        color: color._id,
        size: size._id,
        sku: variantDto.sku,
        price: variantDto.price,
        stock_quantity: variantDto.stock_quantity,
        images,
      },
      session
    );
  };

  if (sessionOverride) return taskFn(sessionOverride);
  return handleTransaction({ productImages: [], variants: [variantDto] }, taskFn);
}

// -------------------- PRODUCT CRUD --------------------
async function getProductById(productId) {
  const product = await productRepo.findById(productId);
  if (!product) throw new Error("Product not found");
  const variants = await productRepo.findVariantsByProduct(productId);
  return new ProductCreateOutputDTO(product, variants);
}

async function getProducts(filter = {}, options = {}) {
  return productRepo.findAll(filter, options);
}

async function updateProduct(productId, dto) {
  return handleTransaction(async (session) => {
    // 1. Update thông tin cơ bản
    const updatedProduct = await productRepo.updateProduct(
      productId,
      {
        name: dto.name,
        slug: dto.slug,
        brand: dto.brand,
        category: dto.category,
        short_description: dto.short_description,
        long_description: dto.long_description,
      },
      session
    );

    // 2. Xử lý hình ảnh
    let finalImages = [];

    // 2.1 Giữ lại hình cũ
    if (dto.keepImages?.length) {
      finalImages.push(...updatedProduct.images.filter(img => dto.keepImages.includes(img.public_id)));
    }

    // 2.2 Thay thế hình cũ
    if (dto.replaceImages?.length) {
      for (const item of dto.replaceImages) {
        const oldImgIndex = updatedProduct.images.findIndex(img => img.public_id === item.oldId);
        if (oldImgIndex !== -1) {
          await deleteFromCloudinary(item.oldId); // xóa hình cũ trên Cloudinary
          const uploaded = await requireImages([item.file], "products", "Product");
          finalImages.push(uploaded[0]);
        }
      }
    }

    // 2.3 Thêm hình mới
    if (dto.productImages?.length) {
      const uploadedNew = await requireImages(dto.productImages, "products", "Product");
      finalImages.push(...uploadedNew);
    }

    // 2.4 Cập nhật product.images
    updatedProduct.images = finalImages;
    await updatedProduct.save({ session });

    // 3. Trả về DTO
    const variants = await productRepo.findVariantsByProduct(productId);
    return new ProductCreateOutputDTO(updatedProduct, variants);
  });
}


async function deleteProduct(productId) {
  return productRepo.deleteProduct(productId);
}

async function updateVariant(variantId, dto) {
  return productRepo.updateVariant(variantId, dto);
}

async function deleteVariant(variantId) {
  return productRepo.deleteVariant(variantId);
}

// -------------------- UPDATE PRODUCT + VARIANTS --------------------
async function updateProductWithVariants(productId, dto) {
  return handleTransaction(dto, async (session) => {
    const updatedProduct = await productRepo.updateProduct(
      productId,
      {
        name: dto.name,
        slug: dto.slug,
        brand: dto.brand,
        category: dto.category,
        short_description: dto.short_description,
        long_description: dto.long_description,
      },
      session
    );

    if (dto.productImages?.length) {
      updatedProduct.images = await requireImages(dto.productImages, "products", "Product");
      await updatedProduct.save({ session });
    }

    const existingVariants = await productRepo.findVariantsByProduct(productId);
    const existingIds = existingVariants.map(v => v._id.toString());
    const sentIds = dto.variants.map(v => v._id).filter(Boolean);

    for (const variant of dto.variants || []) {
      if (variant._id && existingIds.includes(variant._id)) {
        let updateData = { sku: variant.sku, price: variant.price, stock_quantity: variant.stock_quantity };
        if (variant.color_name) updateData.color = (await getOrCreateColor(variant.color_name, variant.color_code, session))._id;
        if (variant.size_name) updateData.size = (await getOrCreateSize(variant.size_name, variant.size_order, session))._id;
        if (variant.uploadedFiles?.length) updateData.images = await requireImages(variant.uploadedFiles, "variants", `Variant ${variant.sku}`);
        await productRepo.updateVariant(variant._id, updateData, session);
      } else {
        await addVariant(productId, variant, session);
      }
    }

    // Xóa variants không còn trong DTO
    for (const existing of existingVariants) {
      if (!sentIds.includes(existing._id.toString())) {
        await productRepo.deleteVariant(existing._id, session);
      }
    }

    const savedVariants = await productRepo.findVariantsByProduct(productId);
    return new ProductCreateOutputDTO(updatedProduct, savedVariants);
  });
}

module.exports = {
  createProduct,
  getProductById,
  getProducts,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant,
  updateProductWithVariants,
};
