// src/mappers/product/input/AddProductRequestMapper.js
class AddProductRequestMapper {
  static toProductEntity(dto, uploadedProductImages = []) {
    return {
      name: dto.name?.trim() || "",
      slug: dto.slug?.trim() || "",
      brand: dto.brand,
      category: dto.category,
      short_description: dto.short_description || "",
      long_description: dto.long_description || "",
      productStatus: dto.productStatus ||"New",
      images: (uploadedProductImages || []).map((img, index) => ({
        url: img.secure_url || img.url,
        public_id: img.public_id,
        is_primary: index === 0,
      })),
    };
  }

  static toVariantEntities(variantsDto = [], uploadedVariantImagesMap = [], productId) {
    if (!productId) throw new Error("productId is required for variants"); // debug
    return (variantsDto || []).map((variant, idx) => {
      const uploadedImages = uploadedVariantImagesMap[idx] || [];
      return {
        product: productId,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        price: Number(variant.price) || 0,
        stock_quantity: Number(variant.stock_quantity) || 0,
        images: uploadedImages.map((img, i) => ({
          url: img.secure_url || img.url,
          public_id: img.public_id,
          is_primary: i === 0,
        })),
      };
    });
  }
}

module.exports = AddProductRequestMapper;
