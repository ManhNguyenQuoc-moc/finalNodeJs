const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    product_variant_sku: String, // tham chiếu SKU trong Product.variants
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
