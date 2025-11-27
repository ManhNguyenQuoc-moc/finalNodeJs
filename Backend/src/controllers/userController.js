// controllers/userController.js
const userService = require("../services/userService");
const { hashPassword } = require("../utils/hash");

// ========== ADMIN: USER MANAGEMENT ==========

// GET /api/users  (admin xem tất cả user)
exports.getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id  (admin xem chi tiết user)
exports.getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users  (admin tạo user mới)
exports.createUser = async (req, res) => {
  try {
    const { email, full_name, password, role } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({
        success: false,
        message: "full_name và email là bắt buộc",
      });
    }

    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    }

    const userData = {
      email,
      full_name,
      role: role || "customer",
      provider: "local",
      is_verified: true,
    };

    if (password) {
      userData.password_hash = await hashPassword(password);
    }

    const user = await userService.createUser(userData);

    return res.status(201).json({ success: true, user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id  (admin cập nhật user)
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    // adminId có thể lấy từ req.currentUser nếu bạn dùng JWT:
    const adminId = req.currentUser?.id || req.user?._id;

    const updateData = { ...req.body };
    delete updateData.password_hash;

    const updated = await userService.adminUpdateUser(adminId, userId, updateData);
    if (!updated) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.json({ success: true, user: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id  (admin xoá user)
exports.deleteUser = async (req, res) => {
  try {
    const deleted = await userService.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }
    return res.json({ success: true, message: "Xoá user thành công" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/ban
exports.banUser = async (req, res) => {
  try {
    const adminId = req.currentUser?.id || req.user?._id;
    const userId = req.params.id;

    const user = await userService.banUser(adminId, userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.json({ success: true, message: "Đã ban user", user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/unban
exports.unbanUser = async (req, res) => {
  try {
    const adminId = req.currentUser?.id || req.user?._id;
    const userId = req.params.id;

    const user = await userService.unbanUser(adminId, userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.json({ success: true, message: "Đã gỡ ban user", user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ========== USER PROFILE ==========

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/account/profile  (user cập nhật thông tin cá nhân)
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const updated = await userService.updateProfile(userId, req.body);
    return res.json({ success: true, user: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ========== ĐỊA CHỈ GIAO HÀNG ==========

// GET /api/account/addresses
exports.getMyAddresses = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const addresses = await userService.getAddresses(userId);
    return res.json({ success: true, addresses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/account/addresses
exports.addMyAddress = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const address = await userService.addAddress(userId, req.body);
    return res.status(201).json({ success: true, address });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/account/addresses/:id
exports.updateMyAddress = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const addrId = req.params.id;
    const address = await userService.updateAddress(userId, addrId, req.body);
    return res.json({ success: true, address });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/account/addresses/:id
exports.deleteMyAddress = async (req, res) => {
  try {
    const userId = req.currentUser?.id || req.user?._id || req.cookies?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }

    const addrId = req.params.id;
    await userService.deleteAddress(userId, addrId);
    return res.json({ success: true, message: "Xoá địa chỉ thành công" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
// GET /api/user/:id/details
exports.getUserDetailsAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const { user, addresses, orders } = await userService.getUserDetailsForAdmin(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.json({
      success: true,
      user,
      addresses,
      orders,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/user/:id/addresses (admin xem địa chỉ user bất kỳ)
exports.getAddressesOfUserAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const addresses = await userService.getAddresses(userId);
    return res.json({ success: true, addresses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
// POST /api/user/:id/addresses (admin thêm địa chỉ cho user bất kỳ)
exports.adminAddAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const address = await userService.addAddress(userId, req.body);
    return res.status(201).json({ success: true, address });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
// PUT /api/user/:userId/addresses/:addressId (admin update địa chỉ)
exports.adminUpdateAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const updated = await userService.adminUpdateAddress(addressId, req.body);
    return res.json({ success: true, address: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

