// src/controllers/page.controller.js
const { money } = require("../utils/format");
const { Brand, Category, Product, ProductVariant, Review } = require("../models");
const { normalizeProductsColors } = require("../services/productService");

exports.health = (_req, res) => res.send("API is running...");

exports.categories = async (_req, res) => {
  const cats = await Category.find().select("_id name slug image").lean();
  res.json({ ok: true, categories: cats || [] });
};

exports.minicart = async (req, res) => {
  const user = req.currentUser;
  const where = user ? { user_id: user._id } : { session_id: req.cookies.sid };
  const cart = await require("../models").Cart.findOne(where).lean().catch(() => null);

  const items = cart?.items || [];
  const cartCount = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const total = items.reduce((s, it) => s + (it.price_at_time * it.quantity), 0);

  res.json({
    ok: true,
    carts: items,
    cartCount,
    total,
    formattedTotal: money(total),
    user: user ? { id: user._id, email: user.email, full_name: user.full_name } : null,
  });
};

exports.home = async (_req, res) => {
  const latestRaw = await Product.find().sort({ createdAt: -1 }).limit(8).lean();
  const trendingRaw = await Product.find({ "productStatus.statusName": "Trending" }).limit(8).lean();
  const popularRaw = await Product.find({ "productStatus.statusName": "Bán chạy" }).limit(8).lean();

  const [latest, trending, popular] = await Promise.all([
    normalizeProductsColors(latestRaw),
    normalizeProductsColors(trendingRaw),
    normalizeProductsColors(popularRaw),
  ]);

  res.json({ ok: true, latest, trending, popular, products: latest });
};

exports.categoryAll = async (req, res) => {
  const { sort, brand, q } = req.query;

  const filter = {};
  if (brand) {
    const b = await Brand.findOne({ slug: brand }).lean();
    if (b) filter.brand = b._id;
  }
  if (q) filter.name = { $regex: q, $options: "i" };

  let query = Product.find(filter).populate("brand category");

  if (sort === "price_asc" || sort === "price_desc") {
    const pv = await ProductVariant.aggregate([{ $group: { _id: "$product", minPrice: { $min: "$price" } } }]);
    const priceMap = new Map(pv.map(x => [x._id.toString(), x.minPrice]));
    const productsRaw = await query.lean();
    const withMin = productsRaw.map(p => ({ p, price: priceMap.get(p._id.toString()) ?? 0 }));
    withMin.sort((a, b) => sort === "price_asc" ? (a.price - b.price) : (b.price - a.price));
    const products = await normalizeProductsColors(withMin.map(x => x.p));
    return res.json({ ok: true, products });
  }

  const productsRaw = await query.sort({ createdAt: -1 }).lean();
  const products = await normalizeProductsColors(productsRaw);
  return res.json({ ok: true, products });
};

exports.categoryById = async (req, res) => {
  const cat = await Category.findById(req.params.id).lean();
  if (!cat) return res.status(400).json({ ok: false, redirect: "/category/alls" });

  const productsRaw = await Product.find({ category: cat._id }).populate("brand category").lean();
  const products = await normalizeProductsColors(productsRaw);
  res.json({ ok: true, category: cat, products });
};

exports.search = async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ ok: true, products: [], q: "" });

  const productsRaw = await Product.find({
    $or: [
      { name: { $regex: q, $options: "i" } },
      { slug: { $regex: q, $options: "i" } },
      { short_description: { $regex: q, $options: "i" } },
    ],
  }).populate("brand category").lean();

  const products = await normalizeProductsColors(productsRaw);
  res.json({ ok: true, products, q });
};

