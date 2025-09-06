const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    color: { type: mongoose.Schema.Types.ObjectId, ref: "ProductColor" },
    size: { type: mongoose.Schema.Types.ObjectId, ref: "ProductSize" },
    sku: { type: String, unique: true },
    price: Number,
    stock_quantity: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductVariant", productVariantSchema);
