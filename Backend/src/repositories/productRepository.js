// repositories/ProductRepository.js
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductColor = require("../models/ProductColor");
const ProductSize = require("../models/ProductSize");

class ProductRepository {
  // -------------------- PRODUCT --------------------
  async createProduct(productData, session) {
     const product = new Product(productData);
    return await product.save({ session });
  }

  async findById(productId) {
    return Product.findById(productId).populate("brand category");
  }

  async findOne(query) {
    return Product.findOne(query);
  }

  async findAll(filter, options = {}) {
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

  // -------------------- VARIANT --------------------
  async createVariant(variantData, session) {
    const variant = new ProductVariant(variantData);
    return variant.save({ session });
  }

 async findVariantsByProduct(productId, session = null) {
  let query = ProductVariant.find({ product: productId }).populate("color size");
  if (session) query = query.session(session);
  return query;
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

  // -------------------- COLOR --------------------
  async findColorByName(color_name) {
    return ProductColor.findOne({ color_name });
  }

  async createColor(colorData, session) {
    return ProductColor.create(colorData, { session });
  }

  async findColorById(colorId) {
    return ProductColor.findById(colorId);
  }

  // -------------------- SIZE --------------------
  async findSizeByName(size_name) {
    return ProductSize.findOne({ size_name });
  }

  async createSize(sizeData, session) {
    return ProductSize.create(sizeData, { session });
  }

  async findSizeById(sizeId) {
    return ProductSize.findById(sizeId);
  }
}

module.exports = new ProductRepository();
