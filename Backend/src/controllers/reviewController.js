// src/controllers/reviewController.js
const reviewService = require("../services/reviewService");

exports.createReview = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const payload = req.body;
        const currentUser = req.currentUser || null;
        const files = req.files || []; // Files từ multer

        const { review, rating } = await reviewService.createReview({
            productId,
            payload,
            currentUser,
            files,
        });

        if (global.io) {
            global.io.to(`product:${productId}`).emit("review:new", review);
            // Emit rating update để tất cả clients cập nhật rating ngay lập tức
            global.io.to(`product:${productId}`).emit("rating:updated", {
                average: rating.average || rating.averageRating || 0,
                count: rating.count || rating.countRating || 0,
                sentiment: rating.sentiment || {}
            });
        }

        return res.json({
            ok: true,
            review,
            rating,
        });
    } catch (err) {
        next(err);
    }
};

exports.createReply = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const { parent_id, comment, guest_name } = req.body;
        const currentUser = req.currentUser || null;

        if (!parent_id) {
            return res.status(400).json({
                ok: false,
                message: "Không tìm thấy bình luận gốc"
            });
        }

        const payload = {
            comment,
            guest_name
        };

        const { reply } = await reviewService.createReply({
            productId,
            parentId: parent_id,
            payload,
            currentUser,
        });

        // Ensure reply has parent_id for WebSocket
        const replyWithParent = {
            ...reply,
            parent_id: parent_id
        };

        // Emit socket event for real-time update
        if (global.io) {
            global.io.to(`product:${productId}`).emit("reply:new", replyWithParent);
        }

        return res.json({
            ok: true,
            reply,
        });
    } catch (err) {
        return res.status(400).json({
            ok: false,
            message: err.message || "Gửi phản hồi thất bại"
        });
    }
};

exports.toggleLike = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const reviewId = req.params.reviewId;
        const currentUser = req.currentUser;

        // Get guest identifier (IP address or session ID)
        let guestIdentifier = null;
        if (!currentUser) {
            // Try to get IP address
            const ip = req.ip || 
                      (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
                      req.connection?.remoteAddress ||
                      req.socket?.remoteAddress ||
                      'anonymous';
            // Use session ID if available, otherwise use IP
            guestIdentifier = req.sessionID || ip;
        }

        const result = await reviewService.toggleLike({
            reviewId,
            currentUser,
            guestIdentifier
        });

        // Emit socket event for real-time update
        if (global.io) {
            global.io.to(`product:${productId}`).emit("comment:like-updated", {
                comment_id: reviewId,
                likes_count: result.likes_count,
                is_liked: result.is_liked
            });
        }

        return res.json({
            ok: true,
            likes_count: result.likes_count,
            is_liked: result.is_liked
        });
    } catch (err) {
        return res.status(400).json({
            ok: false,
            message: err.message || "Thả tim thất bại"
        });
    }
};