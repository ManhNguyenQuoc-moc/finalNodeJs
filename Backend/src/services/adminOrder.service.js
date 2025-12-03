// src/services/adminOrder.service.js
const orderRepository = require("../repositories/orderRepository");
const Order = require("../models/Order"); // Import Model để update status

class AdminOrderService {
  async getList(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const status = query.status;

    const { orders, total } = await orderRepository.getAdminOrders({
      page,
      limit,
      status,
    });

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDetail(id) {
    const order = await orderRepository.getAdminOrderDetail(id);
    if (!order) throw new Error("Đơn hàng không tồn tại");
    return order;
  }

  async updateStatus(id, newStatus) {
    // Validate status
    const validStatuses = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new Error("Trạng thái không hợp lệ");
    }

    // Logic update dùng Mongoose trực tiếp hoặc qua Repo đều được
    const order = await Order.findById(id);
    if (!order) throw new Error("Không tìm thấy đơn hàng");

    order.current_status = newStatus;
    order.status_history.push({
      status: newStatus,
      timestamp: new Date(),
    });

    return await order.save();
  }
}

module.exports = new AdminOrderService();
