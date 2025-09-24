const categoryRepo = require("../repositories/CategoryRepository");

class CategoryService {
  async createCategory(data) {
    return categoryRepo.create(data);
  }

  async getAllCategories() {
    return categoryRepo.findAll();
  }

  async getCategoryById(id) {
    const category = await categoryRepo.findById(id);
    if (!category) throw new Error("Category not found");
    return category;
  }

  async updateCategory(id, data) {
    const category = await categoryRepo.update(id, data);
    if (!category) throw new Error("Category not found");
    return category;
  }

  async deleteCategory(id) {
    const category = await categoryRepo.delete(id);
    if (!category) throw new Error("Category not found");
    return category;
  }
}

module.exports = new CategoryService();
