const sizerepo = require("../repositories/SizeRepository");

class SizeService {
  async createSize(data) {
    return sizerepo.create(data);
  }

  async getAllSizes() {
    return sizerepo.findAll();
  }

  async getSizeById(id) {
    const brand = await sizerepo.findById(id);
    if (!brand) throw new Error("Size not found");
    return brand;
  }

  async updateSize(id, data) {
    const brand = await sizerepo.update(id, data);
    if (!brand) throw new Error("Size not found");
    return brand;
  }

  async deleteSize(id) {
    const brand = await sizerepo.delete(id);
    if (!brand) throw new Error("Size not found");
    return brand;
  }
}

module.exports = new SizeService();
