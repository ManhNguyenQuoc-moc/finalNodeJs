const Variant = require("../models/ProductVariant");

class VariantRepository {
  async create(data) {
    const variant = new Variant(data);
    return variant.save();
  }

  async findAll() {
    return Variant.find();
  }

  async findById(id) {
    return Variant.findById(id);
  }

  async update(id, data) {
    return Variant.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return Variant.findByIdAndDelete(id);
  }
  async findBySku(sku) {
    return Variant.findOne({ sku }).lean();
  }
  async increaseStock(productVariantId, quantity, session = null) {
    return Variant.findByIdAndUpdate(
      productVariantId,
      { $inc: { stock_quantity: quantity } },
      { new: true, session }
    );
  }
}

module.exports = new VariantRepository();
