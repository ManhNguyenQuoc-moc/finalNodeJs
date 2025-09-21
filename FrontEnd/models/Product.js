// models/Product.js
const mongoose = require("mongoose");

/* ---------- Sub-schemas ---------- */

// Ảnh chung (không gắn với size hay color cụ thể)
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    is_primary: { type: Boolean, default: false },
  },
  { _id: false }
);

// Màu nằm trong product (không nằm trong variant)
// Có thể đính kèm danh sách ảnh theo màu để show swatch/thumbnail
const productColorEntrySchema = new mongoose.Schema(
  {
    color_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductColor",
      required: true,
    },
    imageUrls: { type: [String], default: [] },
    is_primary: { type: Boolean, default: false },
  },
  { _id: false }
);

// Variant CHỈ chứa size (không có color_id)
// Có thể có price riêng theo size; nếu không có thì dùng product.price
const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true }, // unique toàn hệ thống
    size_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductSize",
      required: true,
    },
    price: { type: Number, min: 0 }, // optional: override theo size
    stock_quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/* ---------- Product ---------- */

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Mô tả ngắn/dài để show ngoài website
    short_description: { type: String, trim: true },
    long_description: { type: String, trim: true },

    // Giá GỐC của mẫu
    price: { type: Number, required: true, min: 0 },

    // ✅ Thêm trạng thái hiển thị
    productStatus: {
      statusName: {
        type: String,
        enum: ["Bán chạy", "Trending", "New"],
        default: "New",
      },
    },

    // Thuộc tính chung
    brand_id: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    gender: { type: String, enum: ["men", "women", "unisex"], default: "unisex" },
    material: { type: String, trim: true },

    // Ảnh & màu
    images: { type: [imageSchema], default: [] },
    colors: { type: [productColorEntrySchema], default: [] },

    // Biến thể
    variants: { type: [variantSchema], default: [] },

    status: { type: String, enum: ["active", "draft", "inactive"], default: "active" },

    // denormalize rating
    avg_rating: { type: Number, default: 0, min: 0, max: 5 },
    rating_count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

/* ---------- Indexes ---------- */
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
productSchema.index({ brand_id: 1 });
productSchema.index({ category_id: 1 });
productSchema.index({ name: "text", short_description: "text", long_description: "text" });

/* ---------- Helpers (tuỳ chọn) ---------- */
// Nếu bạn muốn có displayPrice (ưu tiên giá nhỏ nhất của variant nếu có), dùng virtual sau:
productSchema.virtual("display_price").get(function () {
  if (Array.isArray(this.variants) && this.variants.length) {
    const candidates = this.variants
      .map((v) => (typeof v.price === "number" ? v.price : null))
      .filter((x) => x !== null);
    if (candidates.length) return Math.min(...candidates);
  }
  return this.price;
});

module.exports = mongoose.model("Product", productSchema);
