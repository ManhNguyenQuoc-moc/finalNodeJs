require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const passport = require("passport");
require("./config/passport");
require("express-async-errors");

const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

// routers/middlewares
const authRoutes = require("./routes/auth.js");
const routes = require("./routes/routes.js"); // router tổng của bạn
const errorMiddleware = require("./middleware/errorMiddleware.js");

// models
const {
  Brand, Category, Product, ProductColor, ProductSize,
  ProductVariant, Cart, User, Order, DiscountCode
} = require("./models");

const app = express();

/* =========================
  Middlewares cơ bản
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

/* =========================
  Helpers + session cookie
========================= */
const fmtVND = new Intl.NumberFormat("vi-VN");
const money = (n) => `${fmtVND.format(Number(n || 0))} đ`;

function ensureSession(req, res, next) {
  if (!req.cookies.sid) {
    const sid = (crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    res.cookie("sid", sid, { httpOnly: true, sameSite: "lax" });
    req.cookies.sid = sid;
  }
  next();
}

async function loadUser(req, _res, next) {
  req.currentUser = null;
  const uid = req.cookies.uid;
  if (uid) {
    try {
      const u = await User.findById(uid).lean();
      if (u) req.currentUser = u;
    } catch {}
  }
  next();
}

app.use(ensureSession, loadUser);

/* =========================
  Test route
========================= */
app.get("/", (_req, res) => res.send("API is running..."));

/* =========================
  Chuẩn hoá colors/images
========================= */
async function normalizeProductsColors(products) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const ids = products.map(p => p?._id).filter(Boolean);
  const variants = await ProductVariant.find({ product: { $in: ids } })
    .populate("color")
    .lean();

  const byProduct = new Map();
  for (const v of variants) {
    const pid = String(v.product);
    const colorId = v.color?._id ? String(v.color._id) : "no-color";
    const urlList = (v.images || [])
      .map(im => (typeof im === "string" ? im : im?.url))
      .filter(Boolean);

    if (!byProduct.has(pid)) byProduct.set(pid, new Map());
    const byColor = byProduct.get(pid);

    if (!byColor.has(colorId)) {
      byColor.set(colorId, {
        color: v.color?.color_name || "Default",
        color_id: v.color ? { _id: v.color._id, color_name: v.color.color_name } : null,
        color_code: v.color?.color_code || "",
        imageUrls: []
      });
    }
    byProduct.get(pid).get(colorId).imageUrls.push(...urlList);
  }

  for (const p of products) {
    const key = String(p?._id || "");
    const byColor = byProduct.get(key);

    const fallbackImg =
      (Array.isArray(p?.images) && (p.images[0]?.url || p.images[0])) ||
      "/images/default.png";

    if (byColor && byColor.size) {
      const arr = Array.from(byColor.values()).map(c => ({
        ...c,
        imageUrls: Array.from(new Set(c.imageUrls)).length
          ? Array.from(new Set(c.imageUrls))
          : [fallbackImg],
      }));
      p.colors = arr;
    } else {
      p.colors = [{
        color: "Default",
        color_id: null,
        color_code: "",
        imageUrls: [fallbackImg],
      }];
    }

    p.short_description = (p.short_description || p.long_description || "").trim();
    p.avg_rating = Number((p.avg_rating || 0).toFixed(1));
    p.rating_count = p.rating_count || 0;

    if (p.price == null) {
      const mine = variants
        .filter(v => String(v.product) === key && typeof v.price === "number")
        .map(v => v.price);
      if (mine.length) p.price = Math.min(...mine);
    }
  }

  return products;
}

/* =========================
  HEADER data
========================= */
app.get("/api/page/categories", async (_req, res) => {
  const cats = await Category.find().select("_id name slug").lean();
  res.json({ ok: true, categories: cats || [] });
});

app.get("/api/page/minicart", async (req, res) => {
  const user = req.currentUser;
  const where = user ? { user_id: user._id } : { session_id: req.cookies.sid };
  const cart = await Cart.findOne(where).lean().catch(() => null);

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
});

