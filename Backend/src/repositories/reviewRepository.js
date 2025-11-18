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
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return this._emptyStats();
        }

        const pid = new mongoose.Types.ObjectId(productId);

        //  B1: Aggregate rating
        const ratingAgg = await Review.aggregate([
            { $match: { product: pid, rating: { $ne: null } } },
            {
                $group: {
                    _id: "$product",
                    avg: { $avg: "$rating" },
                    count: { $sum: 1 }
                }
            }
        ]);

        //  B2: Aggregate sentiment
        const sentimentAgg = await Review.aggregate([
            { $match: { product: pid } },
            {
                $group: {
                    _id: "$sentiment",
                    count: { $sum: 1 }
                }
            }
        ]);

        //  B3: Aggregate sentiment score
        const sentimentScoreAgg = await Review.aggregate([
            { $match: { product: pid } },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: "$sentiment_score" }
                }
            }
        ]);

        const sentimentStats = { positive: 0, neutral: 0, negative: 0 };

        sentimentAgg.forEach(item => {
            sentimentStats[item._id] = item.count;
        });

        return {
            averageRating: ratingAgg.length ? ratingAgg[0].avg : 0,
            countRating: ratingAgg.length ? ratingAgg[0].count : 0,
            sentiment: sentimentStats,
            sentimentScoreAvg:
                sentimentScoreAgg.length ? sentimentScoreAgg[0].avgScore : 0
        };
    }
    _emptyStats() {
        return {
            averageRating: 0,
            countRating: 0,
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            sentimentScoreAvg: 0
        };
    }
}

module.exports = new ReviewRepository();
