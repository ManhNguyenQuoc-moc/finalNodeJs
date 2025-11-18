// src/services/reviewService.js
const reviewRepo = require("../repositories/reviewRepository");
const aiService = require("./aiService");  // ✨ nhớ import AI

// 🧠 Map sentiment + score → label
function mapSentimentToLabel(sentiment, score) {
  if (sentiment === "positive" && score > 0.3) return "happy";
  if (sentiment === "negative" && score < -0.3) return "urgent";
  return "complain";
}

async function createReview({ productId, payload, currentUser }) {
  const { comment, rating, guest_name, guest_email } = payload;
  const user = currentUser || null;

  // ---------------------------------
  // 1) Validate input
  // ---------------------------------
  if (!comment || !comment.trim()) {
    throw new Error("Vui lòng nhập nội dung đánh giá");
  }

  if (!user && rating) {
    throw new Error("Bạn cần đăng nhập để đánh giá sao");
  }

  let ratingValue = null;

  if (user && rating != null) {
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      throw new Error("Số sao không hợp lệ");
    }
    ratingValue = r;
  }

  if (!user && !guest_name) {
    throw new Error("Vui lòng nhập tên hiển thị");
  }

  let sentimentData = {
    sentiment: "neutral",
    score: 0,
    summary: "Không phân tích được."
  };
  try {
    sentimentData = await aiService.analyzeSentiment(comment);
    console.log("Sentiment AI:", sentimentData);
  } catch (e) {
    console.error("Sentiment Error:", e);
  }
  const ai_label = mapSentimentToLabel(
    sentimentData.sentiment,
    sentimentData.score
  );
  const doc = await reviewRepo.create({
    product: productId,
    user: user ? user._id : null,
    guest_name: user ? null : guest_name,
    guest_email: user ? null : guest_email,

    comment: comment.trim(),
    rating: ratingValue,

    sentiment: sentimentData.sentiment,
    sentiment_score: sentimentData.score,
    ai_label: ai_label, // ✨ lưu label
  });

  // 5) Lấy lại review đầy đủ
  const full = await reviewRepo.findById(doc._id);

  // 6) Lấy rating stats
  const ratingStats = await reviewRepo.getRatingStats(productId);

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
