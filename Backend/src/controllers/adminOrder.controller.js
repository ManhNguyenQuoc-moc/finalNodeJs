// src/controllers/adminOrder.controller.js
const adminOrderService = require("../services/adminOrder.service");

class AdminOrderController {
  // GET /api/admin/orders
  async getList(req, res) {
    try {
      const data = await adminOrderService.getList(req.query);
      res.json({ success: true, ...data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // GET /api/admin/orders/:id
  async getDetail(req, res) {
    try {
      const order = await adminOrderService.getDetail(req.params.id);
      res.json({ success: true, order });
    } catch (e) {
      res.status(404).json({ success: false, message: e.message });
    }
  }

  // PUT /api/admin/orders/:id/status
  async updateStatus(req, res) {
    try {
      await adminOrderService.updateStatus(req.params.id, req.body.status);
      res.json({ success: true, message: "Cập nhật thành công" });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
}

module.exports = new AdminOrderController();
