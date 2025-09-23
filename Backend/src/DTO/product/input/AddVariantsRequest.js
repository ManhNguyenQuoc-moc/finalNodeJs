
class AddVariantsRequest {
  constructor(data, uploadedFiles = []) {
    this.color_name = data.color_name;
    this.color_code = data.color_code;
    this.size_name = data.size_name;
    this.size_order = data.size_order;
    this.sku = data.sku;
    this.price = data.price;
    this.stock_quantity = data.stock_quantity;
    this.uploadedFiles = uploadedFiles;
    this.tempImages = uploadedFiles.map((file, index) => ({
      localPath: file.path,
      filename: file.filename,
      is_primary: index === 0, 
    }));
  }
}

module.exports = { AddVariantsRequest};
