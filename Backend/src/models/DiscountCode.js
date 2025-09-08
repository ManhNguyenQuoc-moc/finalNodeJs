const mongoose = require("mongoose");

const discountCodeSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    discount_value: Number,
    usage_limit: Number,
    usage_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiscountCode", discountCodeSchema);
