const Category = require("../models/Category");

class CategoryRepository {
  async create(data) {
    const category = new Category(data);
    return category.save();
  }

  async findAll() {
    return Category.find();
  }

  async findById(id) {
    return Category.findById(id);
  }

  async update(id, data) {
    return Category.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return Category.findByIdAndDelete(id);
  }
}

module.exports = new CategoryRepository();
