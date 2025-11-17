const mongoose = require("mongoose");
const Review = require("../models/Review");

class ReviewRepository {
    async create(data, session = null) {
        const review = new Review(data);
        return review.save({ session });
    }

    async findById(id) {
        return Review.findById(id)
            .populate("user", "full_name email")
            .lean();
    }

    async findByProduct(productId) {
        return Review.find({ product: productId })
            .sort({ createdAt: -1 })
            .populate("user", "full_name email")
            .lean();
    }

    async getRatingStats(productId) {
        // B1: Validate ID
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return { average: 0, count: 0 };
        }

        // B2: Cast to ObjectId đúng chuẩn
        const pid = new mongoose.Types.ObjectId(productId);

        // B3: Aggregate
        const stats = await Review.aggregate([
            { $match: { product: pid, rating: { $ne: null } } },
            {
                $group: {
                    _id: "$product",
                    avg: { $avg: "$rating" },
                    count: { $sum: 1 },
                }
            }
        ]);

        if (!stats.length) return { average: 0, count: 0 };

        return {
            average: stats[0].avg,
            count: stats[0].count
        };
    }
}

module.exports = new ReviewRepository();
