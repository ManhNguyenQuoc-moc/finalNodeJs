// repositories/ProductRepository.js
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductColor = require("../models/ProductColor");
const ProductSize = require("../models/ProductSize");

class ProductRepository {
  async createProduct(productData, session) {
    return Product.create([productData], { session });
  }

  async findById(productId) {
    return Product.findById(productId).populate("brand category");
  }

  async findOne(query) {
    return Product.findOne(query);
  }

  async findAll(filter, options) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate("brand category")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    return { products, total, page, limit };
  }

  async updateProduct(productId, updateData, session) {
    return Product.findByIdAndUpdate(productId, updateData, { new: true, session }).populate(
      "brand category"
    );
  }

  async deleteProduct(productId, session) {
    return Product.findByIdAndDelete(productId, { session });
  }

  async createVariant(variantData, session) {
    return ProductVariant.create([variantData], { session });
  }

  async findVariantsByProduct(productId) {
    return ProductVariant.find({ product: productId }).populate("color size");
  }

  async findVariantById(variantId) {
    return ProductVariant.findById(variantId).populate("color size");
  }

  async updateVariant(variantId, updateData, session) {
    return ProductVariant.findByIdAndUpdate(variantId, updateData, { new: true, session }).populate(
      "color size"
    );
  }

  async deleteVariant(variantId, session) {
    return ProductVariant.findByIdAndDelete(variantId, { session });
  }

  async findColorByName(color_name) {
    return ProductColor.findOne({ color_name });
  }

  async createColor(colorData, session) {
    return ProductColor.create([colorData], { session });
  }

  async findSizeByName(size_name) {
    return ProductSize.findOne({ size_name });
  }

  async createSize(sizeData, session) {
    return ProductSize.create([sizeData], { session });
  }
  async findColorById(colorId) {
    return ProductColor.findById(colorId);
  }
  async findSizeById(sizeId) {
    return ProductSize.findById(sizeId);
  }
}

module.exports = new ProductRepository();