// app.js
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer   = require('multer');
const http     = require('http');
const { Server } = require('socket.io');

// Kết nối DB của bạn
const connectDB = require('./config/db');

// Import toàn bộ models từ /models
const {
  Brand,
  Cart,
  Category,
  DiscountCode,
  Order,
  Product,
  ProductColor,
  ProductSize,
  Review,
  User,
  Wishlist
} = require('./models');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

app.use(async (req, res, next) => {
  try {
    const user = req.session.user || null;
    const user_id = user?._id || null;

    let cartsDisplay = [];
    let cartTotal = 0;

    if (user_id) {
      // lấy giỏ từ Mongo
      const cartDoc = await Cart.findOne({ user_id }).lean();
      if (cartDoc?.items?.length) {
        cartsDisplay = cartDoc.items.map(it => ({
          productId: it.product_id,
          productName: it.name_snapshot,
          quantity: it.quantity,
          unitPrice: it.price_at_time,
          lineTotal: it.price_at_time * it.quantity,
          // TODO: thêm ảnh & size nếu muốn
        }));
        cartTotal = cartsDisplay.reduce((s, it) => s + it.lineTotal, 0);
      }
    } else {
      // guest: lấy giỏ trong session
      const items = req.session.cartItems || [];
      cartsDisplay = items.map(it => ({
        productId: it.product_id,
        productName: it.name_snapshot,
        quantity: it.quantity,
        unitPrice: it.price_at_time,
        lineTotal: it.price_at_time * it.quantity,
      }));
      cartTotal = cartsDisplay.reduce((s, it) => s + it.lineTotal, 0);
    }

    res.locals.carts = cartsDisplay;
    res.locals.cartCount = cartsDisplay.length;
    res.locals.total = cartTotal;
    res.locals.formattedTotal = cartTotal.toLocaleString('vi-VN') + ' đ';
  } catch (e) {
    res.locals.carts = [];
    res.locals.cartCount = 0;
    res.locals.total = 0;
    res.locals.formattedTotal = '0 đ';
  }
  next();
});



// helpers cho template
app.use((req, res, next) => {
  res.locals.formatPrice = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('vi-VN') + ' đ';
  };

  res.locals.sort        = req.query.sort || null;
  res.locals.color       = req.query.color || null;
  res.locals.price_range = req.query.price_range || '';
  res.locals.brand       = req.query.brand || '';
  res.locals.rating      = req.query.rating || '';
  res.locals.q           = req.query.q || '';
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/mixishop/images/categories/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const { Types } = mongoose;

const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login-register');
  next();
};

function isValidObjectId(id) {
  return Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === String(id);
}

// Tính rating cho nhiều product 1 lượt
async function getRatingsMap(productIds) {
  const rows = await Review.aggregate([
    { $match: { product_id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) }, rating: { $ne: null } } },
    { $group: { _id: '$product_id', count: { $sum: 1 }, avg: { $avg: '$rating' } } }
  ]);

  const map = {};
  for (const r of rows) {
    map[String(r._id)] = {
      avg: r.avg || 0,
      count: r.count || 0
    };
  }
  return map;
}

