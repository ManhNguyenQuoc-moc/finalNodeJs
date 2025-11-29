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
    const start = new Date(startDate);
    const end = new Date(endDate + "T23:59:59.999Z");

    const rows = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          // nếu muốn loại đơn bị huỷ thì dùng:
          // current_status: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.product_variant_sku": { $exists: true, $ne: null },
          "items.quantity": { $gt: 0 },
        },
      },
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

    return rows;
  }
  // ================== THÊM MỚI TỪ ĐÂY TRỞ XUỐNG ==================

  /**
   * Doanh thu & lợi nhuận theo thời gian để vẽ chart
   * params: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", granularity: "year"|"month"|"week"|"custom" }
   */
 async getRevenueAndProfitOverTime({ startDate, endDate, granularity }) {
    const start = new Date(startDate);
    const end = new Date(endDate + "T23:59:59.999Z");

    const match = {
      createdAt: { $gte: start, $lte: end },
      // current_status: { $nin: ["cancelled", "refunded"] },
    };

    let groupId;

    switch (granularity) {
      case "year":
        groupId = { year: { $year: "$createdAt" } };
        break;
      case "month":
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      default:
        groupId = {
          day: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
        };
    }

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: groupId,
          revenue: {
            $sum: {
              $cond: [
                { $ifNull: ["$final_amount", false] },
                "$final_amount",
                {
                  $cond: [
                    { $ifNull: ["$total_amount", false] },
                    "$total_amount",
                    {
                      $multiply: ["$items.quantity", "$items.price_at_purchase"],
                    },
                  ],
                },
              ],
            },
          },
          cost: {
            $sum: {
              $multiply: [
                "$items.quantity",
                { $ifNull: ["$items.import_price", 0] },
              ],
            },
          },
        },
      },
      {
        $project: {
          label: {
            $cond: [
              "$_id.day",
              "$_id.day",
              {
                $cond: [
                  "$_id.month",
                  {
                    $concat: [
                      { $toString: "$_id.year" },
                      "-",
                      {
                        $toString: "$_id.month",
                      },
                    ],
                  },
                  { $toString: "$_id.year" },
                ],
              },
            ],
          },
          revenue: 1,
          profit: { $subtract: ["$revenue", "$cost"] },
          _id: 0,
        },
      },
      { $sort: { label: 1 } },
    ]);

    return rows;
  }

  /**
   * Số đơn theo thời gian (ordersCount) cho chart bar
   * params: { startDate, endDate, granularity }
   */
  async getOrdersCountOverTime({ startDate, endDate, granularity }) {
    const start = new Date(startDate);
    const end = new Date(endDate + "T23:59:59.999Z");

    const match = {
      createdAt: { $gte: start, $lte: end },
      // current_status: { $in: ["confirmed", "shipping", "delivered"] },
    };

    let groupId;

    switch (granularity) {
      case "year":
        groupId = { year: { $year: "$createdAt" } };
        break;
      case "month":
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
      case "week":
        groupId = {
          year: { $isoWeekYear: "$createdAt" },
          week: { $isoWeek: "$createdAt" },
        };
        break;
      default:
        groupId = {
          day: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
        };
        break;
    }

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          ordersCount: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.week": 1,
          "_id.day": 1,
        },
      },
    ]);

    return rows.map((r) => {
      let label;

      if (r._id.day) {
        label = r._id.day;
      } else if (r._id.week) {
        label = `Tuần ${r._id.week}/${r._id.year}`;
      } else if (r._id.month) {
        label = `${String(r._id.month).padStart(2, "0")}/${r._id.year}`;
      } else if (r._id.year) {
        label = String(r._id.year);
      } else {
        label = "";
      }

      return {
        label,
        ordersCount: r.ordersCount || 0,
      };
    });
  }

  async getOrdersInRange(startDate, endDate) {
    // Có thể filter chỉ các đơn đã giao thành công:
    // current_status: 'delivered'
    return Order.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      },
      // current_status: 'delivered'
    }).lean();
  }
  // Bạn có thể thêm các hàm cho Advanced Dashboard:
  // getMonthlySummary, getQuarterlySummary, getWeeklySummary, getProductComparisonByQuarter...
}

module.exports = new orderRepository();
