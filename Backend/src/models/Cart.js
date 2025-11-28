const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_sku: { type: String, required: true, trim: true },
    name_snapshot: { type: String, required: true, trim: true },
    price_at_time: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },

    color_name_snapshot: { type: String, default: null, trim: true },
    size_name_snapshot: { type: String, default: null, trim: true },
    img_snapshot: { type: String, default: null, trim: true },

    color_id_snapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductColor",
      default: null,
    },
    size_id_snapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductSize",
      default: null,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    session_id: { type: String },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: "updated_at" } }
);

cartSchema.index({ user_id: 1 }, { unique: true, sparse: true });
cartSchema.index({ session_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Cart", cartSchema);
