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

    // 1️Upload images trước
    const uploadedProductImages = await uploadFiles(dto.productImages, "products", "Product");

    const uploadedVariantImagesMap = [];
    for (const variant of dto.variants || []) {
      const uploaded = await uploadFiles(variant.uploadedFiles, "variants", `Variant ${variant.sku}`);
      uploadedVariantImagesMap.push(uploaded);
    }

    // 2️Validate brand & category
    const brand = await BrandService.getBrandById(dto.brand);
    if (!brand) throw new Error("Brand not found");

    const category = await CategoryService.getCategoryById(dto.category);
    if (!category) throw new Error("Category not found");

    // 3️Check slug unique
    const existing = await productRepo.findOne({ slug: dto.slug });
    if (existing) throw new Error("Product already exists with this slug");

    // 4️Map DTO → Product entity
    const productEntity = AddProductRequestMapper.toProductEntity(dto, uploadedProductImages);

    // 5️Save Product với session
    const createdProduct = await productRepo.createProduct(productEntity, session);

    // 6️Map DTO → Variant entities
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
// async function updateProduct(productId, dto) {
//   return handleTransaction(async (session) => {
//     // 1️⃣ Lấy product cũ
//     const product = await productRepo.findById(productId);
//     if (!product) throw new Error("Product not found");

//     // 2️⃣ Validate brand & category nếu có thay đổi
//     if (dto.brand) {
//       const brand = await BrandService.getBrandById(dto.brand);
//       if (!brand) throw new Error("Brand not found");
//     }
//     if (dto.category) {
//       const category = await CategoryService.getCategoryById(dto.category);
//       if (!category) throw new Error("Category not found");
//     }

//     // 3️⃣ Upload ảnh product mới
//     const uploadedProductImages = await uploadFiles(dto.productImages || [], "products", "Product");
//     if (uploadedProductImages.length) {
//       // Xoá ảnh cũ được yêu cầu
//       const imagesToDelete = dto.imagesToDelete || [];
//       await deleteFiles(imagesToDelete);
//       product.images = product.images.filter(img => !imagesToDelete.includes(img.public_id));
//       product.images.push(...uploadedProductImages);

//       // Đảm bảo ảnh primary
//       product.images.forEach((img, idx) => img.is_primary = idx === 0);
//     }

//     // 4️⃣ Update thông tin product
//     const productUpdateData = AddProductRequestMapper.toProductEntity(dto, []);
//     Object.assign(product, productUpdateData);
//     const updatedProduct = await product.save({ session });

//     // 5️⃣ Update variants
//     const savedVariants = [];
//     for (let i = 0; i < (dto.variants || []).length; i++) {
//       const v = dto.variants[i];

//       // Nếu variant đã có _id thì update, không có thì create
//       let variantEntity;
//       if (v.id) {
//         const variant = await productRepo.findVariantById(v.id);
//         if (!variant) throw new Error(`Variant not found: ${v.id}`);

//         // Upload ảnh mới
//         const uploadedVariantImages = await uploadFiles(v.uploadedFiles || [], "variants", `Variant ${v.sku}`);
//         const imagesToDelete = v.imagesToDelete || [];
//         await deleteFiles(imagesToDelete);
//         variant.images = variant.images.filter(img => !imagesToDelete.includes(img.public_id));
//         variant.images.push(...uploadedVariantImages);

//         if (uploadedVariantImages.length) {
//           variant.images.forEach((img, idx) => img.is_primary = idx === 0);
//         }

//         // Validate color & size
//         if (v.color) {
//           const color = await ColorService.getColorById(v.color);
//           if (!color) throw new Error(`Color not found: ${v.color}`);
//         }
//         if (v.size) {
//           const size = await SizeService.getSizeById(v.size);
//           if (!size) throw new Error(`Size not found: ${v.size}`);
//         }

//         Object.assign(variant, v);
//         variantEntity = await variant.save({ session });
//       } else {
//         // Create variant mới
//         variantEntity = AddProductRequestMapper.toVariantEntities([v], [[]], updatedProduct._id)[0];

