const mongoose = require("mongoose");

const productColorSchema = new mongoose.Schema(
  {
    color_name: String, 
    color_code: String, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductColor", productColorSchema);
