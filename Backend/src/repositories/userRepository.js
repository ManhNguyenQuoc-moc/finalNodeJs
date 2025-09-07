// src/repositories/userRepository.js
const User = require("../models/User");

class UserRepository {
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async findAll() {
    return await User.find().select("-password");
  }

  async findByEmail(email) {
    return await User.findOne({ email });
  }
}

module.exports = new UserRepository();
