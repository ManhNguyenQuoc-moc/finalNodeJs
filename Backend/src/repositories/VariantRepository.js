const Variant = require("../models/ProductVariant");

class VariantRepository {
  async create(data) {
    const variant = new Brand(data);
    return variant.save();
  }

  async findAll() {
    return variant.find();
  }

  async findById(id) {
    return variant.findById(id);
  }

  async update(id, data) {
    return variant.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return variant.findByIdAndDelete(id);
  }
}

module.exports = new VariantRepository();
