const mongoose = require("mongoose");
const productSizeSchema = new mongoose.Schema({
  size_name: { type: String, required: true, unique: true, trim: true }, // XS,S,M,L,XL,36,37,...
  size_order: { type: Number, default: 0 },                              // để sort S<M<L<XL...
  created_at: { type: Date, default: Date.now }
});
productSizeSchema.index({ size_name: 1 }, { unique: true });
module.exports = mongoose.model("ProductSize", productSizeSchema);
