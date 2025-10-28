// app.js (FE Gateway – SSR EJS – gọi Backend – không mock)
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const path = require("path");
const proxy = require("express-http-proxy");

// Ưu tiên IPv4 khi dùng 'localhost' (tránh ::1)
require('dns').setDefaultResultOrder?.('ipv4first');

const app = express();

// ====== CONFIG ======
const PORT = process.env.PORT || process.env.FE_PORT || 3000;
// Local: http://127.0.0.1:5000 ; Docker: http://backend:5000
const BACKEND = process.env.BACKEND_ORIGIN || "http://shop-backend:5000";
const FE_PUBLIC_DIR = process.env.FE_PUBLIC_DIR || path.join(__dirname, "src", "public");
const FE_VIEWS_DIR = process.env.FE_VIEWS_DIR || path.join(__dirname, "src", "views");

// ====== VIEW & STATIC ======
app.set("view engine", "ejs");
app.set("views", FE_VIEWS_DIR);
app.locals.basedir = app.get("views");
app.use(express.static(FE_PUBLIC_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== HELPERS ======
function withQuery(url, params) {
  try {
    const u = new URL(url, "http://dummy");
    const s = new URLSearchParams(u.search);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (v === "") s.delete(k);
      else s.set(k, v);
    });
    u.search = s.toString();
    return u.pathname + (u.search ? `?${u.search}` : "");
  } catch {
    const hasQ = url.includes("?");
    const q = new URLSearchParams(params).toString();
    return url + (hasQ ? "&" : "?") + q;
  }
}

// --- đọc Set-Cookie (Undici/Node 20)
function getSetCookie(resp) {
  if (typeof resp.headers.getSetCookie === 'function') return resp.headers.getSetCookie();
  const one = resp.headers.get('set-cookie');
  return one ? [one] : [];
}

// --- fetch JSON: chặn redirect & bắt buộc JSON
async function fetchJSONRaw(url, init = {}) {
  const resp = await fetch(url, { redirect: "manual", ...init });
  const ct = resp.headers.get('content-type') || '';
  const body = await resp.text().catch(() => "");

  // Redirect?
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resp.headers.get('location') || '(no Location)';
    throw new Error(`[${resp.status}] Redirected to ${loc}`);
  }
  // HTTP lỗi?
  if (!resp.ok) {
    throw new Error(`[${resp.status}] ${body.slice(0, 1000)}`);
  }
  // Không phải JSON?
  if (!ct.includes('application/json')) {
    throw new Error(`[${resp.status}] Expected JSON but got ${ct}; body: ${body.slice(0, 200)}`);
  }
  return JSON.parse(body || "{}");
}

// --- Public API: KHÔNG forward cookie (tránh bị BE redirect login)
async function fetchJSONPublic(url, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  return fetchJSONRaw(url, { ...init, headers });
}

// --- Auth API: CÓ forward cookie của user
async function fetchJSONAuth(req, url, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    cookie: req?.headers?.cookie || "",
    ...(init.headers || {}),
  };
  return fetchJSONRaw(url, { ...init, headers });
}

async function postFormAndForwardCookies(req, res, url, bodyObj) {
  const form = new URLSearchParams();
  Object.entries(bodyObj || {}).forEach(([k, v]) => form.append(k, v));
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: req.headers.cookie || "" },
    body: form,
    redirect: "manual",
  });
  const setCookie = getSetCookie(resp);
  if (setCookie?.length) res.set("set-cookie", setCookie);
  return resp;
}

async function loadBrands(req) {
  try {
    const r = await fetch(`${BACKEND}/api/brand`, {
      headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
      redirect: "manual",
    });
    if (!r.ok) return [];
    const ct = r.headers.get('content-type') || '';
    const t = await r.text();
    if (!ct.includes('application/json')) return [];
    return JSON.parse(t || "[]");
  } catch { return []; }
}

