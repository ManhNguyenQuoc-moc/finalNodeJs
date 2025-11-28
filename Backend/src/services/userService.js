// src/services/userService.js
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");
const addressRepository = require("../repositories/addressRepository");
const orderRepository = require("../repositories/orderRepository"); // 🔥 THÊM DÒNG NÀY

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

 async  updateProfile(userId, data) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("User không tồn tại");
  }

  const updateData = {};
  let hasChanges = false;

  // 1. full_name
  if (
    data.full_name !== undefined &&
    data.full_name !== user.full_name
  ) {
    updateData.full_name = data.full_name;
    hasChanges = true;
  }

  // 2. gender
  if (
    data.gender !== undefined &&
    data.gender !== user.gender
  ) {
    updateData.gender = data.gender;
    hasChanges = true;
  }

  // 3. birthday (data.birthday là Date hoặc string YYYY-MM-DD)
  if (data.birthday !== undefined) {
    const incoming =
      data.birthday instanceof Date
        ? data.birthday
        : new Date(data.birthday);

    const current = user.birthday ? new Date(user.birthday) : null;

    const changed =
      !current ||
      current.getTime() !== incoming.getTime();

    if (changed) {
      updateData.birthday = incoming;
      hasChanges = true;
    }
  }

  // 4. email – cho phép đổi nhưng phải unique
  if (
    data.email !== undefined &&
    data.email !== user.email
  ) {
    const existingEmail = await userRepository.findOne({
      email: data.email,
      _id: { $ne: userId },
    });
    if (existingEmail) {
      throw new Error("Email đã được sử dụng bởi tài khoản khác");
    }
    updateData.email = data.email;
    hasChanges = true;
  }

  // 5. phone – cho phép đổi nhưng phải unique
  if (
    data.phone !== undefined &&
    data.phone !== user.phone
  ) {
    const existingPhone = await userRepository.findOne({
      phone: data.phone,
      _id: { $ne: userId },
    });
    if (existingPhone) {
      throw new Error("Số điện thoại đã được sử dụng bởi tài khoản khác");
    }
    updateData.phone = data.phone;
    hasChanges = true;
  }

  // Nếu không có gì thay đổi thì trả lại user luôn
  if (!hasChanges) {
    return user;
  }

  // Update
  const updatedUser = await userRepository.updateById(userId, updateData);
  return updatedUser;
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
  async getUserDetailsForAdmin(userId) {
    const [user, addresses, orders] = await Promise.all([
      userRepository.findById(userId),
      addressRepository.findByUser(userId),
      orderRepository.findAll({ user: userId }),
    ]);

    return { user, addresses, orders };
  }
  async adminUpdateAddress(addressId, data) {
    const address = await addressRepository.findById(addressId);
    if (!address) {
      throw new Error("Địa chỉ không tồn tại");
    }

    if (data.is_default) {
      await addressRepository.unsetDefaultForUser(address.user);
    }

    return await addressRepository.updateById(addressId, data);
  }
}

module.exports = new userService();
