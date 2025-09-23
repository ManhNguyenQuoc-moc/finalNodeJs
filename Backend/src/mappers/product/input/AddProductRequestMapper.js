// mappers/AddProductRequestMapper.js
const { AddProductRequest } = require("../../../DTO/product/input/AddProductRequest");
const { AddVariantsRequest } = require("../../../DTO/product/input/AddVariantsRequest");

class AddProductRequestMapper {
    
  static toEntity(dto, uploadedProductImages, uploadedVariantImagesMap) {
    const productEntity = {
      name: dto.name,
      slug: dto.slug,
      brand: dto.brand,
      category: dto.category,
      short_description: dto.short_description,
      long_description: dto.long_description,
      images: uploadedProductImages.map((img, index) => ({
        url: img.secure_url,
        public_id: img.public_id,
        is_primary: index === 0,
      })),
    };
     // entity cho ProductVariants
    const variantEntities = dto.variants.map((variant, idx) => ({
      color_name: variant.color_name,
      size_name: variant.size_name,
      sku: variant.sku,
      price: variant.price,
      stock_quantity: variant.stock_quantity,
      images: (uploadedVariantImagesMap[idx] || []).map((img, i) => ({
        url: img.secure_url,
        public_id: img.public_id,
        is_primary: i === 0,
      })),
    }));

    return { productEntity, variantEntities };
  }
}

module.exports = AddProductRequestMapper;
