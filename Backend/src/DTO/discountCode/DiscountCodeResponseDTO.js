// dtos/discountCode/DiscountCodeResponseDTO.js
class DiscountCodeResponseDTO {
    constructor(discount) {
        this._id = discount._id;
        this.code = discount.code;
        this.discount_value = discount.discount_value;
        this.usage_limit = discount.usage_limit;
        this.usage_count = discount.usage_count;
        this.is_active = discount.is_active;
        this.createdAt = discount.createdAt;   // đổi về cùng naming FE
        this.updatedAt = discount.updatedAt;
    }
}

module.exports = DiscountCodeResponseDTO;
