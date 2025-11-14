// dtos/discountCode/ApplyDiscountCodeRequestDTO.js
class ApplyDiscountCodeRequestDTO {
  constructor(body) {
    this.code = body.code;
  }
}

module.exports = ApplyDiscountCodeRequestDTO;