const getRenderData = async (req) => {
  const user = req.session.user || null;
  const user_id = user?._id || null;

  // lấy raw items
  let rawItems = [];
  if (user_id) {
    const cartDoc = await Cart.findOne({ user_id }).lean();
    rawItems = cartDoc?.items || [];
  } else {
    rawItems = req.session.cartItems || [];
  }

  // lấy tất cả product 1 lượt
  const pids = [...new Set(rawItems.map(it => String(it.product_id)))];
  const products = await Product.find({ _id: { $in: pids } }).lean();
  const byId = Object.fromEntries(products.map(p => [String(p._id), p]));

  // map sang cấu trúc cho view shop_cart.ejs
  const carts = rawItems.map((it, idx) => {
    const p = byId[String(it.product_id)];
    // product info
    const prod = p ? {
      id: p._id,
      name: p.name,
      price: typeof it.price_at_time === 'number' ? it.price_at_time : p.price
    } : { id: it.product_id, name: it.name_snapshot, price: it.price_at_time };

    // color/image
    let colorName = it.color_name_snapshot || '';
    let imageUrls = [];
    if (p && (p.colors || []).length) {
      let pc = p.colors.find(c =>
        (c.color_id?.color_name || c.color || '').toLowerCase() === colorName.toLowerCase()
      ) || p.colors[0];
      colorName = colorName || (pc.color_id?.color_name || pc.color || '');
      imageUrls = (pc.imageUrls || []).slice(0, 3);
    }
    if (!imageUrls.length && it.img_snapshot) imageUrls = [it.img_snapshot];

    return {
      id: idx,                               // dùng index cho /cart/update/:idx
      quantity: Number(it.quantity || 1),
      productColor: {
        product: prod,
        color: colorName || '—',
        imageUrls: imageUrls.length ? imageUrls : ['/images/default.png']
      },
      productSize: {
        size: it.size_name_snapshot || '—'
      }
    };
  });

  const total = carts.reduce((s, c) => s + c.productColor.product.price * c.quantity, 0);
  const orders  = user_id ? await Order.find({ user_id }).sort({ createdAt: -1 }).lean() : [];
  const categories = await Category.find().sort({ name: 1 }).lean();

  return {
    user,
    carts,                         // <<— TRUYỀN carts đã “chuẩn hoá”
    orders,
    categories,
    wishlistCount: 0,
    total,
    formattedTotal: total.toLocaleString('vi-VN') + ' đ',
    loggedInUser: !!user,
    isEmpty: carts.length === 0
  };
};




// Home
app.get(['/', '/home'], async (req, res) => {
  const raw = await Product.find().limit(12).lean();
  const ids = raw.map(p => p._id);
  const ratingMap = await getRatingsMap(ids);

  const products = raw.map(p => {
    const r = ratingMap[String(p._id)] || { avg: 0, count: 0 };
    return {
      ...p,
      short_description: p.short_description?.trim() || p.long_description || '',
      avg_rating: Number((p.avg_rating || r.avg || 0).toFixed(1)),
      rating_count: p.rating_count || r.count || 0
    };
  });

  res.render('home', {
    title: 'Trang chủ',
    products,
    ...(await getRenderData(req))
  });
});

// Category list (tất cả)
app.get('/category/alls', async (req, res) => {
  const { pageNo = 1, sort = null, price_range = '' } = req.query;

  let [min, max] = [0, 1e12];
  if (price_range) {
    const parts = price_range.split(',').map(Number);
    if (parts.length === 2) [min, max] = parts;
  }

  const sortMap = {
    a_z: { name: 1 },
    z_a: { name: -1 },
    price_low_to_high: { price: 1 },
    price_high_to_low: { price: -1 },
  };

  const page = Math.max(parseInt(pageNo, 10) || 1, 1);
  const pageSize = 12;
  const query = { price: { $gte: min, $lte: max } };

  // 👇 LẤY ĐỦ 3 KẾT QUẢ & ĐẶT TÊN ĐẦY ĐỦ
  const [rawItems, total, brandDocs] = await Promise.all([
    Product.find(query)
      .sort(sortMap[sort] || {})
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('brand_id')
      .populate('category_id')
      .lean(),
    Product.countDocuments(query),
    Brand.find({}, 'name').sort({ name: 1 }).lean(),
  ]);

  const items = rawItems.map(p => ({
    ...p,
    short_description: (p.short_description || p.long_description || '').trim(),
    avg_rating: Number((p.avg_rating || 0).toFixed(1)),
    rating_count: p.rating_count || 0,
    brand: p.brand_id ? { name: p.brand_id.name } : undefined,
    category: p.category_id ? { id: p.category_id._id, name: p.category_id.name } : undefined,
  }));

  res.render('category', {
    title: 'Tất cả sản phẩm',
    products: {
      content: items,
      number: page - 1,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
      hasPrevious: page > 1,
      hasNext: page * pageSize < total
    },
    brands: brandDocs.map(b => b.name), // 👈 danh sách brand CỐ ĐỊNH
    sort,
    price_range,
    selectedCategoryId: null,
    selectedCategoryName: 'Tất cả sản phẩm',
    ...(await getRenderData(req))
  });
});