//         // Validate color & size
//         const color = await ColorService.getColorById(variantEntity.color);
//         if (!color) throw new Error(`Color not found: ${variantEntity.color}`);
//         const size = await SizeService.getSizeById(variantEntity.size);
//         if (!size) throw new Error(`Size not found: ${variantEntity.size}`);

//         variantEntity = await productRepo.createVariant(variantEntity, session);
//       }

//       savedVariants.push(variantEntity);
//     }
//     return toAddProductResponse(updatedProduct, savedVariants);
//   });
// }
// async function updateProduct(productId, dto) {
//   return handleTransaction(async (session) => {
//     // 1️⃣ Lấy product
//     const product = await productRepo.findById(productId);
//     if (!product) throw new Error("Product not found");

//     // 2️⃣ Update basic fields
//     if (dto.name) product.name = dto.name;
//     if (dto.slug) product.slug = dto.slug;
//     if (dto.short_description) product.short_description = dto.short_description;
//     if (dto.long_description) product.long_description = dto.long_description;

//     if (dto.brand) {
//       const brand = await BrandService.getBrandById(dto.brand);
//       if (!brand) throw new Error("Brand not found");
//       product.brand = dto.brand;
//     }

//     if (dto.category) {
//       const category = await CategoryService.getCategoryById(dto.category);
//       if (!category) throw new Error("Category not found");
//       product.category = dto.category;
//     }

//     // 3 Handle product images
//     // Xoá ảnh cũ
//     if (dto.imagesToDelete?.length) {
//       await deleteFiles(dto.imagesToDelete);
//       product.images = product.images.filter(
//         (img) => !dto.imagesToDelete.includes(img.public_id)
//       );
//     }

//     // Upload ảnh mới
//     const uploadedProductImages = await uploadFiles(dto.newProductImages || [], "products", "Product");
//     if (uploadedProductImages.length) {
//       product.images = product.images.concat(uploadedProductImages);
//     }

//     // Update product trong DB
//     const updatedProduct = await productRepo.updateProduct(productId, product, session);

//     // 4 Handle variants
//     for (const variantDto of dto.variants || []) {
//       if (variantDto.id) {
//         // Update variant cũ
//         const variant = await productRepo.findVariantById(variantDto.id);
//         if (!variant) throw new Error(`Variant not found: ${variantDto.id}`);

//         if (variantDto.sku) variant.sku = variantDto.sku;
//         if (variantDto.price != null) variant.price = variantDto.price;
//         if (variantDto.stock_quantity != null) variant.stock_quantity = variantDto.stock_quantity;

//         if (variantDto.color) {
//           const color = await ColorService.getColorById(variantDto.color);
//           if (!color) throw new Error(`Color not found: ${variantDto.color}`);
//           variant.color = variantDto.color;
//         }

//         if (variantDto.size) {
//           const size = await SizeService.getSizeById(variantDto.size);
//           if (!size) throw new Error(`Size not found: ${variantDto.size}`);
//           variant.size = variantDto.size;
//         }

//         // Xoá ảnh cũ
//         if (variantDto.imagesToDelete?.length) {
//           await deleteFiles(variantDto.imagesToDelete);
//           variant.images = variant.images.filter(
//             (img) => !variantDto.imagesToDelete.includes(img.public_id)
//           );
//         }

//         // Upload ảnh mới
//         const uploadedVariantImages = await uploadFiles(variantDto.newImages || [], "variants", `Variant ${variant.sku}`);
//         variant.images = variant.images.concat(uploadedVariantImages);

//         await productRepo.updateVariant(variant._id, variant, session);
//       } else {
//         // Tạo variant mới
//         const newVariantImages = await uploadFiles(variantDto.newImages || [], "variants", `Variant ${variantDto.sku}`);
//         const newVariant = {
//           product: product._id,
//           sku: variantDto.sku,
//           price: variantDto.price,
//           stock_quantity: variantDto.stock_quantity,
//           color: variantDto.color,
//           size: variantDto.size,
//           images: newVariantImages,
//         };

//         await productRepo.createVariant(newVariant, session);
//       }
//     }

