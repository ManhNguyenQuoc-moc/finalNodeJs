const Color = require("../models/ProductColor");

class ColorRepository {
  async create(data) {
    const Color = new ProductColor(data);
    return Color.save();
  }

  async findAll() {
    return Color.find();
  }

  async findById(id) {
    return Color.findById(id);
  }

  async update(id, data) {
    return Color.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return Color.findByIdAndDelete(id);
  }
}

module.exports = new ColorRepository();
