const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
}, { timestamps: { createdAt: true, updatedAt: false }});

wishlistSchema.index({ user_id: 1 }, { unique: true }); // mỗi user một wishlist

module.exports = mongoose.model("Wishlist", wishlistSchema);
