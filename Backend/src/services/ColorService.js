const colorrepo = require("../repositories/ColorRepository");

class ColorService {
  async createColor(data) {
    return colorrepo.create(data);
  }

  async getAllBrands() {
    return colorrepo.findAll();
  }

  async getColorById(id) {
    const brand = await colorrepo.findById(id);
    if (!brand) throw new Error("Color not found");
    return brand;
  }

  async updateColor(id, data) {
    const brand = await colorrepo.update(id, data);
    if (!brand) throw new Error("Color not found");
    return brand;
  }

  async deleteColor(id) {
    const brand = await colorrepo.delete(id);
    if (!brand) throw new Error("Color not found");
    return brand;
  }
}

module.exports = new ColorService();