/* =========================
  HOME / CATEGORY / SEARCH
========================= */
app.get("/api/page/home", async (_req, res) => {
  const latestRaw   = await Product.find().sort({ createdAt: -1 }).limit(8).lean();
  const trendingRaw = await Product.find({ "productStatus.statusName": "Trending" }).limit(8).lean();
  const popularRaw  = await Product.find({ "productStatus.statusName": "Bán chạy" }).limit(8).lean();

  const [latest, trending, popular] = await Promise.all([
    normalizeProductsColors(latestRaw),
    normalizeProductsColors(trendingRaw),
    normalizeProductsColors(popularRaw),
  ]);

  res.json({ ok: true, latest, trending, popular, products: latest });
});

app.get("/api/page/category/alls", async (req, res) => {
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
});

app.get("/api/page/category/:id", async (req, res) => {
  const cat = await Category.findById(req.params.id).lean();
  if (!cat) return res.status(400).json({ ok: false, redirect: "/category/alls" });

  const productsRaw = await Product.find({ category: cat._id }).populate("brand category").lean();
  const products = await normalizeProductsColors(productsRaw);
  res.json({ ok: true, category: cat, products });
});

app.get("/api/page/search", async (req, res) => {
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
});

/* =========================
  PRODUCT DETAIL
========================= */
app.get("/api/page/product/:id", async (req, res) => {
  const p = await Product.findById(req.params.id).populate("brand category").lean();
  if (!p) return res.status(404).json({ ok: false, message: "Not found" });

  const variants = await ProductVariant.find({ product: p._id })
    .populate("color size")
    .lean();

  // gom ảnh
  const imgs = [];
  for (const v of variants) {
    if (Array.isArray(v.images)) {
      for (const im of v.images) imgs.push(typeof im === "string" ? im : (im?.url || null));
    }
  }
  const allImagesRaw = Array.from(new Set(imgs.filter(Boolean)));
  const allImages = allImagesRaw.length ? allImagesRaw : ["/images/default.png"];
  while (allImages.length > 0 && allImages.length < 3) allImages.push(allImages[0]);
  const thumbImages = allImages.slice(0, Math.min(6, allImages.length));

  // sizes
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

  // colors
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
    const urls = (v.images || []).map(im => (typeof im === "string" ? im : (im?.url || null))).filter(Boolean);
    colorMap.get(key).imageUrls.push(...urls);
  }
  const productColors = Array.from(colorMap.values()).map(c => ({
    ...c,
    imageUrls: Array.from(new Set(c.imageUrls)),
  }));

  const product = { ...p, colors: (productColors.length ? productColors : [{ color_id: null, color_code: "", imageUrls: allImages }]) };

  return res.json({
    ok: true,
    product,
    variants,
    allImages,
    thumbImages,
    productSizes,
    reviews: [],
    products: [],
    colors: product.colors,
  });
});

/* =========================
  AUTH form-style (cookie uid)
========================= */
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const email = req.body.username?.trim();
    const password = req.body.password || "";
    const user = await User.findOne({ email }).exec();
    if (!user || !user.password_hash) {
      return res.status(401).json({ ok: false, error: "Email hoặc mật khẩu không đúng!" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Email hoặc mật khẩu không đúng!" });
    res.cookie("uid", user._id.toString(), { httpOnly: true, sameSite: "lax" });
    return res.status(200).json({ ok: true, user: { id: user._id, email: user.email, full_name: user.full_name } });
  } catch {
    return res.status(500).json({ ok: false, error: "Có lỗi khi đăng nhập" });
  }
});

app.post("/register", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const name = req.body.register_name?.trim() || "User";
    const email = req.body.register_email?.trim();
    const phone = req.body.register_phone?.trim() || null;
    const address = req.body.register_address?.trim() || null;
    const pw = req.body.register_password || "";
    const confirm = req.body.register_confirmPassword || "";

    if (!email || !pw || pw !== confirm) {
      return res.status(400).json({ ok: false, error: "Thông tin chưa hợp lệ" });
    }
    const existed = await User.findOne({ email }).exec();
    if (existed) return res.status(400).json({ ok: false, error: "Email đã tồn tại" });

    const hash = await bcrypt.hash(pw, 10);
    const u = await User.create({ email, full_name: name, password_hash: hash, role: "customer", is_verified: true });

    if (address) {
      const Address = require("./models/Address");
      await Address.create({ user: u._id, address_line: address, is_default: true });
    }
    return res.status(200).json({ ok: true, message: "Đăng ký thành công" });
  } catch {
    return res.status(500).json({ ok: false, error: "Có lỗi khi đăng ký" });
  }
});

