const ProductColor = require("../models/ProductColor");

class ColorRepository {

  async create(data) {
    const color = new ProductColor(data);
    return color.save();
  }

  async findAll() {
    return ProductColor.find();
  }

  async findById(id) {
    return ProductColor.findById(id);
  }

  async update(id, data) {
    return ProductColor.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return ProductColor.findByIdAndDelete(id);
  }
}

module.exports = new ColorRepository();
