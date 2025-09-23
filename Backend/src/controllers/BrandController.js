const brandService = require("../services/BrandService");

class BrandController {
  async create(req, res) {
    try {
      const brand = await brandService.createBrand(req.body);
      res.status(201).json(brand);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const brands = await brandService.getAllBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const brand = await brandService.getBrandById(req.params.id);
      res.json(brand);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const brand = await brandService.updateBrand(req.params.id, req.body);
      res.json(brand);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      await brandService.deleteBrand(req.params.id);
      res.json({ message: "Brand deleted successfully" });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }
}

module.exports = new BrandController();