// ====== EJS defaults: tránh crash nếu BE thiếu field ======
app.use((req, res, next) => {
  const orig = res.render.bind(res);
  res.render = (view, locals = {}, cb) => {
    const defaultProducts = {
      content: [],
      totalPages: 1,
      number: 0,
      hasPrevious: false,
      hasNext: false,
    };
    const formatPrice = (n) => {
      const v = Number(n || 0);
      return new Intl.NumberFormat("vi-VN").format(v) + " đ";
    };
    const merged = {
      title: "",
      error: null,
      success: null,
      activeAccountTab: "",
      status: "",
      brands: [],
      products: defaultProducts,
      // PDP defaults
      productSizes: [],
      allImages: [],
      thumbImages: [],
      // search/filter defaults
      sort: "", color: "", price_range: "", brand: "", rating: "", q: "",
      // helpers
      formatPrice,
      ...locals,
      // normalizations
      products: locals.products || defaultProducts,
      brands: Array.isArray(locals.brands) ? locals.brands : (locals.brands ? [locals.brands] : []),
      activeAccountTab: locals.activeAccountTab ?? "",
      status: locals.status ?? "",
      productSizes: Array.isArray(locals.productSizes) ? locals.productSizes : [],
      allImages: Array.isArray(locals.allImages) ? locals.allImages : [],
      thumbImages: Array.isArray(locals.thumbImages) ? locals.thumbImages : [],
    };

    return orig(view, merged, cb);
  };
  next();
});

// ====== Common header: categories + minicart + user từ Backend ======
app.use(async (req, res, next) => {
  try {
    // categories — public
    const catJson = await fetchJSONPublic(`${BACKEND}/api/page/categories`).catch(() => ({ ok: false, categories: [] }));
    res.locals.categories = (catJson.ok && Array.isArray(catJson.categories)) ? catJson.categories : [];

    // minicart — auth (để giữ phiên)
    const miniJson = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({ ok: false }));
    if (miniJson.ok) {
      res.locals.carts = miniJson.carts || [];
      res.locals.cartCount = miniJson.cartCount || 0;
      res.locals.total = miniJson.total || 0;
      res.locals.formattedTotal = miniJson.formattedTotal || "0 đ";
      res.locals.user = miniJson.user || null;
      res.locals.loggedInUser = !!miniJson.user;
    } else {
      res.locals.carts = [];
      res.locals.cartCount = 0;
      res.locals.total = 0;
      res.locals.formattedTotal = "0 đ";
      res.locals.user = null;
      res.locals.loggedInUser = false;
    }
  } catch {
    res.locals.categories = [];
    res.locals.carts = [];
    res.locals.cartCount = 0;
    res.locals.total = 0;
    res.locals.formattedTotal = "0 đ";
    res.locals.user = null;
    res.locals.loggedInUser = false;
  }
  next();
});

// ====== PAGES ======
app.get(["/", "/home"], async (req, res) => {
  const data = await fetchJSONPublic(`${BACKEND}/api/page/home`)
    .catch((e) => {
      console.error("[/home] FE->BE error:", e.message);
      return { ok: true, latest: [], trending: [], popular: [], products: [] };
    });
  res.render("home", { title: "Trang chủ", ...data });
});

app.get("/category/alls", async (req, res) => {
  const params = new URLSearchParams(req.query).toString();
  const data = await fetchJSONPublic(`${BACKEND}/api/page/category/alls?${params}`)
    .catch((e) => {
      console.error("[/category/alls] FE->BE error:", e.message);
      return { ok: true, products: [] };
    });
  const brands = await loadBrands(req);
  const list = Array.isArray(data.products) ? data.products : [];
  const pageNo = Math.max(parseInt(req.query.pageNo || "1", 10), 1);

  res.render("category", {
    title: "Danh mục",
    selectedCategoryId: "alls",
    selectedCategoryName: "Tất cả",
    brands,
    sort: req.query.sort || "",
    color: req.query.color || "",
    price_range: req.query.price_range || "",
    brand: req.query.brand || "",
    rating: req.query.rating || "",
    q: req.query.q || "",
    products: { content: list, totalPages: 1, number: pageNo - 1, hasPrevious: pageNo > 1, hasNext: false },
  });
});

