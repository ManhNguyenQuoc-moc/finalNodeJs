const SizeModel = require("../models/ProductSize");

class SizeRepository {
  async create(data) {
    const size = new SizeModel(data);
    return size.save();
  }

  async findAll() {
    return SizeModel.find();
  }

  async findById(id) {
    return SizeModel.findById(id);
  }

  async update(id, data) {
    return SizeModel.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return SizeModel.findByIdAndDelete(id);
  }
}

module.exports = new SizeRepository();
