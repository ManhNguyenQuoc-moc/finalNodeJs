const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    color_name: String, 
    color_code: String, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductColor", productColorSchema);