exports.productDetail = async (req, res) => {
  const { Product } = require("../models");

  const p = await Product.findById(req.params.id)
    .populate("brand category")
    .lean();

  if (!p) return res.status(404).json({ ok: false, message: "Not found" });

  const variants = await ProductVariant.find({ product: p._id })
    .populate("color size")
    .lean();

  // ========= LẤY HÌNH ẢNH =========
  const imgs = [];
  for (const v of variants) {
    if (Array.isArray(v.images)) {
      for (const im of v.images) {
        imgs.push(typeof im === "string" ? im : (im?.url || null));
      }
    }
  }
  const allImagesRaw = Array.from(new Set(imgs.filter(Boolean)));
  const allImages = allImagesRaw.length ? allImagesRaw : ["/images/default.png"];
  while (allImages.length > 0 && allImages.length < 3) allImages.push(allImages[0]);
  const thumbImages = allImages.slice(0, Math.min(6, allImages.length));

  // ========= SIZE MAP =========
  const sizeMap = new Map();
  for (const v of variants) {
    const s = v.size;
    if (!s?._id) continue;
    const key = String(s._id);
    if (!sizeMap.has(key)) {
      sizeMap.set(key, {
        size_id: key,
        name: s.size_name,
        sku: v.sku || null,
        stock: v.stock_quantity ?? null,
        price: v.price ?? null,
      });
    }
  }
  const productSizes = Array.from(sizeMap.values());

  // ========= COLOR MAP =========
  const colorMap = new Map();
  for (const v of variants) {
    const c = v.color;
    if (!c?._id) continue;
    const key = String(c._id);
    if (!colorMap.has(key)) {
      colorMap.set(key, {
        color_id: { _id: c._id, color_name: c.color_name },
        color_code: c.color_code || "",
        imageUrls: [],
      });
    }
    const urls = (v.images || [])
      .map(im => (typeof im === "string" ? im : (im?.url || null)))
      .filter(Boolean);
    colorMap.get(key).imageUrls.push(...urls);
  }

  const productColors = Array.from(colorMap.values()).map(c => ({
    ...c,
    imageUrls: Array.from(new Set(c.imageUrls)),
  }));

  // ========= TÍNH price_min / price_max / stock_total =========
  const prices = variants
    .map(v => Number(v.price))
    .filter(n => Number.isFinite(n) && n >= 0);

  let price_min = null;
  let price_max = null;

  if (prices.length) {
    price_min = Math.min(...prices);
    price_max = Math.max(...prices);
  }

  const stock_total = variants.reduce(
    (sum, v) => sum + Number(v.stock_quantity || 0),
    0
  );
  // ========= LẤY REVIEW VÀ TÍNH rating_avg / rating_count =========

  const reviews = await Review.find({ product: p._id })
    .sort({ createdAt: -1 })
    .populate("user", "full_name email")
    .select("_id comment rating user guest_name guest_email sentiment sentiment_score ai_label parent_id likes guest_likes images createdAt")
    .lean();

  // Add likes_count and is_liked for each review
  const currentUserId = req.currentUser?._id?.toString();
  let guestIdentifier = null;
  if (!currentUserId) {
    // Try to get IP address
    const ip = req.ip || 
              (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
              req.connection?.remoteAddress ||
              req.socket?.remoteAddress ||
              'anonymous';
    // Use session ID if available, otherwise use IP
    guestIdentifier = req.sessionID || ip;
  }
  
  reviews.forEach(review => {
    const userLikes = review.likes ? review.likes.length : 0;
    const guestLikes = review.guest_likes ? review.guest_likes.length : 0;
    review.likes_count = userLikes + guestLikes;
    
    if (currentUserId) {
      // Logged-in user: check if user ID is in likes array
      review.is_liked = review.likes 
        ? review.likes.some(likeId => likeId.toString() === currentUserId)
        : false;
    } else if (guestIdentifier) {
      // Guest: check if IP/session is in guest_likes array
      review.is_liked = review.guest_likes 
        ? review.guest_likes.includes(guestIdentifier)
        : false;
    } else {
      review.is_liked = false;
    }
    
    // Remove arrays from response to reduce payload size
    delete review.likes;
    delete review.guest_likes;
  });

  // CHỈ tính những review có rating (rating != null và rating > 0)
  const ratingNumbers = reviews
    .map(r => r.rating != null ? Number(r.rating) : null)
    .filter(n => n != null && Number.isFinite(n) && n > 0 && n <= 5);

  const ratingCount = ratingNumbers.length;
  const ratingAvg = ratingCount > 0
    ? ratingNumbers.reduce((a, b) => a + b, 0) / ratingCount
    : 0;

  // ========= TÍNH SENTIMENT STATS =========
  // dùng aggregate để gom theo sentiment + tính avg sentiment_score
  const mongoose = require("mongoose");
  const pid = new mongoose.Types.ObjectId(p._id);

  const sentimentAgg = await Review.aggregate([
    { $match: { product: pid } },
    {
      $group: {
        _id: { $ifNull: ["$sentiment", null] },
        count: { $sum: 1 },
      }
    }
  ]);

  const sentimentScoreAgg = await Review.aggregate([
    { $match: { product: pid } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: "$sentiment_score" },
      }
    }
  ]);

  const sentimentStats = { positive: 0, neutral: 0, negative: 0, null: 0 };
  for (const s of sentimentAgg) {
    const key = s._id || "null";
    if (sentimentStats[key] !== undefined) {
      sentimentStats[key] = s.count;
    } else {
      sentimentStats[key] = s.count;
    }
  }

  const sentimentScoreAvg = sentimentScoreAgg.length
    ? sentimentScoreAgg[0].avgScore || 0
    : 0;
  // ========= GỘP THÀNH OBJECT product HOÀN CHỈNH =========
  const product = {
    ...p,
    colors: (productColors.length
      ? productColors
      : [{ color_id: null, color_code: "", imageUrls: allImages }]),
    price_min,
    price_max,
    stock_total,
  };

  // ========= LẤY SẢN PHẨM LIÊN QUAN (cùng category, loại trừ sản phẩm hiện tại) =========
  let relatedProducts = [];
  if (p.category && p.category._id) {
    const relatedRaw = await Product.find({
      category: p.category._id,
      _id: { $ne: p._id }, // Loại trừ sản phẩm hiện tại
    })
      .populate("brand category productStatus")
      .limit(12)
      .sort({ createdAt: -1 }) // Sắp xếp theo sản phẩm mới nhất
      .lean();
    
    relatedProducts = await normalizeProductsColors(relatedRaw);
  }

  return res.json({
    ok: true,
    product: {
      ...p,
      price_min,
      price_max,
      stock_total,
      colors: productColors, // nếu bạn muốn trả ra
      avg_rating: Number(ratingAvg.toFixed(1)), // Thêm avg_rating vào product
      rating_count: ratingCount, // Thêm rating_count vào product
      comment_count: reviews.length, // Tổng số reviews (kể cả không có rating)
    },
    variants,
    allImages,
    thumbImages,
    productSizes,
    reviews,
    rating: {
      average: ratingAvg,
      count: ratingCount,
      sentiment: sentimentStats,
      sentimentScoreAvg: sentimentScoreAvg,
    },
    products: relatedProducts,
  });
};