// Category theo id
app.get('/category/:id', async (req, res) => {
  const rawId = req.params.id;
  const { pageNo = 1, sort = null, price_range = '' } = req.query;

  let [min, max] = [0, 1e12];
  if (price_range) {
    const parts = price_range.split(',').map(Number);
    if (parts.length === 2) [min, max] = parts;
  }

  const sortMap = {
    a_z: { name: 1 },
    z_a: { name: -1 },
    price_low_to_high: { price: 1 },
    price_high_to_low: { price: -1 },
  };
  const page = Math.max(parseInt(pageNo, 10) || 1, 1);
  const pageSize = 12;

  let query = { price: { $gte: min, $lte: max } };
  let selectedCategoryName = 'Danh mục';

  try {
    if (isValidObjectId(rawId)) {
      const cat = await Category.findById(rawId).lean();
      if (cat) selectedCategoryName = cat.name;
      query = { ...query, category_id: new Types.ObjectId(rawId) };
    } else {
      return res.redirect('/category/alls');
    }

    // 👇 Lấy sản phẩm + tổng + brands cố định
    const [rawItems, total, brandDocs] = await Promise.all([
      Product.find(query)
        .sort(sortMap[sort] || {})
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('brand_id')
        .populate('category_id')
        .lean(),
      Product.countDocuments(query),
      Brand.find({}, 'name').sort({ name: 1 }).lean(),
    ]);

    const items = rawItems.map(p => ({
      ...p,
      short_description: (p.short_description || p.long_description || '').trim(),
      avg_rating: Number((p.avg_rating || 0).toFixed(1)),
      rating_count: p.rating_count || 0,
      brand: p.brand_id ? { name: p.brand_id.name } : undefined,
      category: p.category_id ? { id: p.category_id._id, name: p.category_id.name } : undefined,
    }));

    res.render('categogy_collections', {
      title: `Danh mục ${selectedCategoryName}`,
      products: {
        content: items,
        number: page - 1,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
        hasPrevious: page > 1,
        hasNext: page * pageSize < total
      },
      brands: brandDocs.map(b => b.name), // 👈 luôn truyền xuống view
      sort,
      color: null,
      price_range,
      selectedCategoryId: rawId,
      selectedCategoryName,
      ...(await getRenderData(req))
    });
  } catch (e) {
    console.error('Category route error:', e);
    // vẫn lấy brand list để view không lỗi
    const brandDocs = await Brand.find({}, 'name').sort({ name: 1 }).lean();
    res.render('category', {
      title: 'Danh mục',
      products: { content: [], number: 0, totalPages: 1, hasPrevious: false, hasNext: false },
      brands: brandDocs.map(b => b.name),
      sort,
      color: null,
      price_range,
      selectedCategoryId: rawId,
      selectedCategoryName,
      ...(await getRenderData(req))
    });
  }
});


// Search (dựa trên text index của Product)
app.get('/search', async (req, res) => {
  const { keyword = '', pageNo = 1 } = req.query;
  const page = Math.max(parseInt(pageNo, 10) || 1, 1);
  const pageSize = 12;

  const q = keyword.trim();
  let query = {};
  if (q) query = { $text: { $search: q } };

  const [items, total] = await Promise.all([
    Product.find(query).skip((page - 1) * pageSize).limit(pageSize),
    Product.countDocuments(query)
  ]);

  res.render('product_search', {
    title: `Kết quả tìm kiếm: ${keyword}`,
    products: items,
    quantity: total,
    keyword,
    ...(await getRenderData(req))
  });
});

