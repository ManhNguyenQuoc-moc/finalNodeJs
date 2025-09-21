const mongoose = require("mongoose");
const productColorSchema = new mongoose.Schema({
  color_name: { type: String, required: true, unique: true, trim: true }, // Red, Blue...
  color_code: { type: String, trim: true },                                // #RRGGBB (optional)
  created_at: { type: Date, default: Date.now }
});
productColorSchema.index({ color_name: 1 }, { unique: true });
module.exports = mongoose.model("ProductColor", productColorSchema);
