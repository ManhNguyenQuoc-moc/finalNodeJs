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

        //  B1: Aggregate rating - CHỈ tính những review có rating (rating != null và rating > 0)
        const ratingAgg = await Review.aggregate([
            { 
                $match: { 
                    product: pid, 
                    rating: { $ne: null, $exists: true, $gt: 0, $lte: 5 }
                } 
            },
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

        const sentimentStats = { positive: 0, neutral: 0, negative: 0, null: 0 };

        sentimentAgg.forEach(item => {
            const key = item._id === null ? 'null' : item._id;
            if (sentimentStats.hasOwnProperty(key)) {
                sentimentStats[key] = item.count;
            }
        });

        return {
            average: ratingAgg.length ? Number((ratingAgg[0].avg || 0).toFixed(1)) : 0,
            count: ratingAgg.length ? ratingAgg[0].count : 0,
            averageRating: ratingAgg.length ? Number((ratingAgg[0].avg || 0).toFixed(1)) : 0, // Backward compatibility
            countRating: ratingAgg.length ? ratingAgg[0].count : 0, // Backward compatibility
            sentiment: sentimentStats,
            sentimentScoreAvg:
                sentimentScoreAgg.length ? sentimentScoreAgg[0].avgScore : 0
        };
    }
    async toggleLike(reviewId, userId, guestIdentifier) {
        const review = await Review.findById(reviewId);
        if (!review) {
            throw new Error("Review not found");
        }

        if (userId) {
            // Logged-in user
            const likes = review.likes || [];
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const isLiked = likes.some(likeId => likeId.toString() === userId.toString());

            if (isLiked) {
                // Unlike: remove user from likes array
                review.likes = likes.filter(likeId => likeId.toString() !== userId.toString());
            } else {
                // Like: add user to likes array
                review.likes.push(userObjectId);
            }
        } else if (guestIdentifier) {
            // Guest user (using IP or session ID)
            const guestLikes = review.guest_likes || [];
            const isLiked = guestLikes.includes(guestIdentifier);

            if (isLiked) {
                // Unlike: remove guest identifier from guest_likes array
                review.guest_likes = guestLikes.filter(id => id !== guestIdentifier);
            } else {
                // Like: add guest identifier to guest_likes array
                review.guest_likes.push(guestIdentifier);
            }
        } else {
            throw new Error("Invalid like request");
        }

        await review.save();
        const totalLikes = (review.likes?.length || 0) + (review.guest_likes?.length || 0);
        const isLikedNow = userId 
            ? (review.likes || []).some(likeId => likeId.toString() === userId.toString())
            : (review.guest_likes || []).includes(guestIdentifier);

        return {
            likes_count: totalLikes,
            is_liked: isLikedNow
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
