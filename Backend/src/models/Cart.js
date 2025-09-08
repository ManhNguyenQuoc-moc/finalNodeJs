const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product_variant_sku: String,
    quantity: Number,
    price_at_time: Number,
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
