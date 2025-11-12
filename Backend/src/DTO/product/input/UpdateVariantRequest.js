// DTO/product/input/UpdateVariantRequest.js
class UpdateVariantRequest {
  /**
   * @param {object} data - object variant từ body
   * @param {Array} uploadedFiles - file mới upload (multer.any)
   */
  constructor(data = {}, uploadedFiles = []) {
    // id có thể là id hoặc _id
    this.id = data.id || data._id || null;

    this.sku = data.sku ?? undefined;
    this.price = data.price !== undefined && data.price !== null && data.price !== ''
      ? Number(data.price)
      : undefined;
    this.stock_quantity = data.stock_quantity !== undefined && data.stock_quantity !== null && data.stock_quantity !== ''
      ? Number(data.stock_quantity)
      : undefined;

    this.color = data.color ?? undefined; // ObjectId
    this.size = data.size ?? undefined; // ObjectId

    // Ảnh cũ cần xoá: mảng | chuỗi JSON | string đơn
    let del = data.imagesToDelete ?? data['imagesToDelete[]'] ?? null;
    if (typeof del === 'string') {
      try { del = JSON.parse(del); } catch { del = [del]; }
    }
    this.imagesToDelete = Array.isArray(del) ? del : [];

    // Ảnh mới upload từ multer
    this.newImages = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  }
}

module.exports = { UpdateVariantRequest };
