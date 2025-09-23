// mappers/product/output/ProductResponseMapper.js
const { AddProductResponse } = require("../../../DTO/product/output/AddProductResponse");

/**
 * Map từ Product và Variants Entity sang AddProductResponse DTO
 * @param {Object} product - Đối tượng Product từ DB
 * @param {Array} variants - Mảng các đối tượng ProductVariant từ DB
 * @returns {AddProductResponse}
 */
function toAddProductResponse(product, variants) {
  return new AddProductResponse(product, variants);
}

module.exports = { toAddProductResponse };