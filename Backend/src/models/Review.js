const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // Nếu user đã đăng nhập -> lưu user
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Nếu user không đăng nhập -> lưu thông tin khách
    guest_name: { type: String, default: null },
    guest_email: { type: String, default: null },

    comment: { type: String, required: true },

    // Rating chỉ hợp lệ khi có user
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
  },
  { timestamps: true }
);

// Optional: custom validation
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
