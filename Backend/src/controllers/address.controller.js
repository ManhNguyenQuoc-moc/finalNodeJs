const addressService = require("../services/address.service");

class AddressController {
  // GET /api/address
  async getList(req, res) {
    try {
      const userId = req.currentUser._id;
      const addresses = await addressService.getList(userId);
      res.json({ ok: true, addresses });
    } catch (e) {
      res.status(500).json({ ok: false, message: e.message });
    }
  }

  // POST /api/address
  async create(req, res) {
    try {
      const userId = req.currentUser._id;
      // Body cần: city, district, ward, detail, is_default (optional)
      const newAddr = await addressService.addAddress(userId, req.body);
      res
        .status(201)
        .json({
          ok: true,
          address: newAddr,
          message: "Thêm địa chỉ thành công",
        });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  }

  // PUT /api/address/:id
  async update(req, res) {
    try {
      const userId = req.currentUser._id;
      const updated = await addressService.updateAddress(
        userId,
        req.params.id,
        req.body
      );
      res.json({ ok: true, address: updated, message: "Cập nhật thành công" });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  }

  // DELETE /api/address/:id
  async delete(req, res) {
    try {
      const userId = req.currentUser._id;
      await addressService.deleteAddress(userId, req.params.id);
      res.json({ ok: true, message: "Xóa địa chỉ thành công" });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  }

  // POST /api/address/:id/default
  async setDefault(req, res) {
    try {
      const userId = req.currentUser._id;
      await addressService.setDefault(userId, req.params.id);
      res.json({ ok: true, message: "Đã đặt làm mặc định" });
    } catch (e) {
      res.status(400).json({ ok: false, message: e.message });
    }
  }
}

module.exports = new AddressController();