app.get("/logout", async (_req, res) => {
  res.clearCookie("uid");
  return res.status(200).json({ ok: true });
});

/* =========================
  CART helpers
========================= */
async function getOrCreateCart(req) {
  if (req.currentUser) {
    let c = await Cart.findOne({ user_id: req.currentUser._id });
    if (!c) c = await Cart.create({ user_id: req.currentUser._id, items: [] });
    return c;
  } else {
    let c = await Cart.findOne({ session_id: req.cookies.sid });
    if (!c) c = await Cart.create({ session_id: req.cookies.sid, items: [] });
    return c;
  }
}

// Thay thế toàn bộ hàm addItemToCart cũ bằng hàm dưới
async function addItemToCart({ cart, variant, qty }) {
  const product = await Product.findById(variant.product).lean();
  const color = variant.color ? await ProductColor.findById(variant.color).lean() : null;
  const size  = variant.size  ? await ProductSize.findById(variant.size).lean()   : null;

  const quantityToAdd = Math.max(1, Number(qty || 1));

  // Snapshots để hiển thị
  const name_snapshot = product?.name || "Sản phẩm";
  const size_name_snapshot  = size?.size_name || null;
  const color_name_snapshot = color?.color_name || null;

  const newItem = {
    product_id: variant.product,
    variant_sku: variant.sku,
    name_snapshot,
    price_at_time: Number(variant.price || 0),
    quantity: quantityToAdd,
    color_name_snapshot,
    size_name_snapshot,
    img_snapshot:
      (Array.isArray(variant.images) && (variant.images[0]?.url || variant.images[0])) ||
      (Array.isArray(product?.images) && (product.images[0]?.url || product.images[0])) ||
      null,
    color_id_snapshot: color?._id || null,
    size_id_snapshot: size?._id || null,
  };

  // ====== Gộp item nếu TRÙNG: TÊN + MÀU + SIZE ======
  // Ưu tiên so sánh theo id, fallback sang tên nếu id thiếu
  const keyOf = (it) => [
    String(it.product_id || ""),
    String(it.color_id_snapshot || ""),
    String(it.size_id_snapshot || ""),
    (it.name_snapshot || "").trim().toLowerCase(),
    // fallback key theo text phòng trường hợp không có id
    (it.color_name_snapshot || "").trim().toLowerCase(),
    (it.size_name_snapshot || "").trim().toLowerCase(),
  ].join("|");

  const newKey = keyOf(newItem);

  const idx = (cart.items || []).findIndex((it) => keyOf(it) === newKey);

  if (idx > -1) {
    // đã có -> tăng số lượng
    cart.items[idx].quantity = Number(cart.items[idx].quantity || 0) + quantityToAdd;
  } else {
    // chưa có -> thêm dòng mới
    cart.items.push(newItem);
  }

  await cart.save();
  return idx > -1 ? cart.items[idx] : newItem;
}

// 🔎 CHÍNH: tìm variant theo sku / (product+size+color) / fallback
async function findVariant({ variant_sku, product_id, size_id, color_id }) {
  if (variant_sku) {
    const v = await ProductVariant.findOne({ sku: variant_sku }).lean();
    if (v) return v;
  }
  if (!product_id) return null;

  const q = { product: product_id };
  if (size_id)  q.size  = size_id;
  if (color_id) q.color = color_id;

  let v = await ProductVariant.findOne(q).lean();
  if (v) return v;

  if (size_id && !color_id)  v = await ProductVariant.findOne({ product: product_id, size: size_id }).lean();
  if (!v && color_id && !size_id) v = await ProductVariant.findOne({ product: product_id, color: color_id }).lean();

  if (!v) v = await ProductVariant.findOne({ product: product_id }).sort({ price: 1 }).lean();
  return v;
}

