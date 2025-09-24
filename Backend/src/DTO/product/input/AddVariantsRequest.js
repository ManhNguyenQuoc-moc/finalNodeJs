class AddVariantsRequest {
  /**
   * @param {object} data - object mô tả variant từ body (đã parse JSON)
   * @param {Array} uploadedFiles - danh sách file upload từ multer
   */
  constructor(data = {}, uploadedFiles = []) {
    this.color = data.color;   // color_id
    this.size = data.size;     // size_id
    this.sku = data.sku;
    this.price = Number(data.price) || 0;
    this.stock_quantity = Number(data.stock_quantity) || 0;

    this.uploadedFiles = uploadedFiles;

    // Chuẩn hoá images để tiện xử lý upload sau này
    this.tempImages = (uploadedFiles || []).map((file, index) => ({
      localPath: file.path,         // path local do multer lưu
      filename: file.filename,      // tên file trong uploads/
      mimetype: file.mimetype,      // loại file
      size: file.size,              // dung lượng file
      is_primary: index === 0,      // file đầu tiên mặc định là ảnh chính
    }));
  }
}

module.exports = { AddVariantsRequest };
