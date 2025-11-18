const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // User đăng nhập
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Khách không đăng nhập
    guest_name: { type: String, default: null },
    guest_email: { type: String, default: null },

    // Nội dung
    comment: { type: String, required: true },

    // Rating chỉ dành cho user
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },

    // SENTIMENT (AI phân tích)
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral"
    },

    sentiment_score: {
      type: Number,
      min: -1,
      max: 1,
      default: 0
    },

    // AI LABEL
    ai_label: {
      type: String,
      enum: ["happy", "complain", "urgent"],
      default: "complain"
    }
  },
  { timestamps: true }
);

// ⚠ VALIDATION CHO REVIEW KHÁCH
reviewSchema.pre("save", function (next) {
  if (!this.user && !this.guest_name) {
    return next(new Error("Guest reviews must include guest_name"));
  }
  if (!this.user && this.rating) {
    return next(new Error("Only logged-in users can give rating stars"));
  }
  next();
});

module.exports = mongoose.model("Review", reviewSchema);