// --- ACCOUNT PAGES JSON ---
exports.accountProfile = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { _id, email, full_name, role, loyalty_points, createdAt } = req.currentUser;
  res.json({ ok: true, user: { id: _id, email, full_name, role, loyalty_points, createdAt } });
};
exports.accountAddresses = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const Address = require("../models/Address");
  const addresses = await Address.find({ user: req.currentUser._id }).lean();
  res.json({ ok: true, addresses });
};

exports.accountOrders = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { Order } = require("../models");
  const orders = await Order.find({ user: req.currentUser._id }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, orders });
};

exports.accountOrdersFilter = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { Order } = require("../models");
  const { status } = req.query;
  const where = { user: req.currentUser._id };
  if (status) where.current_status = status;
  const orders = await Order.find(where).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, orders });
};

exports.orderDetails = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { Order } = require("../models");
  const order = await Order.findOne({ _id: req.params.id, user: req.currentUser._id }).lean();
  if (!order) return res.status(404).json({ ok: false });
  res.json({ ok: true, order });
};

exports.accountVouchers = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { DiscountCode } = require("../models");
  const vouchers = await DiscountCode.find({ is_active: true }).lean().catch(() => []);
  res.json({ ok: true, vouchers: vouchers || [] });
};

exports.accountPoints = async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const points = req.currentUser.loyalty_points || 0;
  res.json({ ok: true, points });
};