/* =========================
  CART routes
========================= */
app.post("/add-to-cart", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { variant_sku, product_id, size_id, color_id, quantity } = req.body || {};
    const variant = await findVariant({ variant_sku, product_id, size_id, color_id });
    if (!variant) throw new Error("Variant not found");
    const cart = await getOrCreateCart(req);
    await addItemToCart({ cart, variant, qty: quantity });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message || "Add to cart failed" });
  }
});

app.post("/api/cart/add", async (req, res) => {
  try {
    const { variant_sku, product_id, size_id, color_id, quantity } = req.body || {};
    const variant = await findVariant({ variant_sku, product_id, size_id, color_id });
    if (!variant) throw new Error("Variant not found");
    const cart = await getOrCreateCart(req);
    await addItemToCart({ cart, variant, qty: quantity });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

app.post("/cart/update/:idx", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    const qty = Math.max(1, Number(req.body.quantity || 1));
    const where = req.currentUser ? { user_id: req.currentUser._id } : { session_id: req.cookies.sid };
    const cart = await Cart.findOne(where);
    if (!cart || !cart.items[idx]) return res.status(404).json({ ok: false });
    cart.items[idx].quantity = qty;
    await cart.save();
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false });
  }
});

app.post("/cart/remove/:idx", async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    const where = req.currentUser ? { user_id: req.currentUser._id } : { session_id: req.cookies.sid };
    const cart = await Cart.findOne(where);
    if (!cart || !cart.items[idx]) return res.status(404).json({ ok: false });
    cart.items.splice(idx, 1);
    await cart.save();
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false });
  }
});

app.post("/shop-cart/submit", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    if (!req.currentUser) return res.status(401).json({ ok: false, message: "Need login" });

    const cart = await Cart.findOne({ user_id: req.currentUser._id });
    if (!cart || !cart.items.length) return res.status(400).json({ ok: false, message: "Cart empty" });

    const total = cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0);

    const order = await Order.create({
      user: req.currentUser._id,
      items: cart.items.map(it => ({
        product_variant_sku: it.variant_sku,
        quantity: it.quantity,
        price_at_purchase: it.price_at_time,
      })),
      total_amount: total,
      final_amount: total,
      loyalty_points_used: 0,
      loyalty_points_earned: Math.floor(total / 100000),
      current_status: "pending",
      status_history: [{ status: "pending", timestamp: new Date() }],
    });

    cart.items = [];
    await cart.save();

    return res.status(200).json({ ok: true, order_id: order._id });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

/* =========================
  Account pages JSON
========================= */
app.get("/api/page/account/profile", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { _id, email, full_name, role, loyalty_points, createdAt } = req.currentUser;
  res.json({ ok: true, user: { id: _id, email, full_name, role, loyalty_points, createdAt } });
});

app.get("/api/page/account/addresses", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const Address = require("./models/Address");
  const addresses = await Address.find({ user: req.currentUser._id }).lean();
  res.json({ ok: true, addresses });
});

app.get("/api/page/account/orders", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const orders = await Order.find({ user: req.currentUser._id }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, orders });
});

app.get("/api/page/account/orders/filter", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const { status } = req.query;
  const where = { user: req.currentUser._id };
  if (status) where.current_status = status;
  const orders = await Order.find(where).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, orders });
});

app.get("/api/page/orders/:id/details", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const order = await Order.findOne({ _id: req.params.id, user: req.currentUser._id }).lean();
  if (!order) return res.status(404).json({ ok: false });
  res.json({ ok: true, order });  
});

app.get("/api/page/account/vouchers", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const vouchers = await DiscountCode.find({ is_active: true }).lean().catch(() => []);
  res.json({ ok: true, vouchers: vouchers || [] });
});

app.get("/api/page/account/points", async (req, res) => {
  if (!req.currentUser) return res.json({ redirectToLogin: true });
  const points = req.currentUser.loyalty_points || 0;
  res.json({ ok: true, points });
});

/* =========================
  Mount routers riêng
  (để KHÔNG đè /api/page/*)
========================= */
app.use("/api/auth", authRoutes); // đăng nhập MXH, vv
app.use("/api/v1", routes);       // router tổng của bạn

/* =========================
  Error handler CUỐI CÙNG
========================= */
app.use(errorMiddleware);

module.exports = app;
