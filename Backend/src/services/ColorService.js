const colorrepo = require("../repositories/ColorRepository");

class BrandService {
  async createBrand(data) {
    return colorrepo.create(data);
  }

  async getAllBrands() {
    return colorrepo.findAll();
  }

  async getBrandById(id) {
    const brand = await colorrepo.findById(id);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }

  async updateBrand(id, data) {
    const brand = await colorrepo.update(id, data);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }

  async deleteBrand(id) {
    const brand = await colorrepo.delete(id);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }
}

module.exports = new BrandService();
