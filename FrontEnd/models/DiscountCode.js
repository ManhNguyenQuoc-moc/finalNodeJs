const mongoose = require("mongoose");
const codeRegex = /^[A-Z0-9]{5,10}$/; // từ 5 đến 10 ký tự

const discountCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, match: codeRegex },
  usage_limit: { type: Number, default: 0, min: 0, max: 10 },
  usage_count: { type: Number, default: 0, min: 0 },
  // tuỳ bạn thêm discount_value/percent nếu cần; đề chỉ yêu cầu code + limit
}, { timestamps: { createdAt: true, updatedAt: false }});

discountCodeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model("DiscountCode", discountCodeSchema);
