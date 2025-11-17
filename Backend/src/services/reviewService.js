// src/services/reviewService.js
const reviewRepo = require("../repositories/reviewRepository");

async function createReview({ productId, payload, currentUser }) {
  const { comment, rating, guest_name, guest_email } = payload;
  const user = currentUser || null;

  // 1) Validate comment
  if (!comment || !comment.trim()) {
    throw new Error("Vui lòng nhập nội dung đánh giá");
  }

  // 2) Guest không được rating
  let ratingValue = null;
  if (!user && rating) {
    throw new Error("Bạn cần đăng nhập để đánh giá sao");
  }

  // 3) User có thể rating 1–5
  if (user && rating != null) {
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      throw new Error("Số sao không hợp lệ");
    }
    ratingValue = r;
  }

  // 4) Guest phải có tên
  if (!user && !guest_name) {
    throw new Error("Vui lòng nhập tên hiển thị");
  }

  // 5) Tạo review
  const doc = await reviewRepo.create({
    product: productId,
    user: user ? user._id : null,
    guest_name: user ? null : guest_name,
    guest_email: user ? null : guest_email,
    comment: comment.trim(),
    rating: ratingValue,
  });

  // 6) Lấy lại review đầy đủ (populate user)
  const full = await reviewRepo.findById(doc._id);

  // 7) Lấy thống kê rating
  const ratingStats = await reviewRepo.getRatingStats(productId);

  // 8) Trả về đúng shape để controller dùng
  return {
    review: full,
    rating: ratingStats,
  };
}

async function getReviewsByProduct(productId) {
  const reviews = await reviewRepo.findByProduct(productId);
  const rating = await reviewRepo.getRatingStats(productId);
  return { reviews, rating };
}

module.exports = {
  createReview,
  getReviewsByProduct,
};
