const Address = require("../models/Address");

class AddressRepository {
  async create(addressData) {
    const address = new Address(addressData);
    return await address.save();
  }

  async findByUser(userId) {
    return await Address.find({ user: userId }).sort({
      is_default: -1,
      createdAt: -1,
    });
  }

  async findById(id) {
    return await Address.findById(id);
  }

  async updateById(id, updateData) {
    return await Address.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteById(id) {
    return await Address.findByIdAndDelete(id);
  }

  async unsetDefaultForUser(userId) {
    return await Address.updateMany({ user: userId }, { is_default: false });
  }
}

module.exports = new AddressRepository();
