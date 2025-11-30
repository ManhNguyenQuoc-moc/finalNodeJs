// src/services/reviewService.js
const reviewRepo = require("../repositories/reviewRepository");
const aiService = require("./aiService");  // ✨ nhớ import AI
const { uploadFiles } = require("../utils/fileHandler");

// 🧠 Map sentiment + score → label
function mapSentimentToLabel(sentiment, score) {
  if (sentiment === "positive" && score > 0.3) return "happy";
  if (sentiment === "negative" && score < -0.3) return "urgent";
  return "complain";
}

async function createReview({ productId, payload, currentUser, files = [] }) {
  const { comment, rating, guest_name, guest_email } = payload;
  const user = currentUser || null;

  // ---------------------------------
  // 1) Validate input
  // ---------------------------------
  // Comment là optional nếu có rating hoặc images
  // Có thể chỉ đánh sao, chỉ upload ảnh, chỉ bình luận, hoặc kết hợp
  const hasComment = comment && comment.trim();
  const hasRating = user && rating != null && rating !== '' && rating !== '0';
  const hasImages = user && files && files.length > 0;
  
  if (!hasComment && !hasRating && !hasImages) {
    throw new Error("Vui lòng nhập bình luận, hoặc đánh sao, hoặc thêm ảnh");
  }

  if (!user && rating) {
    throw new Error("Bạn cần đăng nhập để đánh giá sao");
  }

  let ratingValue = null;

  // Rating là optional - không bắt buộc khi có ảnh
  // User có thể chỉ upload ảnh, chỉ đánh sao, hoặc cả hai
  if (user && rating != null && rating !== '' && rating !== '0') {
    const r = Number(rating);
    if (Number.isFinite(r) && r >= 1 && r <= 5) {
      ratingValue = r;
    }
    // Nếu rating không hợp lệ, giữ null (không throw error)
  }

  // Nếu chưa đăng nhập, dùng "Người dùng ẩn danh" thay vì yêu cầu guest_name
  const displayName = user ? null : (guest_name || "Người dùng ẩn danh");

  // Upload images nếu có (chỉ cho user đăng nhập)
  let uploadedImages = [];
  if (user && files && files.length > 0) {
    try {
      uploadedImages = await uploadFiles(files, "reviews", "Review");
    } catch (err) {
      console.error("Upload review images failed:", err);
      // Không throw error, chỉ log và tiếp tục không có ảnh
    }
  } else if (!user && files && files.length > 0) {
    throw new Error("Bạn cần đăng nhập để upload ảnh");
  }

  let sentimentData = {
    sentiment: "neutral",
    score: 0,
    summary: "Không phân tích được."
  };
  // Chỉ phân tích sentiment nếu có comment
  if (hasComment) {
    try {
      sentimentData = await aiService.analyzeSentiment(comment);
      console.log("Sentiment AI:", sentimentData);
    } catch (e) {
      console.error("Sentiment Error:", e);
    }
  }
  const ai_label = mapSentimentToLabel(
    sentimentData.sentiment,
    sentimentData.score
  );
  const doc = await reviewRepo.create({
    product: productId,
    user: user ? user._id : null,
    guest_name: user ? null : displayName,
    guest_email: user ? null : guest_email,

    comment: hasComment ? comment.trim() : (hasRating ? 'Đánh giá sao' : (hasImages ? 'Đánh giá có ảnh' : '')),
    rating: ratingValue,

    sentiment: sentimentData.sentiment,
    sentiment_score: sentimentData.score,
    ai_label: ai_label, // ✨ lưu label
    
    images: uploadedImages, // ✨ lưu ảnh
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

async function createReply({ productId, parentId, payload, currentUser }) {
  const { comment, guest_name } = payload;
  const user = currentUser || null;

  // Validate
  if (!comment || !comment.trim()) {
    throw new Error("Vui lòng nhập nội dung phản hồi");
  }

  // Nếu chưa đăng nhập, dùng "Người dùng ẩn danh" thay vì yêu cầu guest_name
  const displayName = user ? null : (guest_name || "Người dùng ẩn danh");

  if (!parentId) {
    throw new Error("Không tìm thấy bình luận gốc");
  }

  // Verify parent review exists and belongs to this product
  const parentReview = await reviewRepo.findById(parentId);
  if (!parentReview) {
    throw new Error("Bình luận gốc không tồn tại");
  }

  // Convert to string for comparison (lean() returns plain object)
  const parentProductId = parentReview.product.toString ? parentReview.product.toString() : String(parentReview.product);
  const targetProductId = productId.toString ? productId.toString() : String(productId);
  
  if (parentProductId !== targetProductId) {
    throw new Error("Bình luận không thuộc sản phẩm này");
  }

  // Analyze sentiment for reply
  let sentimentData = {
    sentiment: "neutral",
    score: 0,
    summary: "Không phân tích được."
  };
  try {
    sentimentData = await aiService.analyzeSentiment(comment);
    console.log("Reply Sentiment AI:", sentimentData);
  } catch (e) {
    console.error("Reply Sentiment Error:", e);
  }
  const ai_label = mapSentimentToLabel(
    sentimentData.sentiment,
    sentimentData.score
  );

  // Create reply (no rating, but has sentiment analysis)
  const doc = await reviewRepo.create({
    product: productId,
    user: user ? user._id : null,
    guest_name: user ? null : displayName,
    comment: comment.trim(),
    rating: null, // Replies don't have ratings
    parent_id: parentId,
    sentiment: sentimentData.sentiment,
    sentiment_score: sentimentData.score,
    ai_label: ai_label
  });

  // Get full reply with populated user
  const full = await reviewRepo.findById(doc._id);

  return {
    reply: full
  };
}

async function toggleLike({ reviewId, currentUser, guestIdentifier }) {
  if (!reviewId) {
    throw new Error("Không tìm thấy bình luận");
  }

  // Allow both logged-in users and guests to like
  const userId = currentUser ? currentUser._id : null;
  const result = await reviewRepo.toggleLike(reviewId, userId, guestIdentifier);
  return result;
}

module.exports = {
  createReview,
  getReviewsByProduct,
  createReply,
  toggleLike,
};
