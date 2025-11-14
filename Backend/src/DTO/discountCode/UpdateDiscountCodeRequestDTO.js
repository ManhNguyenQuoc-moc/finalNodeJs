// dtos/discountCode/UpdateDiscountCodeRequestDTO.js
class UpdateDiscountCodeRequestDTO {
  constructor(body) {
    this.code = body.code;
    this.discount_value = body.discount_value;
    this.usage_limit = body.usage_limit;
    this.is_active = body.is_active;
  }
}

module.exports = UpdateDiscountCodeRequestDTO;
