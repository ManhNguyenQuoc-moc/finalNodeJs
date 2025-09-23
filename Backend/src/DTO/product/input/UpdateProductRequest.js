class UpdateProductRequest {
  constructor(body, files) {
    this.name = body.name;
    this.slug = body.slug;
    this.brand = body.brand;
    this.category = body.category;
    this.short_description = body.short_description;
    this.long_description = body.long_description;

    // 1. Hình mới upload (files từ form-data)
    this.productImages = files?.filter(f => f.fieldname === "productImages") || [];

    // 2. Giữ hình cũ (mảng public_id của hình cũ muốn giữ)
    this.keepImages = body.keepImages ? JSON.parse(body.keepImages) : [];

    // 3. Thay thế hình cũ
    // Mảng object: [{ oldId, file }]
    this.replaceImages = [];
    if (files) {
      const replaceFiles = files.filter(f => f.fieldname.startsWith("replaceImages"));
      for (const f of replaceFiles) {
        // fieldname: replaceImages[0], replaceImages[1]...
        const index = f.fieldname.match(/\d+/)[0];
        const oldId = body[`replaceImages[${index}][oldId]`];
        this.replaceImages.push({ oldId, file: f });
      }
    }
  }
}
module.exports = { UpdateProductRequest };