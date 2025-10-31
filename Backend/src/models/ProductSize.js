const mongoose = require("mongoose");

const productSizeSchema = new mongoose.Schema(
  {
    size_name: String, // ví dụ: S, M, L, XL
    size_order: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductSize", productSizeSchema);
