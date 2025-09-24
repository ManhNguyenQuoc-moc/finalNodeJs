class UpdateVariantRequest {
  /**
   * @param {object} data - object variant từ body
   * @param {Array} uploadedFiles - file mới upload
   */
  constructor(data = {}, uploadedFiles = []) {
    this.id = data.id; // optional, nếu update variant cũ
    this.sku = data.sku;
    this.price = Number(data.price) || 0;
    this.stock_quantity = Number(data.stock_quantity) || 0;
    this.color = data.color; // ObjectId
    this.size = data.size;   // ObjectId

    // Ảnh cũ cần xoá
    this.imagesToDelete = Array.isArray(data.imagesToDelete) ? data.imagesToDelete : [];

    // Ảnh mới upload
    this.newImages = uploadedFiles;
  }
}

module.exports = { UpdateVariantRequest };
