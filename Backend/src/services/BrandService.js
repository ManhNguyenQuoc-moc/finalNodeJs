const brandRepo = require("../repositories/BrandRepository");

class BrandService {
  async createBrand(data) {
    const brand = await brandRepo.findOne({ name: data.name })
    if (!brand) {return brandRepo.create(data);}
    throw new Error("Brand not found");
  }
  
  async getAllBrands() {
    return brandRepo.findAll();
  }

  async getBrandById(id) {
    const brand = await brandRepo.findById(id);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }

  async updateBrand(id, data) {
    const brand = await brandRepo.update(id, data);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }

  async deleteBrand(id) {
    const brand = await brandRepo.delete(id);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }
}

module.exports = new BrandService();
