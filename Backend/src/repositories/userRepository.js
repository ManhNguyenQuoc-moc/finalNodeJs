// src/repositories/userRepository.js
const User = require("../models/User");

class UserRepository {
  // Tạo user mới
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  // Lấy tất cả user (ẩn password)
  async findAll() {
    return await User.find().select("-password_hash");
  }

  // Tìm user theo email
  async findByEmail(email) {
    return await User.findOne({ email });
  }
  async findOne(filter) {
    return await User.findOne(filter);
  }
  // Tìm user theo ID
  async findById(id) {
    return await User.findById(id).select("-password_hash");
  }
  // ====== THÊM MỚI: dùng cho auth (cần password_hash) ======

  async findByIdWithPassword(id) {
    return await User.findById(id); // không select, giữ nguyên password_hash
  }

  async findByValidResetToken(token) {
    return await User.findOne({
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() },
    });
  }
  // Update user
  async updateById(id, updateData) {
    return await User.findByIdAndUpdate(id, updateData, { new: true });
  }
  async setBanStatus(id, isBanned) {
    return await User.findByIdAndUpdate(
      id,
      { is_banned: isBanned },
      { new: true }
    ).select("-password_hash");
  }

  // Xóa user
  async deleteById(id) {
    return await User.findByIdAndDelete(id);
  }

  // ================== DÙNG CHO DASHBOARD ==================

  // Tổng số user
  async getTotalUsers() {
    return await User.countDocuments({});
  }

  // Số user mới trong khoảng thời gian (dùng cho Simple Dashboard)
  async getNewUsersInRange(startDate, endDate) {
    return await User.countDocuments({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });
  }
}

module.exports = new UserRepository();