// Product detail
// Product detail
app.get('/product_detail/:id', async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('brand_id category_id') // để show tên brand/category
    .lean();

  if (!product) return res.status(404).send('Sản phẩm không tồn tại');

  // ===== LẤY TÊN SIZE CHUẨN =====
  const sizeIds = (product.variants || [])
    .map(v => v.size_id)
    .filter(Boolean); // giữ nguyên ObjectId

  // lấy { sizeId -> size_name }
  const sizeDocs = sizeIds.length
    ? await ProductSize.find({ _id: { $in: sizeIds } }, 'size_name').lean()
    : [];

  const sizeNameById = {};
  for (const s of sizeDocs) sizeNameById[String(s._id)] = s.size_name || '';

  // chuẩn hóa cho view
  const productSizes = (product.variants || []).map(v => ({
    size_id: String(v.size_id || ''),
    name: sizeNameById[String(v.size_id)] || 'Size',
    sku: v.sku || 'DEFAULT',
    price: typeof v.price === 'number' ? v.price : product.price,
    stock: v.stock_quantity
  }));

  // Related products
  const relatedProducts = await Product.find({
    category_id: product.category_id,
    _id: { $ne: product._id }
  }).limit(8).lean();

  // ===== Reviews & rating như cũ =====
  const reviews = await Review.find({ product_id: product._id }).sort({ created_at: -1 }).lean();
  const agg = await Review.aggregate([
    { $match: { product_id: new mongoose.Types.ObjectId(product._id), rating: { $ne: null } } },
    { $group: { _id: '$rating', count: { $sum: 1 } } }
  ]);
  const dist = { 1:0,2:0,3:0,4:0,5:0 };
  let total = 0, sum = 0;
  for (const row of agg) {
    const s = Number(row._id) || 0, c = Number(row.count) || 0;
    if (s>=1 && s<=5){ dist[s] = c; total += c; sum += s*c; }
  }
  const avg = total ? (sum/total) : 0;
  const ratingStats = { avg, count: total };
  const ratingBreakdown = { avg, count: total, dist };

  // Ảnh
  const allImages = [
    ...(product.images?.map(i => i.url) || []),
    ...(product.colors?.flatMap(c => c.imageUrls || []) || [])
  ];
  while (allImages.length > 0 && allImages.length < 3) allImages.push(allImages[0]);

  res.render('product_detail', {
    title: product.name,
    product,
    productSizes,               // ✅ giờ hiển thị đúng size_name
    allImages,
    products: relatedProducts,
    reviews,
    ratingStats,
    ratingBreakdown,
    expStats: [],
    userRated: 0,
    likerId: req.session.user?._id || null,
    message: null,
    error: null,
    ...(await getRenderData(req))
  });
});


/* ===== Comments & Ratings ===== */
app.post('/api/products/:id/comments', async (req, res) => {
  const product_id = req.params.id;
  const { name, message, stars } = req.body || {};
  if (!message || message.trim().length < 2) {
    return res.status(400).json({ error: 'Nội dung quá ngắn' });
  }

  const prod = await Product.findById(product_id).lean();
  if (!prod) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  const cmt = new Review({
    product_id: prod._id,
    user_id: req.session.user?._id || null,
    guest_name: (!req.session.user && name) ? name.trim() : null,
    rating: Number(stars) || undefined,
    comment: message.trim()
  });

  await cmt.save();

  if (global.io) global.io.emit('new-comment', { productId: String(prod._id), comment: cmt });
  res.json({ ok: true, comment: cmt });
});

/* ================== Cart & Checkout ================== */

// View cart
app.get('/cart', async (req, res) => {
  res.render('cart', { title: 'Giỏ hàng', ...(await getRenderData(req)) });
});

