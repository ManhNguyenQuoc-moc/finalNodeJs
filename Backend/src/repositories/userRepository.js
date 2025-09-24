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

  // Tìm user theo ID
  async findById(id) {
    return await User.findById(id).select("-password_hash");
  }

  // Update user
  async updateById(id, updateData) {
    return await User.findByIdAndUpdate(id, updateData, { new: true });
  }

  // Xóa user
  async deleteById(id) {
    return await User.findByIdAndDelete(id);
  }
}
module.exports = new UserRepository();
