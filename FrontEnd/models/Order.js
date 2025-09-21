const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name_snapshot: { type: String, required: true, trim: true },
  variant_sku: { type: String, required: true, trim: true },
  unit_price:  { type: Number, required: true, min: 0 },
  quantity:    { type: Number, required: true, min: 1 },
  image_url:   { type: String, default: null, trim: true }
}, { _id: false });

const statusSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending","confirmed","shipping","delivered","cancelled"], required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // user hoặc guest (đề yêu cầu guest checkout)
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  guest_name:  { type: String, default: null, trim: true },
  guest_email: { type: String, default: null, trim: true, lowercase: true },

  order_items: { type: [orderItemSchema], required: true },

  discount_code:  { type: String, default: null, uppercase: true },
  discount_value: { type: Number, default: 0, min: 0 },

  loyalty_points_earned: { type: Number, default: 0, min: 0 },  // earn 10%
  loyalty_points_spent:  { type: Number, default: 0, min: 0 },  // dùng ở đơn sau

  total_amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending","confirmed","shipping","delivered","cancelled"], default: "pending" },
  status_history: { type: [statusSchema], default: [] }
}, { timestamps: { createdAt: true, updatedAt: false }});

orderSchema.index({ user_id: 1, createdAt: -1 });
orderSchema.index({ discount_code: 1 });

module.exports = mongoose.model("Order", orderSchema);
