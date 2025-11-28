const express = require("express");
const router = express.Router();
const controller = require("../controllers/address.controller");
const { requireAuth } = require("../middleware/authMiddleware"); // Đảm bảo bạn import đúng middleware check login

// Tất cả API này đều yêu cầu đăng nhập
router.use(requireAuth);

router.get("/", controller.getList); // Lấy danh sách
router.post("/", controller.create); // Thêm mới
router.put("/:id", controller.update); // Sửa
router.delete("/:id", controller.delete); // Xóa
router.post("/:id/default", controller.setDefault); // Đặt mặc định

module.exports = router;
