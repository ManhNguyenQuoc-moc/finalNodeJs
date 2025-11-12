// repositories/ProductRepository.js
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductColor = require("../models/ProductColor");
const ProductSize = require("../models/ProductSize");
const { toSlug } = require("../utils/slug");

class ProductRepository {
  // -------------------- PRODUCT --------------------
  async createProduct(productData, session) {
    const product = new Product(productData);
    return await product.save({ session });
  }
  async existsSlug(slug, excludeId = null, { session } = {}) {
    const filter = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
    const doc = await Product.findOne(filter).select("_id").session(session || null);
    return !!doc;
  }
  async findById(productId, { session } = {}) {
    let q = Product.findById(productId).populate("brand category");
    if (session) q = q.session(session);
    return q;
  }

  async findOne(query) {
    return Product.findOne(query);
  }

  async findAll(filter, options = {}) {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit
    const products = await Product.find(filter)
      .populate("brand category")
      .sort(sort)
      .skip(skip)
      .limit(limit);
    const total = await Product.countDocuments(filter);
    return { products, total, page, limit };
  }

  async updateProduct(productId, updateData, session) {
    const plain = updateData.toObject ? updateData.toObject() : updateData;
    return Product.findByIdAndUpdate(
      productId,
      { $set: plain },
      { new: true, session, runValidators: true }
    ).populate("brand category");
  }
  async normalizeAndEnsureUniqueSlug(inputSlug, excludeId = null, { session } = {}) {
    const base = toSlug(inputSlug || "");
    if (!base) throw new Error("Slug is required");

    let candidate = base;
    let suffix = 2;

    while (await this.existsSlug(candidate, excludeId, { session })) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
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


  async findVariantById(variantId, { session } = {}) {
    let q = ProductVariant.findById(variantId).populate("color size");
    if (session) q = q.session(session);
    return q;
  }

  async updateVariant(variantId, updateData, session) {
    const plain = updateData.toObject ? updateData.toObject() : updateData;
    return ProductVariant.findByIdAndUpdate(
      variantId,
      { $set: plain },
      { new: true, session, runValidators: true }
    ).populate("color size");
  }

  async deleteVariant(variantId, session) {
    return ProductVariant.findByIdAndDelete(variantId, { session });
  }
  async pullProductImages(productId, publicIds = [], session) {
    if (!publicIds.length) return;
    return Product.updateOne(
      { _id: productId },
      { $pull: { images: { public_id: { $in: publicIds } } } },
      { session }
    );
  }

  async pushProductImages(productId, images = [], session) {
    if (!images.length) return;
    // nếu muốn tránh trùng hoàn toàn object:
    return Product.updateOne(
      { _id: productId },
      { $push: { images: { $each: images } } },
      { session }
    );
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
  async findAllWithStats(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      // optional: selectFields = null, // nếu muốn giới hạn fields
    } = options;

    // Chuẩn hóa sort để tránh key rỗng gây lỗi
    const sortObj =
      sort && typeof sort === "object" && Object.keys(sort).length
        ? sort
        : { createdAt: -1 };

    const skip = (page - 1) * limit;

    // 1) Query products
    const products = await Product.find(filter)
      // .select(selectFields || "")   // nếu cần
      .populate("brand category")
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(); // dùng lean để thao tác nhanh trên object thường

    const total = await Product.countDocuments(filter);

    if (!products.length) {
      return {
        products: [],
        total,
        page: Number(page),
        limit: Number(limit),
      };
    }

    // 2) Query variants cho tất cả product trong 1 lần
    const productIds = products.map((p) => p._id);
    const variants = await ProductVariant.find(
      { product: { $in: productIds } },
      { sku: 1, price: 1, stock_quantity: 1, images: 1, product: 1 }
    ).lean();

    // 3) Group variants theo productId để tính stats
    const byProduct = new Map(); // productId -> array variants
    for (const v of variants) {
      const key = String(v.product);
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(v);
    }

    // 4) Build “cover” + đại diện 1 variant + stats
    const shaped = products.map((p) => {
      const key = String(p._id);
      const pv = byProduct.get(key) || []; // always array

      // cover = image is_primary đầu tiên; fallback ảnh đầu tiên
      let cover = null;
      for (const v of pv) {
        const primary = (v.images || []).find((img) => img.is_primary);
        if (primary) { cover = primary.url; break; }
      }
      if (!cover && pv[0]?.images?.[0]?.url) {
        cover = pv[0].images[0].url;
      }

      const prices = pv.map((v) => v.price || 0);
      const stocks = pv.map((v) => v.stock_quantity || 0);

      const variants_count = pv.length;
      const price_min = prices.length ? Math.min(...prices) : 0;
      const price_max = prices.length ? Math.max(...prices) : 0;
      const stock_total = stocks.reduce((s, x) => s + x, 0);

      // 1 biến thể đại diện giống demo
      const representative =
        pv[0] && {
          sku: pv[0].sku,
          price: pv[0].price,
          stock_quantity: pv[0].stock_quantity,
        };

      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        brand: p.brand?._id || p.brand,       // giữ _id để khớp UI của bạn
        category: p.category?._id || p.category,
        productStatus: p.productStatus,
        short_description: p.short_description,
        long_description: p.long_description,
        variants_count,
        price_min,
        price_max,
        stock_total,
        cover,
        variants: representative ? [representative] : [],
      };
    });

    return {
      products: shaped,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
  async findOneWithVariantsAndStats(productId) {
    const product = await Product.findById(productId)
      .populate("brand category")
      .lean();

    if (!product) return null;

    const variants = await ProductVariant.find({ product: productId }).lean();

    let cover = null;
    for (const v of variants) {
      const primary = (v.images || []).find((img) => img.is_primary);
      if (primary) { cover = primary.url; break; }
    }
    if (!cover && variants[0]?.images?.[0]?.url) {
      cover = variants[0].images[0].url;
    }

    return {
      ...product,
      variants,
      variants_count: variants.length,
      price_min: variants.length ? Math.min(...variants.map((v) => v.price || 0)) : 0,
      price_max: variants.length ? Math.max(...variants.map((v) => v.price || 0)) : 0,
      stock_total: variants.reduce((s, v) => s + (v.stock_quantity || 0), 0),
      cover,
    };
  }
}

module.exports = new ProductRepository();
