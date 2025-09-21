const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },     
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

  imageUrl: { type: String, default: "/mixishop/images/categories/default.jpg" },

  status: { type: Number, default: 1 } 
}, { 
  timestamps: { createdAt: true, updatedAt: false }
});

// index cho slug
categorySchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
