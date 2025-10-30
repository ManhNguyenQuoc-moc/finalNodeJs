const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    short_description: String,
    long_description: String,
    productStatus: {
      statusName: {
        type: String,
        enum: ["Bán chạy", "Trending", "New"],
        default: "New",
        trim: true
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
