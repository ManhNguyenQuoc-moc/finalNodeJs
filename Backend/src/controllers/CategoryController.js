const categoryService = require("../services/CategoryService");

class CategoryController {
  async create(req, res) {
    try {
      const category = await categoryService.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const categories = await categoryService.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const category = await categoryService.getCategoryById(req.params.id);
      res.json(category);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      res.json(category);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      await categoryService.deleteCategory(req.params.id);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }
}

module.exports = new CategoryController();
