const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null => guest
  guest_name:  { type: String, default: null, trim: true },
  guest_email: { type: String, default: null, trim: true, lowercase: true },
  rating: { type: Number, min: 1, max: 5 },        // chỉ set khi có user_id
  comment: { type: String, required: true, trim: true }
}, { timestamps: { createdAt: "created_at", updatedAt: false }});

reviewSchema.index({ product_id: 1, created_at: -1 });

module.exports = mongoose.model("Review", reviewSchema);
