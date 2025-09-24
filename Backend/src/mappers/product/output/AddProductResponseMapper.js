const { AddProductResponse } = require("../../../DTO/product/output/AddProductResponse");

/**
 * Map từ Product + Variants entity trong DB sang AddProductResponse DTO
 * @param {Object} product - Đối tượng Product từ MongoDB
 * @param {Array} variants - Danh sách ProductVariant từ MongoDB
 * @returns {AddProductResponse}
 */
function toAddProductResponse(product = {}, variants = []) {
  // unwrap nếu lỡ là array
  if (Array.isArray(product)) product = product[0];

  if (!product || !product._id) {
    throw new Error("Invalid product entity for AddProductResponse");
  }

  // đảm bảo variants luôn là mảng
  if (!Array.isArray(variants)) variants = [];

  return new AddProductResponse(product, variants);
}

module.exports = { toAddProductResponse };
