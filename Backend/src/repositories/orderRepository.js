// src/repositories/orderRepository.js
const Order = require("../models/Order");

class orderRepository {
  // ============= CRUD CƠ BẢN (nếu bạn cần) =============
  async create(orderData) {
    const order = new Order(orderData);
    return await order.save();
  }

  async findById(id) {
    return await Order.findById(id)
      .populate("user")
      .populate("address")
      .populate("discount_code");
  }

  async findAll(filter = {}) {
    return await Order.find(filter)
      .populate("user")
      .populate("address")
      .populate("discount_code");
  }

  async updateById(id, updateData) {
    return await Order.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteById(id) {
    return await Order.findByIdAndDelete(id);
  }

  // ========== DÙNG CHO DASHBOARD ==========

  /**
   * Đếm số đơn hàng trong khoảng thời gian
   * @param {string} startDate - "YYYY-MM-DD"
   * @param {string} endDate   - "YYYY-MM-DD"
   */
  async countOrdersInRange(startDate, endDate) {
    return await Order.countDocuments({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
  }

  /**
   * Tổng doanh thu trong khoảng thời gian
   * Ở đây mình ưu tiên dùng final_amount (sau giảm giá),
   * nếu không có thì fallback về total_amount.
   */
  async sumRevenueInRange(startDate, endDate) {
    const result = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          current_status: { $in: ["confirmed", "shipping", "delivered"] }, // chỉ tính đơn hợp lệ
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $ifNull: ["$final_amount", false] },
                "$final_amount",
                "$total_amount",
              ],
            },
          },
        },
      },
    ]);

    return result.length > 0 ? result[0].totalRevenue : 0;
  }

  /**
   * Top sản phẩm bán chạy trong khoảng thời gian
   * Group theo items.product_variant_sku
   * @param {string} startDate
   * @param {string} endDate
   * @param {number} limit
   */
  async getBestSellingProducts(startDate, endDate, limit = 5) {
    const rows = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          current_status: { $in: ["confirmed", "shipping", "delivered"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product_variant_sku",
          totalQuantitySold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$items.quantity", "$items.price_at_purchase"],
            },
          },
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productVariantSku: "$_id",
          totalQuantitySold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    // Ở đây mình trả về theo sku; nếu bạn có model Variant/Product
    // và muốn lấy thêm tên sản phẩm thì có thể join thêm ở service.
    return rows;
  }

  // Bạn có thể thêm các hàm cho Advanced Dashboard:
  // getMonthlySummary, getQuarterlySummary, getWeeklySummary, getProductComparisonByQuarter...
}

module.exports = new orderRepository();
