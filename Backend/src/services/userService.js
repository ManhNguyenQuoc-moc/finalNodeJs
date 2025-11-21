const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");
const addressRepository = require("../repositories/addressRepository");
class userService {

  async createUser(userData) {
    return await userRepository.create(userData);
  }

  async getAllUsers() {
    return await userRepository.findAll();
  }

  async getUserByEmail(email) {
    return await userRepository.findByEmail(email);
  }

  async getUserById(id) {
    return await userRepository.findById(id);
  }
  async banUser(adminId, userId) {
    return await userRepository.setBanStatus(userId, true);
  }
  async unbanUser(adminId, userId) {
    return await userRepository.setBanStatus(userId, false);
  }
  async adminUpdateUser(adminId, userId, updateData) {
    delete updateData.password_hash;
    return await userRepository.updateById(userId, updateData);
  }
  async updateProfile(userId, data) {
    const allowedFields = ["full_name", "phone", "gender", "birthday"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });

    return await userRepository.updateById(userId, updateData);
  }

  async deleteUser(id) {
    return await userRepository.deleteById(id);
  }
  async getTotalUsers() {
    return await userRepository.getTotalUsers();
  }
  async getNewUsersInRange(startDate, endDate) {
    return await userRepository.getNewUsersInRange(startDate, endDate);
  }
  // ========== ĐỊA CHỈ GIAO HÀNG ==========

  async getAddresses(userId) {
    return await addressRepository.findByUser(userId);
  }

  async addAddress(userId, data) {
    if (data.is_default) {
      await addressRepository.unsetDefaultForUser(userId);
    }

    return await addressRepository.create({
      ...data,
      user: userId,
    });
  }

  async updateAddress(userId, addressId, data) {
    const address = await addressRepository.findById(addressId);
    if (!address || address.user.toString() !== userId.toString()) {
      throw new Error("Địa chỉ không tồn tại hoặc không thuộc về user");
    }

    if (data.is_default) {
      await addressRepository.unsetDefaultForUser(userId);
    }

    return await addressRepository.updateById(addressId, data);
  }

  async deleteAddress(userId, addressId) {
    const address = await addressRepository.findById(addressId);
    if (!address || address.user.toString() !== userId.toString()) {
      throw new Error("Địa chỉ không tồn tại hoặc không thuộc về user");
    }

    return await addressRepository.deleteById(addressId);
  }
}

module.exports = new userService();
