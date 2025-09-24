class AddProductResponse {
  constructor(product, variants = []) {
    this.id = product._id?.toString();
    this.name = product.name || "";
    this.slug = product.slug || "";
    this.brand = product.brand || null;
    this.category = product.category || null;
    this.short_description = product.short_description || "";
    this.long_description = product.long_description || "";

    // Images của product
    this.images = (product.images || []).map((img) => ({
      url: img.url,
      public_id: img.public_id,
      is_primary: !!img.is_primary,
    }));

    // Variants
    this.variants = (variants || []).map((v) => ({
      id: v._id?.toString(),
      sku: v.sku,
      price: Number(v.price) || 0,
      stock_quantity: Number(v.stock_quantity) || 0,
      color: v.color
        ? {
            id: v.color._id?.toString(),
            name: v.color.color_name,
            code: v.color.color_code,
          }
        : null,
      size: v.size
        ? {
            id: v.size._id?.toString(),
            name: v.size.size_name,
            order: Number(v.size.size_order) || 0,
          }
        : null,
      images: (v.images || []).map((img) => ({
        url: img.url,
        public_id: img.public_id,
        is_primary: !!img.is_primary,
      })),
    }));

    // Optional: metadata
    this.createdAt = product.createdAt || null;
    this.updatedAt = product.updatedAt || null;
  }
}

module.exports = { AddProductResponse };
