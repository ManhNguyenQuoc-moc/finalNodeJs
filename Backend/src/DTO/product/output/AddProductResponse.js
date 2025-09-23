// DTO/product/output/AddProductResponse.js
class AddProductResponse {
  constructor(product, variants) {
    this.id = product._id;
    this.name = product.name;
    this.slug = product.slug;
    this.brand = product.brand;
    this.category = product.category;
    this.short_description = product.short_description;
    this.long_description = product.long_description;
    this.images = product.images.map(img => ({
      url: img.url,
      public_id: img.public_id, // Thêm public_id để tiện quản lý khi xóa
      is_primary: img.is_primary,
    }));
    this.variants = variants.map(v => ({
      id: v._id,
      sku: v.sku,
      price: v.price,
      stock_quantity: v.stock_quantity,
      color: v.color
        ? {
            id: v.color._id,
            name: v.color.color_name,
            code: v.color.color_code,
          }
        : null,
      size: v.size
        ? {
            id: v.size._id,
            name: v.size.size_name,
            order: v.size.size_order,
          }
        : null,
      images: v.images.map(img => ({
        url: img.url,
        public_id: img.public_id,
        is_primary: img.is_primary,
      })),
    }));
  }
}
module.exports = { AddProductResponse };