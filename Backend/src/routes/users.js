// src/routes/users.js
const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/authMiddleware");
// Nếu có phân quyền admin:
// const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// ========== DEBUG PROFILE (có thể giữ hoặc bỏ) ==========
router.get("/profile", requireAuth, (req, res) => {
  res.json({
    message: "Profile fetched successfully",
    user: req.user,
  });
});

// ========== ADMIN: USER MANAGEMENT ==========
//
// Giả sử router này mount dưới /api/user:
//   app.use("/api/user", router);

// Lấy toàn bộ user
router.get(
  "/",
  // requireAuth,
  // requireRole("admin"),
  userController.getUsers
);

// Tạo user mới (admin)
router.post(
  "/",
  // requireAuth,
  // requireRole("admin"),
  userController.createUser
);

// Lấy chi tiết user (cơ bản)
router.get(
  "/:id",
  // requireAuth,
  // requireRole("admin"),
  userController.getUserById
);

// NEW: Lấy chi tiết user + địa chỉ + đơn hàng (cho admin)
// GET /api/user/:id/details
router.get(
  "/:id/details",
  // requireAuth,
  // requireRole("admin"),
  userController.getUserDetailsAdmin
);

// Cập nhật user
router.put(
  "/:id",
  // requireAuth,
  // requireRole("admin"),
  userController.updateUser
);

// Xoá user
router.delete(
  "/:id",
  // requireAuth,
  // requireRole("admin"),
  userController.deleteUser
);

// Ban / Unban
router.patch(
  "/:id/ban",
  // requireAuth,
  // requireRole("admin"),
  userController.banUser
);

router.patch(
  "/:id/unban",
  // requireAuth,
  // requireRole("admin"),
  userController.unbanUser
);

// ========== ADMIN: QUẢN LÝ ĐỊA CHỈ CỦA USER ==========
//
// GET /api/user/:id/addresses  (admin xem địa chỉ của user X)
router.get(
  "/:id/addresses",
  // requireAuth,
  // requireRole("admin"),
  userController.getAddressesOfUserAdmin
);

// POST /api/user/:id/addresses (admin thêm địa chỉ cho user X)
router.post(
  "/:id/addresses",
  // requireAuth,
  // requireRole("admin"),
  userController.adminAddAddress
);

// PUT /api/user/:userId/addresses/:addressId (admin update địa chỉ)
router.put(
  "/:userId/addresses/:addressId",
  // requireAuth,
  // requireRole("admin"),
  userController.adminUpdateAddress
);

// ========== USER PROFILE (TỰ XEM / TỰ SỬA) ==========
//
// Nếu muốn mount riêng dưới /api/account thì tách router,
// ở đây giữ chung cho đơn giản:

// GET /api/user/account/profile
router.get("/account/profile", requireAuth, userController.getMyProfile);

// PUT /api/user/account/profile
router.put("/account/profile", requireAuth, userController.updateMyProfile);

// GET /api/user/account/addresses
router.get("/account/addresses", requireAuth, userController.getMyAddresses);

// POST /api/user/account/addresses
router.post("/account/addresses", requireAuth, userController.addMyAddress);

// PUT /api/user/account/addresses/:id
router.put("/account/addresses/:id", requireAuth, userController.updateMyAddress);

// DELETE /api/user/account/addresses/:id
router.delete("/account/addresses/:id", requireAuth, userController.deleteMyAddress);

module.exports = router;