// Add to cart (hỗ trợ cả guest)
app.post('/add-to-cart', async (req, res) => {
  const { productId, variant_sku, size_id, sizeName, colorName, quantity } = req.body || {};
  if (!productId) return res.status(400).send('Thiếu productId');
  if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).send('productId không hợp lệ');

  const qty = Math.max(parseInt(quantity, 10) || 1, 1);
  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).send('Sản phẩm không tồn tại');

  // ===== chọn SKU/price theo size =====
  let sku = variant_sku;
  if (!sku && size_id) {
    const v = (product.variants || []).find(x => String(x.size_id) === String(size_id));
    if (v) sku = v.sku;
  }
  const variant = (product.variants || []).find(v => v.sku === sku);
  const priceAtTime = typeof variant?.price === 'number' ? variant.price : product.price;
  const finalSku = sku || 'DEFAULT';

  // ===== xử lý COLOR (lấy snapshot tên + ảnh + id màu nếu có) =====
  let colorSnap   = (colorName || '').trim();
  let imgSnap     = '';
  let colorIdSnap = null;

  if (Array.isArray(product.colors) && product.colors.length) {
    let match = product.colors.find(c =>
      (c.color_id?.color_name || c.color || '').toLowerCase() === colorSnap.toLowerCase()
    ) || product.colors[0];

    colorSnap   = colorSnap || (match.color_id?.color_name || match.color || '');
    imgSnap     = (match.imageUrls && match.imageUrls[0]) || '';
    colorIdSnap = match.color_id || null;
  }

  // ===== size snapshot (tên) =====
  const sizeSnap = (sizeName || '').trim();

  // LOG để bạn theo dõi request tới server
  console.log('ADD TO CART -> body:', { productId, finalSku, size_id, sizeSnap, colorSnap, qty });

  const newItem = {
    product_id: product._id,
    variant_sku: finalSku,
    name_snapshot: product.name,
    price_at_time: priceAtTime,
    quantity: qty,

    // SNAPSHOTS hiển thị
    color_name_snapshot: colorSnap || undefined,
    size_name_snapshot:  sizeSnap  || undefined,
    img_snapshot:        imgSnap   || undefined,

    // (tuỳ chọn) lưu id để tra cứu lại
    color_id_snapshot: colorIdSnap || undefined,
    size_id_snapshot:  size_id || undefined,
  };

  if (req.session.user?._id) {
    // USER đã login -> lưu Mongo
    const user_id = req.session.user._id;
    let cart = await Cart.findOne({ user_id });
    if (!cart) cart = new Cart({ user_id, items: [] });

    // gộp theo product + sku
    const idx = cart.items.findIndex(
      it => String(it.product_id) === String(product._id) && it.variant_sku === finalSku
    );
    if (idx >= 0) {
      cart.items[idx].quantity += qty;
      cart.items[idx].color_name_snapshot ||= newItem.color_name_snapshot;
      cart.items[idx].size_name_snapshot  ||= newItem.size_name_snapshot;
      cart.items[idx].img_snapshot        ||= newItem.img_snapshot;
      cart.items[idx].color_id_snapshot   ||= newItem.color_id_snapshot;
      cart.items[idx].size_id_snapshot    ||= newItem.size_id_snapshot;
    } else {
      cart.items.push(newItem);
    }
    await cart.save();
  } else {
    // GUEST -> lưu session
    if (!req.session.cartItems) req.session.cartItems = [];
    const items = req.session.cartItems;
    const idx = items.findIndex(
      it => String(it.product_id) === String(product._id) && it.variant_sku === finalSku
    );
    if (idx >= 0) {
      items[idx].quantity += qty;
      items[idx].color_name_snapshot ||= newItem.color_name_snapshot;
      items[idx].size_name_snapshot  ||= newItem.size_name_snapshot;
      items[idx].img_snapshot        ||= newItem.img_snapshot;
      items[idx].color_id_snapshot   ||= newItem.color_id_snapshot;
      items[idx].size_id_snapshot    ||= newItem.size_id_snapshot;
    } else {
      items.push(newItem);
    }
  }

  return res.redirect(`/product_detail/${product._id}`);
});




// Update cart item quantity (AJAX) – hỗ trợ cả guest
app.post('/cart/update/:idx', async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const qty = Math.max(parseInt(req.body?.quantity, 10) || 1, 1);

  // USER đã login -> cập nhật Mongo
  if (req.session.user?._id) {
    const user_id = req.session.user._id;
    const cart = await Cart.findOne({ user_id });
    if (!cart || !cart.items[idx]) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

    cart.items[idx].quantity = qty;
    await cart.save();

    const lineTotal = cart.items[idx].price_at_time * cart.items[idx].quantity;
    const totals = { total: cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0) };
    return res.json({ ok: true, lineTotal, totals });
  }

  // GUEST -> cập nhật session
  const items = req.session.cartItems || [];
  if (!items[idx]) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

  items[idx].quantity = qty;
  req.session.cartItems = items;

  const lineTotal = items[idx].price_at_time * items[idx].quantity;
  const totals = { total: items.reduce((s, it) => s + it.price_at_time * it.quantity, 0) };
  return res.json({ ok: true, lineTotal, totals });
});

// Remove cart item (AJAX) – hỗ trợ cả guest
app.post('/cart/remove/:idx', async (req, res) => {
  const idx = parseInt(req.params.idx, 10);

  // USER đã login -> cập nhật Mongo
  if (req.session.user?._id) {
    const user_id = req.session.user._id;
    const cart = await Cart.findOne({ user_id });
    if (!cart || !cart.items[idx]) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

    cart.items.splice(idx, 1);
    await cart.save();

    const totals = { total: cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0) };
    return res.json({ ok: true, totals });
  }

  // GUEST -> cập nhật session
  const items = req.session.cartItems || [];
  if (!items[idx]) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

  items.splice(idx, 1);
  req.session.cartItems = items;

  const totals = { total: items.reduce((s, it) => s + it.price_at_time * it.quantity, 0) };
  return res.json({ ok: true, totals });
});

