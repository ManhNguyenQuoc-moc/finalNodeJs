const Brand = require("../models/Brand");

class BrandRepository {
  async create(data) {
    const brand = new Brand(data);
    return brand.save();
  }

  async findAll() {
    return Brand.find();
  }

  async findById(id) {
    return Brand.findById(id);
  }

  async update(id, data) {
    return Brand.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return Brand.findByIdAndDelete(id);
  }
}

module.exports = new BrandRepository();
