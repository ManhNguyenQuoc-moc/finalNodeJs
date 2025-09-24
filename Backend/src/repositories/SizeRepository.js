const Size = require("../models/ProductSize");

class SizeRepository {
  async create(data) {
    const Size = new ProductColor(data);
    return Size.save();
  }
  async findAll() {
    return Size.find();
  }
  async findById(id) {
    return Size.findById(id);
  }

  async update(id, data) {
    return Size.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return Size.findByIdAndDelete(id);
  }
}

module.exports = new SizeRepository();
