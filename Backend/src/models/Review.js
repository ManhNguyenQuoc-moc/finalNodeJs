const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // User đăng nhập
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Khách không đăng nhập
    guest_name: { type: String, default: null },
    guest_email: { type: String, default: null },

    // Nội dung (optional nếu có rating hoặc images)
    comment: { type: String, required: false, default: '' },

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
    },

    // REPLY (parent review)
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      default: null
    },

    // LIKES (array of user IDs who liked this review)
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    
    // GUEST LIKES (array of IP addresses or session IDs for guests)
    guest_likes: [{
      type: String
    }],

    // IMAGES (array of image URLs for review - only for logged-in users)
    images: [{
      url: { type: String, required: true },
      public_id: { type: String, default: null },
      is_primary: { type: Boolean, default: false }
    }]
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
  if (!this.user && this.images && this.images.length > 0) {
    return next(new Error("Only logged-in users can upload images"));
  }
  // Không yêu cầu rating khi có images - user có thể chỉ upload ảnh hoặc chỉ đánh sao hoặc cả hai
  next();
});

module.exports = mongoose.model("Review", reviewSchema);