// Checkout (CHO PHÉP GUEST)
app.get('/shop-cart/checkout', async (req, res) => {
  res.render('shop_checkout', { title: 'Thanh toán', ...(await getRenderData(req)) });
});


app.post('/shop-cart/submit', requireLogin, async (req, res) => {
  const user = req.session.user;
  const user_id = user._id;
  const cart = await Cart.findOne({ user_id });
  if (!cart || cart.items.length === 0) {
    return res.render('shop_checkout', { title: 'Thanh toán', error: 'Giỏ hàng trống, không thể đặt hàng!', success: null, ...(await getRenderData(req)) });
  }

  const total = cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0);
  const order = new Order({
    user_id,
    order_items: cart.items.map(it => ({
      product_id: it.product_id,
      name_snapshot: it.name_snapshot,
      variant_sku: it.variant_sku,
      unit_price: it.price_at_time,
      quantity: it.quantity
    })),
    total_amount: total,
    status: 'pending',
    status_history: [{ status: 'pending' }]
  });

  await order.save();
  await Cart.deleteOne({ user_id });

  res.render('shop_order_complete', { title: 'Hoàn tất đơn hàng', order, ...(await getRenderData(req)) });
});

/* ================== Auth ================== */

app.get('/login-register', async (req, res) => {
  res.render('login_register', { title: 'Đăng nhập & Đăng ký', error: null, success: null, ...(await getRenderData(req)) });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ email: username, password_hash: password }).lean();
  if (!user) {
    return res.render('login_register', { title: 'Đăng nhập & Đăng ký', error: 'Email hoặc mật khẩu không đúng!', success: null, ...(await getRenderData(req)) });
  }
  // chỉ lưu thông tin cần thiết vào session
  req.session.user = { _id: user._id, email: user.email, full_name: user.full_name };
  res.redirect('/my-account');
});

app.post('/register', async (req, res) => {
  const {
    register_name,
    register_email,
    register_phone,
    register_address,
    register_password,
    register_confirmPassword
  } = req.body;

  if (register_password !== register_confirmPassword) {
    return res.render('login_register', { title: 'Đăng nhập & Đăng ký', error: 'Mật khẩu xác nhận không khớp!', success: null, ...(await getRenderData(req)) });
  }

  const exists = await User.findOne({ email: register_email });
  if (exists) {
    return res.render('login_register', { title: 'Đăng nhập & Đăng ký', error: 'Email đã được sử dụng!', success: null, ...(await getRenderData(req)) });
  }

  const user = new User({
    full_name: register_name,
    email: register_email,
    password_hash: register_password, // demo – nên hash trong thực tế
    addresses: register_address ? [{ address_line: register_address, is_default: true }] : []
  });
  await user.save();

  res.render('login_register', { title: 'Đăng nhập & Đăng ký', error: null, success: 'Đăng ký thành công! Vui lòng đăng nhập.', ...(await getRenderData(req)) });
});

app.get('/my-account', requireLogin, async (req, res) => {
  res.render('account_dashboard', { title: 'Tổng quan tài khoản', ...(await getRenderData(req)) });
});

app.get('/account-orders', requireLogin, async (req, res) => {
  const user_id = req.session.user._id;
  const orders = await Order.find({ user_id }).sort({ createdAt: -1 }).lean();
  res.render('account_orders', { title: 'Đơn hàng', orders, ...(await getRenderData(req)) });
});

app.get('/orders/:id/details', requireLogin, async (req, res) => {
  const user_id = req.session.user._id;
  const order = await Order.findOne({ _id: req.params.id, user_id }).lean();
  res.render('order_detail', { title: 'Chi tiết đơn hàng', order, ...(await getRenderData(req)) });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login-register'));
});

/* ================== Start Server sau khi kết nối DB ================== */
const server = http.createServer(app);
const io = new Server(server);
global.io = io;

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Lỗi khởi động server:', err.message);
    process.exit(1);
  });

  // View: shop-cart (trang giỏ hàng)
app.get('/shop-cart', async (req, res) => {
  res.render('shop_cart', { title: 'Giỏ hàng', ...(await getRenderData(req)) });
});