app.get("/category/:id", async (req, res) => {
  const params = new URLSearchParams(req.query).toString();
  try {
    const data = await fetchJSONPublic(`${BACKEND}/api/page/category/${req.params.id}?${params}`);
    const brands = await loadBrands(req);
    const list = Array.isArray(data.products) ? data.products : [];
    const pageNo = Math.max(parseInt(req.query.pageNo || "1", 10), 1);

    res.render("categogy_collections", {
      title: data.category?.name || "Danh mục",
      selectedCategoryId: data.category?._id || req.params.id,
      selectedCategoryName: data.category?.name || "Danh mục",
      brands,
      sort: req.query.sort || "",
      color: req.query.color || "",
      price_range: req.query.price_range || "",
      brand: req.query.brand || "",
      rating: req.query.rating || "",
      q: req.query.q || "",
      products: { content: list, totalPages: 1, number: pageNo - 1, hasPrevious: pageNo > 1, hasNext: false },
    });
  } catch (e) {
    console.error("[/category/:id] FE->BE error:", e.message);
    return res.redirect("/category/alls");
  }
});

app.get("/search", async (req, res) => {
  const params = new URLSearchParams(req.query).toString();
  const data = await fetchJSONPublic(`${BACKEND}/api/page/search?${params}`)
    .catch((e) => {
      console.error("[/search] FE->BE error:", e.message);
      return { ok: true, products: [], q: "" };
    });
  res.render("product_search", { title: "Tìm kiếm", ...data });
});

// PRODUCT DETAIL – build allImages/thumbImages/productSizes/variantMatrix từ API
app.get("/product_detail/:id", async (req, res) => {
  try {
    const r = await fetch(`${BACKEND}/api/page/product/${req.params.id}`, {
      headers: { "Content-Type": "application/json" },
      redirect: "manual",
    });
    if (r.status === 404) return res.status(404).send("Sản phẩm không tồn tại");

    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (!r.ok || !ct.includes('application/json')) {
      console.error("[/product_detail/:id] BE returned non-JSON:", r.status, ct, text.slice(0, 120));
      return res.status(500).send("Lỗi dữ liệu sản phẩm");
    }
    const data = JSON.parse(text);

    const product = data?.product || {};
    const variants = Array.isArray(data?.variants) ? data.variants : [];

    const imgs = [];
    if (Array.isArray(product.images)) {
      for (const im of product.images) imgs.push(typeof im === "string" ? im : im?.url);
    }
    for (const v of variants) {
      if (Array.isArray(v?.images)) {
        for (const im of v.images) imgs.push(typeof im === "string" ? im : im?.url);
      }
    }
    const uniq = Array.from(new Set(imgs.filter(Boolean)));
    const allImages = uniq.length ? uniq : ["/images/default.png"];
    while (allImages.length > 0 && allImages.length < 3) allImages.push(allImages[0]);
    const thumbImages = allImages.slice(0, Math.min(6, allImages.length));

    // Sizes unique
    const seen = new Set();
    const productSizes = [];
    for (const v of variants) {
      const id = String(v?.size?._id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      productSizes.push({
        size_id: id,
        name: v?.size?.size_name || "Size",
        sku: v?.sku || "DEFAULT",
        price: typeof v?.price === "number" ? v.price : (product.display_price || product.price),
        stock: v?.stock_quantity ?? null,
      });
    }

    // Matrix "<sizeId>:<colorId>" -> sku
    const variantMatrix = {};
    for (const v of variants) {
      const s = v?.size?._id ? String(v.size._id) : "";
      const c = v?.color?._id ? String(v.color._id) : "";
      if (s && c && v?.sku) variantMatrix[`${s}:${c}`] = v.sku;
    }

    const related = Array.isArray(data?.products) ? data.products : [];

    res.render("product_detail", {
      title: product?.name || "Chi tiết sản phẩm",
      ...data,
      products: related,
      allImages,
      thumbImages,
      productSizes,
      variantMatrix,
    });
  } catch (e) {
    console.error("[/product_detail/:id] FE->BE error:", e.message);
    return res.status(500).send("Có lỗi khi tải chi tiết sản phẩm");
  }
});

// CART PAGES
app.get("/cart", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`)
    .catch(() => ({ ok: true, carts: [] }));
  const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
  res.render("cart", { title: "Giỏ hàng", isEmpty, ...data });
});

app.get("/shop-cart", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`)
    .catch(() => ({ ok: true, carts: [] }));
  const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
  res.render("shop_cart", { title: "Giỏ hàng", isEmpty, ...data });
});