//     // 5 Lấy variants mới nhất để trả về response
//     const variants = await productRepo.findVariantsByProduct(product._id, session);
//     return toAddProductResponse(updatedProduct, variants);
//   });
// }
async function updateProduct(productId, dto) {
  return handleTransaction(async (session) => {
    // 1️⃣ Lấy product
    const product = await productRepo.findById(productId);
    if (!product) throw new Error("Product not found");

    // 2️⃣ Upload tất cả ảnh mới trước (product + variant)
    const uploadedProductImages = await uploadFiles(dto.newProductImages || [], "products", "Product");
    const uploadedVariantsMap = [];
    for (const variantDto of dto.variants || []) {
      const uploadedVariantImages = await uploadFiles(variantDto.newImages || [], "variants", `Variant ${variantDto.sku}`);
      uploadedVariantsMap.push(uploadedVariantImages);
    }

    // 3️⃣ Update basic product fields
    if (dto.name) product.name = dto.name;
    if (dto.slug) product.slug = dto.slug;
    if (dto.short_description) product.short_description = dto.short_description;
    if (dto.long_description) product.long_description = dto.long_description;

    if (dto.brand) {
      const brand = await BrandService.getBrandById(dto.brand);
      if (!brand) throw new Error("Brand not found");
      product.brand = dto.brand;
    }

    if (dto.category) {
      const category = await CategoryService.getCategoryById(dto.category);
      if (!category) throw new Error("Category not found");
      product.category = dto.category;
    }

    // 4️⃣ Xóa ảnh cũ product
    if (dto.imagesToDelete?.length) {
      await deleteFiles(dto.imagesToDelete);
      product.images = product.images.filter(
        (img) => !dto.imagesToDelete.includes(img.public_id)
      );
    }

    // 5️⃣ Thêm ảnh mới đã upload
    if (uploadedProductImages.length) {
      product.images = product.images.concat(uploadedProductImages);
    }

    // 6️⃣ Update product trong DB
    const updatedProduct = await productRepo.updateProduct(productId, product, session);

    // 7️⃣ Handle variants
    for (let i = 0; i < (dto.variants || []).length; i++) {
      const variantDto = dto.variants[i];
      const uploadedVariantImages = uploadedVariantsMap[i] || [];

      if (variantDto.id) {
        // Update variant cũ
        const variant = await productRepo.findVariantById(variantDto.id);
        if (!variant) throw new Error(`Variant not found: ${variantDto.id}`);

        if (variantDto.sku) variant.sku = variantDto.sku;
        if (variantDto.price != null) variant.price = variantDto.price;
        if (variantDto.stock_quantity != null) variant.stock_quantity = variantDto.stock_quantity;

        if (variantDto.color) {
          const color = await ColorService.getColorById(variantDto.color);
          if (!color) throw new Error(`Color not found: ${variantDto.color}`);
          variant.color = variantDto.color;
        }

        if (variantDto.size) {
          const size = await SizeService.getSizeById(variantDto.size);
          if (!size) throw new Error(`Size not found: ${variantDto.size}`);
          variant.size = variantDto.size;
        }

        // Xoá ảnh cũ
        if (variantDto.imagesToDelete?.length) {
          await deleteFiles(variantDto.imagesToDelete);
          variant.images = variant.images.filter(
            (img) => !variantDto.imagesToDelete.includes(img.public_id)
          );
        }

        // Thêm ảnh mới đã upload
        variant.images = variant.images.concat(uploadedVariantImages);

        await productRepo.updateVariant(variant._id, variant, session);
      } else {
        // Tạo variant mới
        const newVariant = {
          product: product._id,
          sku: variantDto.sku,
          price: variantDto.price,
          stock_quantity: variantDto.stock_quantity,
          color: variantDto.color,
          size: variantDto.size,
          images: uploadedVariantImages,
        };

        await productRepo.createVariant(newVariant, session);
      }
    }

    // 8️⃣ Lấy variants mới nhất để trả về response
    const variants = await productRepo.findVariantsByProduct(product._id, session);

    return toAddProductResponse(updatedProduct, variants);
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

module.exports = {
  createProduct,
  addVariant,
  deleteProduct,
  deleteVariant,
  updateProduct,
};
