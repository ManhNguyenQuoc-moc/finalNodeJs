const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product_variant_sku: String,
    quantity: Number,
    price_at_purchase: Number,
  },
  { _id: false }
);

const orderStatusSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    address: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    discount_code: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscountCode",
    },
    items: [orderItemSchema],
    total_amount: Number,
    final_amount: Number,
    loyalty_points_used: Number,
    loyalty_points_earned: Number,
    status_history: [orderStatusSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