app.get("/shop-cart/checkout", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`)
    .catch(() => ({ ok: true, carts: [] }));
  const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
  res.render("shop_checkout", { title: "Thanh toán", isEmpty, ...data });
});

// AUTH PAGES
app.get("/login-register", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
  if (data.loggedInUser) return res.redirect("/my-account");
  res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, ...data });
});
app.get("/login", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
  if (data.loggedInUser) return res.redirect("/my-account");
  res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, activeTab: "login", ...data });
});
app.get("/register", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
  if (data.loggedInUser) return res.redirect("/my-account");
  res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, activeTab: "register", ...data });
});

// ACCOUNT PAGES
app.get("/my-account", (_req, res) => res.redirect("/account/profile"));
app.get("/account/profile", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/profile`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_profile", { title: "Tài khoản", activeAccountTab: "profile", ...data });
});
app.get("/account/addresses", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/addresses`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_addresses", { title: "Địa chỉ", activeAccountTab: "addresses", ...data });
});
app.get("/account-orders", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/orders`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_orders", { title: "Đơn hàng", activeAccountTab: "orders", status: req.query.status || "all", ...data });
});
app.get("/orders/:id/details", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/orders/${req.params.id}/details`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("order_detail", { title: "Chi tiết đơn", activeAccountTab: "orders", ...data });
});
app.get("/account/orders", async (req, res) => {
  const params = new URLSearchParams(req.query).toString();
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/orders/filter?${params}`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_orders", { title: "Đơn hàng", activeAccountTab: "orders", status: req.query.status || "all", ...data });
});
app.get("/account/vouchers", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/vouchers`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_vouchers", { title: "Mã giảm giá", activeAccountTab: "vouchers", ...data });
});
app.get("/account/points", async (req, res) => {
  const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/points`).catch(() => null);
  if (!data || data.redirectToLogin) return res.redirect("/login");
  res.render("account_points", { title: "Điểm thưởng", activeAccountTab: "points", ...data });
});

// AUTH ACTIONS (forward tới backend + set-cookie)
app.post("/login", async (req, res) => {
  try {
    const resp = await postFormAndForwardCookies(req, res, `${BACKEND}/login`, {
      username: req.body.username || req.body.email,
      password: req.body.password,
    });
    let data = null; try { data = await resp.json(); } catch { }
    if (resp.status === 200 && data && (data.ok || data.user)) return res.redirect("/my-account");
    if (resp.status === 302 || resp.status === 301) return res.redirect("/my-account");

    const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
    return res.status(401).render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: (data && (data.error || data.message)) || "Email hoặc mật khẩu không đúng!",
      success: null,
      activeTab: "login",
      ...mini,
    });
  } catch {
    const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
    return res.status(500).render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: "Có lỗi khi đăng nhập. Vui lòng thử lại.",
      success: null,
      activeTab: "login",
      ...mini,
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const resp = await postFormAndForwardCookies(req, res, `${BACKEND}/login`, {
      username: req.body.email || req.body.username,
      password: req.body.password,
    });
    let data = null; try { data = await resp.json(); } catch { }
    if (resp.status === 200 && data && (data.ok || data.user)) {
      return res.status(200).json({ ok: true, redirect: "/my-account" });
    }
    return res.status(401).json({ ok: false, error: (data && (data.error || data.message)) || "Email hoặc mật khẩu không đúng!" });
  } catch {
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const resp = await postFormAndForwardCookies(req, res, `${BACKEND}/register`, {
      register_name: req.body.register_name,
      register_email: req.body.register_email,
      register_phone: req.body.register_phone,
      register_address: req.body.register_address,
      register_password: req.body.register_password,
      register_confirmPassword: req.body.register_confirmPassword,
    });
    let data = null; try { data = await resp.json(); } catch { }
    if (resp.status === 200 && data && (data.ok || data.success)) return res.redirect("/login");

    const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
    return res.status(400).render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: (data && (data.error || data.message)) || "Đăng ký thất bại",
      success: null,
      activeTab: "register",
      ...mini,
    });
  } catch {
    const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
    return res.status(500).render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: "Có lỗi khi đăng ký. Vui lòng thử lại.",
      success: null,
      activeTab: "register",
      ...mini,
    });
  }
});

