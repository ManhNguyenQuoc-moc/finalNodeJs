const mongoose = require("mongoose");

const productSizeSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    size_name: String, // ví dụ: S, M, L, XL
    size_order: Number, // để sắp xếp
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductSize", productSizeSchema);
