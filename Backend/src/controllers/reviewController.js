// src/controllers/reviewController.js
const reviewService = require("../services/reviewService");

exports.createReview = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const payload = req.body;
        const currentUser = req.currentUser || null;

        const { review, rating } = await reviewService.createReview({
            productId,
            payload,
            currentUser,
        });

        if (global.io) {
            global.io.to(`product:${productId}`).emit("review:new", review);
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