app.get("/logout", async (req, res) => {
  try {
    const resp = await fetch(`${BACKEND}/logout`, { headers: { cookie: req.headers.cookie || "" }, redirect: "manual" });
    const setCookie = getSetCookie(resp);
    if (setCookie?.length) res.set("set-cookie", setCookie);
  } catch { }
  return res.redirect("/login");
});

// CART ACTIONS (forward)
app.post("/add-to-cart", async (req, res) => {
  try {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(req.body || {})) form.append(k, v);

    const resp = await fetch(`${BACKEND}/add-to-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: req.headers.cookie || "" },
      body: form,
      redirect: "manual",
    });

    const setCookie = getSetCookie(resp);
    if (setCookie?.length) res.set("set-cookie", setCookie);

    const back = req.get("referer") || "/";
    return res.redirect(withQuery(back, { added: 1, add_error: null }));
  } catch {
    const back = req.get("referer") || "/";
    return res.redirect(withQuery(back, { add_error: 1 }));
  }
});

app.post("/cart/update/:idx", async (req, res) => {
  const idx = req.params.idx;
  try {
    const form = new URLSearchParams({ quantity: String(req.body.quantity || 1) });
    await fetch(`${BACKEND}/cart/update/${idx}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: req.headers.cookie || "" },
      body: form,
    });

    const mini = await fetch(`${BACKEND}/api/page/minicart`, {
      headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
    });
    const miniJson = await mini.json();

    const items = Array.isArray(miniJson.carts) ? miniJson.carts : [];
    const it = items[idx];
    const lineTotal = it ? Number(it.price_at_time || 0) * Number(it.quantity || 0) : 0;

    return res.json({ ok: true, lineTotal, totals: { total: Number(miniJson.total || 0) } });
  } catch {
    return res.status(500).json({ ok: false, message: "Update failed" });
  }
});

app.post("/cart/remove/:idx", async (req, res) => {
  const idx = req.params.idx;
  try {
    await fetch(`${BACKEND}/cart/remove/${idx}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
    });

    const mini = await fetch(`${BACKEND}/api/page/minicart`, {
      headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
    });
    const miniJson = await mini.json();

    return res.json({ ok: true, totals: { total: Number(miniJson.total || 0) } });
  } catch {
    return res.status(500).json({ ok: false, message: "Remove failed" });
  }
});

// submit checkout -> proxy thẳng Backend
app.post("/shop-cart/submit", proxy(BACKEND, { proxyReqPathResolver: () => "/shop-cart/submit" }));

// Tất cả /api/* khác → proxy tới Backend (giúp same-origin, tránh CORS)
app.use("/api", proxy(BACKEND, { proxyReqPathResolver: (req) => `/api${req.url}` }));

// ====== HEALTH ======
app.get("/__health", async (_req, res) => res.json({ ok: true, service: "frontend" }));
app.get("/__backend", async (_req, res) => {
  try {
    const r = await fetch(`${BACKEND}/__health`);
    const body = await r.text();
    let data; try { data = JSON.parse(body); } catch { data = { raw: body }; }
    res.json({ BACKEND, reachable: true, status: r.status, backend: data });
  } catch (e) {
    res.status(200).json({ BACKEND, reachable: false, error: String(e) });
  }
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.get("/__whoami", (_req, res) => res.send("FE Express server OK"));
app.get("/__routes", (_req, res) => {
  const routes = [];
  app._router.stack.forEach(l => {
    if (l.route && l.route.path) {
      const methods = Object.keys(l.route.methods).join(",").toUpperCase();
      routes.push(`${methods} ${l.route.path}`);
    }
  });
  res.type("text").send(routes.sort().join("\n"));
});

// ====== HTTP SERVER + SOCKET.IO ======
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // FE là SSR; nếu dùng WS qua Nginx bạn có thể tighten lại
});
global.io = io;

io.on("connection", (socket) => {
  // tuỳ bạn dùng cho thông báo realtime
  socket.emit("hello", { msg: "Socket connected to FE gateway" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FE SSR (EJS) chạy tại http://0.0.0.0:${PORT}`);
  console.log(`Proxy/Fetch tới Backend: ${BACKEND}`);
});
