const Address = require("../models/Address");
class AddressRepository {
  // Tạo địa chỉ mới
  async create(addressData) {
    const address = new Address(addressData);
    return await address.save();
  }

  async findByUserId(userId) {
    return await Address.find({ user: userId });
  }
}

module.exports = new AddressRepository();
