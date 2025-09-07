const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    color_name: String, // ví dụ: Đen, Trắng, Navy
    color_code: String, // ví dụ: #000000
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductColor", productColorSchema);
