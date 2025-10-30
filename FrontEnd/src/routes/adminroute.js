// src/server_admin.js — Admin UI (mock CRUD) export Express.Router (refactored to use FE-style fetch helpers)

const express = require("express");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

module.exports = function createAdminRouter({ BACKEND, proxy } = {}) {
  const router = express.Router();

  // ========== Fetch helpers (aligned with src/routes/pages.js) ==========
  function getSetCookie(resp) {
    if (typeof resp.headers.getSetCookie === "function") return resp.headers.getSetCookie();
    const one = resp.headers.get("set-cookie");
    return one ? [one] : [];
  }
  async function fetchJSONRaw(url, init = {}) {
    const resp = await fetch(url, { redirect: "manual", ...init });
    const ct = resp.headers.get("content-type") || "";
    const body = await resp.text().catch(() => "");
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location") || "(no Location)";
      throw new Error(`[${resp.status}] Redirected to ${loc}`);
    }
    if (!resp.ok) throw new Error(`[${resp.status}] ${body.slice(0, 1000)}`);
    if (!ct.includes("application/json")) throw new Error(`[${resp.status}] Expected JSON but got ${ct}; body: ${body.slice(0, 200)}`);
    return JSON.parse(body || "{}");
  }
  async function fetchJSONPublic(url, init = {}) {
    const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
    return fetchJSONRaw(url, { ...init, headers });
  }
  async function fetchJSONAuth(req, url, init = {}) {
    const headers = { "Content-Type": "application/json", cookie: req?.headers?.cookie || "", ...(init.headers || {}) };
    return fetchJSONRaw(url, { ...init, headers });
  }

  // ========== Helpers (locals) ==========
  let ADMIN_ACCOUNT = { id: "admin1", full_name: "Admin", password: "admin123" }; // demo

  router.use((req, res, next) => {
    res.locals.money = (v) => {
      try { return (v || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" }); }
      catch { return v; }
    };
    res.locals.admin = { full_name: ADMIN_ACCOUNT.full_name };
    res.locals.activePath = "/admin" + req.path;
    res.locals.flash = {};
    if (req.query?.s) res.locals.flash.success = req.query.s;
    if (req.query?.e) res.locals.flash.error = req.query.e;
    next();
  });

  router.use(express.urlencoded({ extended: true }));

  // ========== Mock data (unchanged for fallback) ==========
  let BRANDS = [
    { _id: "b1", name: "A Brand", slug: "a-brand", createdAt: new Date() },
    { _id: "b2", name: "B Brand", slug: "b-brand", createdAt: new Date() }
  ];
  let CATEGORIES = [
    { _id: "c1", name: "Áo", slug: "ao", description: "Áo thời trang", createdAt: new Date() },
    { _id: "c2", name: "Quần", slug: "quan", description: "Quần thời trang", createdAt: new Date() }
  ];

  let PRODUCTS = Array.from({ length: 12 }).map((_, i) => ({
    _id: `p${i + 1}`, name: `Sản phẩm ${i + 1}`, slug: `san-pham-${i + 1}`,
    brand: BRANDS[i % 2]._id, category: CATEGORIES[i % 2]._id,
    productStatus: { statusName: (i % 3 === 0 ? 'Bán chạy' : i % 3 === 1 ? 'Trending' : 'New') },
    short_description: `Mô tả ngắn ${i + 1}`, long_description: `Mô tả dài ${i + 1}`,
    variants_count: 2 + (i % 3), price_min: 100000 * (i + 1), price_max: 150000 * (i + 1),
    stock_total: 5 + (i % 10), cover: 'https://picsum.photos/seed/' + (i + 7) + '/80/80',
    variants: [{ sku: `SKU-${i + 1}-S`, price: 150000 + i * 5000, stock_quantity: 10 + i }]
  }));

  // Try loading brands/categories from BACKEND if available (keeps Admin in sync)
  async function tryLoadBrands(req) {
    if (!BACKEND) return BRANDS;
    try {
      const data = await fetchJSONAuth(req, `${BACKEND}/api/brand`).catch(() => []);
      if (Array.isArray(data)) BRANDS = data; // flexible shape
    } catch { }
    return BRANDS;
  }
  async function tryLoadCategories(req) {
    if (!BACKEND) return CATEGORIES;
    try {
      const data = await fetchJSONAuth(req, `${BACKEND}/api/category`).catch(() => []);
      if (Array.isArray(data)) CATEGORIES = data;
    } catch { }
    return CATEGORIES;
  }
  // === Load SIZES ===
  async function tryLoadSizes(req) {
    if (!BACKEND) return PRODUCT_SIZES;
    try {
      const data = await fetchJSONAuth(req, `${BACKEND}/api/product/size`).catch(() => []);
      if (Array.isArray(data)) PRODUCT_SIZES = data;
    } catch { }
    return PRODUCT_SIZES;
  }

  // === Load COLORS ===
  async function tryLoadColors(req) {
    if (!BACKEND) return PRODUCT_COLORS;
    try {
      const data = await fetchJSONAuth(req, `${BACKEND}/api/product/color`).catch(() => []);
      if (Array.isArray(data)) PRODUCT_COLORS = data;
    } catch { }
    return PRODUCT_COLORS;
  }
  // FE-style product fetch with cookie forwarding & strict JSON checks
  async function fetchProducts(req) {
    // If no BACKEND provided, keep the old mock/legacy flow
    const fallback = () => PRODUCTS;
    try {
      if (!BACKEND) return fallback();
      const url = `${BACKEND}/api/product`;
      const data = await fetchJSONAuth(req, url);

      if (data && data.success && data.data && Array.isArray(data.data.products)) return data.data.products;
      // 2) { ok: true, products: [...] }
      if (data && (data.ok || data.status === "ok") && Array.isArray(data.products)) return data.products;
      // 3) Direct array
      if (Array.isArray(data)) return data;
      throw new Error("Unexpected products payload shape");
    } catch (err) {
      console.error("Fetch PRODUCTS failed:", err.message);
      // Hard fallback sample list (as in original) — keep at least one item to render UI
      return [];
    }
  }
  async function fetchCreateProduct(req) {
    try {
      if (!BACKEND) throw new Error("BACKEND is not configured");
      const url = `${BACKEND}/api/product`;

      const form = new FormData();

      // ---- Text fields (giống Postman) ----
      const textKeys = [
        "name", "slug", "brand", "category",
        "short_description", "long_description", "statusName"
      ];
      for (const k of textKeys) {
        if (req.body[k] !== undefined) form.append(k, String(req.body[k]));
      }

      // ---- variants: BE kỳ vọng JSON string trong field "variants"
      // Nếu FE gửi object/array thì stringify; nếu FE đã gửi string thì giữ nguyên
      if (req.body.variants !== undefined) {
        const v = req.body.variants;
        form.append("variants", typeof v === "string" ? v : JSON.stringify(v));
      }

      // ---- Files: productImages (0..n) & variantImages[...] giống Postman ----
      // Trường hợp dùng upload.any(), req.files là mảng:
      if (Array.isArray(req.files)) {
        for (const f of req.files) {
          const fname = f.originalname || "file";
          const blob = new Blob([f.buffer], { type: f.mimetype || "application/octet-stream" });
          // fieldname giữ nguyên để khớp key Postman (vd: productImages, variantImages[0][], variantImages[1][])
          form.append(f.fieldname, blob, fname);
        }
      }
      // (Nếu bạn dùng upload.fields, bạn có thể loop object tương tự)

      // ⚠️ Không tự set Content-Type để FormData tự gắn boundary
      const resp = await fetch(url, {
        method: "POST",
        headers: { cookie: req.headers.cookie || "" },
        body: form,
        redirect: "manual",
      });

      let data = {};
      try { data = await resp.json(); } catch { }

      if (!resp.ok) {
        // BE thường trả { message: "Product already exists with this slug" }
        return { ok: false, message: data?.message || `[${resp.status}] Create failed` };
      }

      // Thành công: BE trả object product (theo mẫu bạn gửi)
      if (data && data.id && data.name) {
        return { ok: true, message: `Tạo sản phẩm "${data.name}" thành công!` };
      }
      return { ok: true, message: data?.message || "Tạo sản phẩm thành công!" };
    } catch (err) {
      console.error("Create PRODUCT failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo sản phẩm" };
    }
  }


  let PRODUCT_COLORS = [{ _id: "pc1", product: "p1", product_name: "Sản phẩm 1", color_name: "Đen", color_code: "#000000", createdAt: new Date() }];
  let PRODUCT_SIZES = [{ _id: "ps1", product: "p1", product_name: "Sản phẩm 1", size_name: "M", size_order: 2, createdAt: new Date() }];
  let PRODUCT_VARIANTS = [{ sku: "SKU-1-S", product: "p1", product_name: "Sản phẩm 1", color: "pc1", color_name: "Đen", size: "ps1", size_name: "M", price: 150000, stock_quantity: 10 }];

  let USERS = Array.from({ length: 10 }).map((_, i) => ({
    _id: `u${i + 1}`, full_name: `Người dùng ${i + 1}`, email: `user${i + 1}@example.com`,
    role: i % 4 === 0 ? 'admin' : 'customer', is_verified: i % 3 === 0, loyalty_points: 10 * i,
    createdAt: new Date(Date.now() - i * 86400000)
  }));
  let ADDRESSES = [{ _id: "ad1", user: "u1", address_line: "12 Nguyễn Huệ, Q1, HCM", is_default: true, createdAt: new Date() }];
  let REVIEWS = [{ _id: "rv1", product: "p1", user: "u2", guest_name: null, guest_email: null, comment: "Quá xịn!", rating: 5, createdAt: new Date() }];
  let WISHLISTS = [{ _id: "wl1", user: "u3", product_variant_sku: "SKU-1-S", createdAt: new Date() }];

  let DISCOUNTS = [
    { code: "ABCDE", discount_value: 10, usage_limit: 5, usage_count: 2, is_active: true, createdAt: new Date() },
    { code: "SALE1", discount_value: 15, usage_limit: 3, usage_count: 1, is_active: true, createdAt: new Date() },
    { code: "OFF50", discount_value: 50, usage_limit: 1, usage_count: 0, is_active: false, createdAt: new Date() }
  ];

  let ORDERS = Array.from({ length: 9 }).map((_, i) => ({
    _id: `OD${1000 + i}`,
    user: USERS[i % USERS.length],
    createdAt: new Date(Date.now() - i * 3600 * 1000 * 12),
    total_amount: 400000 + i * 50000,
    final_amount: 380000 + i * 45000,
    discount_code: i % 3 === 0 ? { code: "ABCDE" } : null,
    current_status: ["pending", "confirmed", "shipping", "delivered", "cancelled"][i % 5],
    status_history: [
      { status: "pending", timestamp: new Date(Date.now() - (i * 3 + 2) * 3600000) },
      { status: "confirmed", timestamp: new Date(Date.now() - (i * 3 + 1) * 3600000) }
    ],
    items: [{ product_variant_sku: `SKU-${i + 1}-S`, quantity: 1 + (i % 2), price_at_purchase: 190000 + i * 10000, name_snapshot: `Sản phẩm ${i + 1} - Size S` }],
    address: { address_line: `Số ${i + 10} Đường ABC, Quận ${i + 1}` }
  }));

  // ========== Utils ==========
  function paginate(array, page = 1, pageSize = 10) {
    const totalItems = array.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const current = Math.min(Math.max(1, parseInt(page) || 1), totalPages);
    const start = (current - 1) * pageSize;
    const end = start + pageSize;
    return { items: array.slice(start, end), page: current, totalPages, totalItems };
  }
  function baseUrl(req) {
    const q = new URLSearchParams(req.query);
    q.delete("page");
    return req.path + (q.toString() ? `?${q.toString()}&page=` : "?page=");
  }

  // ========== Dashboard ==========
  router.get("/", (req, res) => {
    const charts = {
      revenue: { labels: ["T1", "T2", "T3", "T4", "T5", "T6"], revenue: [12, 18, 10, 22, 19, 25], profit: [3, 5, 2, 6, 5, 8] },
      orders: { labels: ["T1", "T2", "T3", "T4", "T5", "T6"], orders: [120, 180, 150, 220, 190, 240] },
      compare: { labels: ["Q1", "Q2", "Q3", "Q4"], revenue: [40, 55, 48, 70], profit: [10, 14, 12, 18], orders: [120, 180, 160, 240] }
    };

    const metrics = { totalUsers: USERS.length, ordersCount: ORDERS.length, revenue: 75299000, profit: 12600000 };

    const kpis = [
      { label: "Tổng người dùng", value: metrics.totalUsers, delta: 5, icon: "users" },
      { label: "Đơn hàng", value: metrics.ordersCount, delta: 12, icon: "receipt" },
      { label: "Doanh thu", value: metrics.revenue, valueDisplay: metrics.revenue.toLocaleString("vi-VN", { style: "currency", currency: "VND" }), delta: 8, icon: "credit-card" },
      { label: "Lợi nhuận", value: metrics.profit, valueDisplay: metrics.profit.toLocaleString("vi-VN", { style: "currency", currency: "VND" }), delta: -3, icon: "badge-dollar-sign" },
    ];

    const topProducts = PRODUCTS.slice(0, 10).map((p, i) => ({ name: p.name, total_sold: 100 - i * 3 }));

    res.render("dashboard", {
      title: "Dashboard",
      pageHeading: "Dashboard",
      charts, kpis, topProducts,
      filters: { granularity: "month", mode: req.query.mode || "simple" }
    });
  });

  // ========== Products ==========
  router.get("/products", async (req, res) => {
    await Promise.all([tryLoadBrands(req), tryLoadCategories(req), tryLoadColors(req), tryLoadSizes(req)]);
    const list = await fetchProducts(req);
    const { page = 1 } = req.query;

    // Normalize brand/category to objects if backend only returns IDs
    const mapped = list.map((p) => ({
      ...p,
      brand: typeof p.brand === 'string' ? (BRANDS.find(b => String(b._id) === String(p.brand)) || p.brand) : p.brand,
      category: typeof p.category === 'string' ? (CATEGORIES.find(c => String(c._id) === String(p.category)) || p.category) : p.category,
    }));

    const p = paginate(mapped, page, 10);
    res.render("products_index", {
      title: "Sản phẩm",
      pageHeading: "Quản lý sản phẩm",
      items: p.items, brands: BRANDS, categories: CATEGORIES,
      query: req.query, pagination: { ...p, baseUrl: baseUrl(req) }
    });
  });

  router.get("/products/new", async (req, res) => {
    await Promise.all([tryLoadBrands(req), tryLoadCategories(req), tryLoadColors(req), tryLoadSizes(req)]);
    res.render("product_form", {
      title: "Thêm sản phẩm",
      pageHeading: "Thêm sản phẩm",
      brands: BRANDS,
      categories: CATEGORIES,
      productColors: PRODUCT_COLORS,
      productSizes: PRODUCT_SIZES
    });
  });

  router.get("/products/:id", async (req, res) => {
    // luôn load các list như trang /products/new
    await Promise.all([
      tryLoadBrands(req),
      tryLoadCategories(req),
      tryLoadColors(req),
      tryLoadSizes(req),
    ]);

    let product = null;

    // Nếu có BACKEND thì lấy từ API
    if (BACKEND) {
      try {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/product/${req.params.id}`);
        // chấp nhận nhiều dạng payload phổ biến
        if (data?.success && data?.data?.product) product = data.data.product;
        else if ((data?.ok || data?.status === "ok") && data?.product) product = data.product;
        else if (data && (data._id || data.id || data.name)) product = data; // trả trực tiếp object
      } catch (e) {
        console.error("Load product by id failed:", e.message);
      }
    } else {
      // fallback mock khi không cấu hình BACKEND
      product = PRODUCTS.find(x => String(x._id) === String(req.params.id)) || null;
    }

    if (!product) {
      return res.status(404).send("Không tìm thấy sản phẩm");
    }

    // ---- Chuẩn hoá productStatus để form bind an toàn ----
    if (!product.productStatus || !product.productStatus.statusName) {
      const st = product.statusName || "New";
      product.productStatus = { statusName: st };
    }

    // ---- Chuẩn hoá brand/category về id string (phù hợp so sánh trong EJS) ----
    if (product.brand && typeof product.brand === "object") {
      product.brand = product.brand._id || product.brand.id || product.brand;
    }
    if (product.category && typeof product.category === "object") {
      product.category = product.category._id || product.category.id || product.category;
    }

    // ---- Chuẩn hoá variants về shape form cần ----
    const srcVariants =
      Array.isArray(product?.variants) ? product.variants :
        Array.isArray(product?.p?.variants) ? product.p.variants :
          [];

    product.variants = (srcVariants || []).map(v => {
      const images = Array.isArray(v?.images) ? v.images.map(img => ({
        url: img?.url || "",
        public_id: img?.public_id || "",
        is_primary: !!img?.is_primary
      })) : [];

      // Tính index ảnh chính từ is_primary (mặc định 0 nếu không có)
      let primaryIndex = images.findIndex(i => i.is_primary);
      if (primaryIndex < 0) primaryIndex = 0;

      return {
        sku: String(v?.sku || "").trim(),
        price: Number(v?.price ?? 0),
        stock_quantity: Number(v?.stock_quantity ?? 0),
        color: v?.color ? String(v.color) : null,   // backend trả _id string
        size: v?.size ? String(v.size) : null,      // backend trả _id string
        images,
        primaryIndex
      };
    });

    // (không cần log object quá lớn ở prod)
    // console.log(product);

    return res.render("product_form", {
      title: "Chỉnh sửa sản phẩm",
      pageHeading: "Chỉnh sửa sản phẩm",
      product,
      brands: BRANDS,
      categories: CATEGORIES,
      productColors: PRODUCT_COLORS,
      productSizes: PRODUCT_SIZES,
    });
  });

  router.post("/products", upload.any(), async (req, res) => {
    const r = await fetchCreateProduct(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    return res.redirect(`/admin/products?${q.toString()}`);
  });

  router.post("/products/:id", (req, res) => {
    const i = PRODUCTS.findIndex(x => x._id === req.params.id);
    if (i > -1) {
      PRODUCTS[i] = {
        ...PRODUCTS[i],
        name: req.body.name, slug: req.body.slug, brand: req.body.brand, category: req.body.category,
        short_description: req.body.short_description, long_description: req.body.long_description,
        productStatus: { statusName: req.body.statusName || PRODUCTS[i].productStatus?.statusName || "New" }
      };
    }
    res.redirect("/admin/products");
  });
  router.post("/products/:id/delete", (req, res) => { PRODUCTS = PRODUCTS.filter(x => x._id !== req.params.id); res.redirect("/admin/products"); });

  // ========== Variants / Colors / Sizes ==========
  router.get("/product-variants", (req, res) => {
    const p = paginate(PRODUCT_VARIANTS, 1, 50);
    res.render("entity_index", {
      title: "Biến thể", pageHeading: "Biến thể",
      items: p.items,
      fields: ["sku", "product", "color", "size", "price", "stock_quantity"],
      pagination: { ...p, baseUrl: "/admin/product-variants?page=" }
    });
  });
  router.get("/product-variants/new", (req, res) => res.render("entity_form", {
    title: "Thêm biến thể", pageHeading: "Thêm biến thể", item: null,
    fields: ["product", "sku", "color", "size", "price", "stock_quantity"],
    actionBase: "/admin/product-variants"
  }));
  router.get("/product-variants/:id", (req, res) => {
    const item = PRODUCT_VARIANTS.find(x => x.sku == req.params.id);
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa biến thể", pageHeading: "Sửa biến thể", item,
      fields: ["product", "sku", "color", "size", "price", "stock_quantity"],
      actionBase: "/admin/product-variants"
    });
  });
  router.post("/product-variants", (req, res) => {
    PRODUCT_VARIANTS.unshift({
      sku: req.body.sku, product: req.body.product, color: req.body.color, size: req.body.size,
      price: Number(req.body.price || 0), stock_quantity: Number(req.body.stock_quantity || 0)
    });
    res.redirect("/admin/product-variants");
  });
  router.post("/product-variants/:id", (req, res) => {
    const i = PRODUCT_VARIANTS.findIndex(x => x.sku == req.params.id);
    if (i > -1) {
      PRODUCT_VARIANTS[i] = {
        ...PRODUCT_VARIANTS[i],
        product: req.body.product, color: req.body.color, size: req.body.size,
        price: Number(req.body.price || 0), stock_quantity: Number(req.body.stock_quantity || 0)
      };
    }
    res.redirect("/admin/product-variants");
  });
  router.post("/product-variants/:id/delete", (req, res) => {
    PRODUCT_VARIANTS = PRODUCT_VARIANTS.filter(x => x.sku != req.params.id);
    res.redirect("/admin/product-variants");
  });

  router.get("/product-colors", (req, res) => {
    const p = paginate(PRODUCT_COLORS, 1, 50);
    res.render("entity_index", {
      title: "Màu sắc", pageHeading: "Màu sắc",
      items: p.items, fields: ["product", "color_name", "color_code", "createdAt"],
      pagination: { ...p, baseUrl: "/admin/product-colors?page=" }
    });
  });
  router.get("/product-colors/new", (req, res) => res.render("entity_form", {
    title: "Thêm màu", pageHeading: "Thêm màu", item: null,
    fields: ["product", "color_name", "color_code"], actionBase: "/admin/product-colors"
  }));
  router.get("/product-colors/:id", (req, res) => {
    const item = PRODUCT_COLORS.find(x => x._id == req.params.id);
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa màu", pageHeading: "Sửa màu", item,
      fields: ["product", "color_name", "color_code"], actionBase: "/admin/product-colors"
    });
  });
  router.post("/product-colors", (req, res) => {
    PRODUCT_COLORS.unshift({ _id: "pc" + Date.now(), product: req.body.product, color_name: req.body.color_name, color_code: req.body.color_code, createdAt: new Date() });
    res.redirect("/admin/product-colors");
  });
  router.post("/product-colors/:id", (req, res) => {
    const i = PRODUCT_COLORS.findIndex(x => x._id == req.params.id);
    if (i > -1) {
      PRODUCT_COLORS[i] = { ...PRODUCT_COLORS[i], product: req.body.product, color_name: req.body.color_name, color_code: req.body.color_code };
    }
    res.redirect("/admin/product-colors");
  });
  router.post("/product-colors/:id/delete", (req, res) => {
    PRODUCT_COLORS = PRODUCT_COLORS.filter(x => x._id != req.params.id);
    res.redirect("/admin/product-colors");
  });

  router.get("/product-sizes", (req, res) => {
    const p = paginate(PRODUCT_SIZES, 1, 50);
    res.render("entity_index", {
      title: "Kích cỡ", pageHeading: "Kích cỡ",
      items: p.items, fields: ["product", "size_name", "size_order", "createdAt"],
      pagination: { ...p, baseUrl: "/admin/product-sizes?page=" }
    });
  });
  router.get("/product-sizes/new", (req, res) => res.render("entity_form", {
    title: "Thêm size", pageHeading: "Thêm size", item: null,
    fields: ["product", "size_name", "size_order"], actionBase: "/admin/product-sizes"
  }));
  router.get("/product-sizes/:id", (req, res) => {
    const item = PRODUCT_SIZES.find(x => x._id == req.params.id);
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa size", pageHeading: "Sửa size", item,
      fields: ["product", "size_name", "size_order"], actionBase: "/admin/product-sizes"
    });
  });
  router.post("/product-sizes", (req, res) => {
    PRODUCT_SIZES.unshift({ _id: "ps" + Date.now(), product: req.body.product, size_name: req.body.size_name, size_order: Number(req.body.size_order || 0), createdAt: new Date() });
    res.redirect("/admin/product-sizes");
  });
  router.post("/product-sizes/:id", (req, res) => {
    const i = PRODUCT_SIZES.findIndex(x => x._id == req.params.id);
    if (i > -1) {
      PRODUCT_SIZES[i] = { ...PRODUCT_SIZES[i], product: req.body.product, size_name: req.body.size_name, size_order: Number(req.body.size_order || 0) };
    }
    res.redirect("/admin/product-sizes");
  });
  router.post("/product-sizes/:id/delete", (req, res) => {
    PRODUCT_SIZES = PRODUCT_SIZES.filter(x => x._id != req.params.id);
    res.redirect("/admin/product-sizes");
  });

  // ========== Brands / Categories (generic) ==========
  router.get("/brands", async (req, res) => {
    await tryLoadBrands(req);
    const p = paginate(BRANDS, 1, 100);
    res.render("entity_index", { title: "Thương hiệu", pageHeading: "Thương hiệu", items: p.items, fields: ["name", "slug", "createdAt"], pagination: { ...p, baseUrl: "/admin/brands?page=" } });
  });
  router.get("/brands/new", (req, res) => res.render("entity_form", { title: "Thêm thương hiệu", pageHeading: "Thêm thương hiệu", item: null, fields: ["name", "slug"], actionBase: "/admin/brands" }));
  router.get("/brands/:id", (req, res) => { const item = BRANDS.find(x => x._id == req.params.id); if (!item) return res.status(404).send("Not found"); res.render("entity_form", { title: "Sửa thương hiệu", pageHeading: "Sửa thương hiệu", item, fields: ["name", "slug"], actionBase: "/admin/brands" }); });
  router.post("/brands", (req, res) => { BRANDS.unshift({ _id: "b" + Date.now(), name: req.body.name, slug: req.body.slug, createdAt: new Date() }); res.redirect("/admin/brands"); });
  router.post("/brands/:id", (req, res) => { const i = BRANDS.findIndex(x => x._id == req.params.id); if (i > -1) { BRANDS[i] = { ...BRANDS[i], name: req.body.name, slug: req.body.slug } } res.redirect("/admin/brands"); });
  router.post("/brands/:id/delete", (req, res) => { BRANDS = BRANDS.filter(x => x._id != req.params.id); res.redirect("/admin/brands"); });

  router.get("/categories", async (req, res) => {
    await tryLoadCategories(req);
    const p = paginate(CATEGORIES, 1, 100);
    res.render("entity_index", { title: "Danh mục", pageHeading: "Danh mục", items: p.items, fields: ["name", "slug", "description", "createdAt"], pagination: { ...p, baseUrl: "/admin/categories?page=" } });
  });
  router.get("/categories/new", (req, res) => res.render("entity_form", { title: "Thêm danh mục", pageHeading: "Thêm danh mục", item: null, fields: ["name", "slug", "description"], actionBase: "/admin/categories" }));
  router.get("/categories/:id", (req, res) => { const item = CATEGORIES.find(x => x._id == req.params.id); if (!item) return res.status(404).send("Not found"); res.render("entity_form", { title: "Sửa danh mục", pageHeading: "Sửa danh mục", item, fields: ["name", "slug", "description"], actionBase: "/admin/categories" }); });
  router.post("/categories", (req, res) => { CATEGORIES.unshift({ _id: "c" + Date.now(), name: req.body.name, slug: req.body.slug, description: req.body.description, createdAt: new Date() }); res.redirect("/admin/categories"); });
  router.post("/categories/:id", (req, res) => { const i = CATEGORIES.findIndex(x => x._id == req.params.id); if (i > -1) { CATEGORIES[i] = { ...CATEGORIES[i], name: req.body.name, slug: req.body.slug, description: req.body.description } } res.redirect("/admin/categories"); });
  router.post("/categories/:id/delete", (req, res) => { CATEGORIES = CATEGORIES.filter(x => x._id != req.params.id); res.redirect("/admin/categories"); });

  // ========== Orders ==========
  router.get("/orders", (req, res) => {
    const { page = 1 } = req.query;
    const p = paginate(ORDERS, page, 10);
    res.render("orders_index", {
      title: "Đơn hàng",
      pageHeading: "Đơn hàng",
      items: p.items,
      query: req.query,
      pagination: { ...p, baseUrl: baseUrl(req) }
    });
  });
  router.get("/orders/:id", (req, res) => {
    const order = ORDERS.find(o => o._id === req.params.id);
    if (!order) return res.status(404).send("Không tìm thấy đơn");
    res.render("order_detail", { title: `Đơn ${order._id}`, pageHeading: `Đơn #${order._id}`, order });
  });
  router.post("/orders/:id/status", (req, res) => {
    const order = ORDERS.find(o => o._id === req.params.id);
    if (order && req.body.status) {
      order.current_status = req.body.status;
      order.status_history.push({ status: req.body.status, timestamp: new Date() });
    }
    res.redirect("/admin/orders/" + req.params.id);
  });

  // ========== Discounts ==========
  router.get("/discounts", (req, res) => {
    const p = paginate(DISCOUNTS, 1, DISCOUNTS.length);
    res.render("discounts_index", { title: "Mã giảm giá", pageHeading: "Mã giảm giá", items: p.items, pagination: { ...p, baseUrl: "/admin/discounts?page=" } });
  });
  router.post("/discounts", (req, res) => {
    const { code, discount_value, usage_limit, is_active } = req.body;
    if (code && String(code).length === 5) {
      DISCOUNTS.unshift({
        code: String(code).toUpperCase(),
        discount_value: Number(discount_value || 0),
        usage_limit: Number(usage_limit || 1),
        usage_count: 0,
        is_active: Boolean(is_active),
        createdAt: new Date()
      });
    }
    res.redirect("/admin/discounts");
  });
  router.post("/discounts/:code/delete", (req, res) => { DISCOUNTS = DISCOUNTS.filter(x => x.code !== req.params.code); res.redirect("/admin/discounts"); });

  // ========== Users ==========
  router.get("/users", (req, res) => { const p = paginate(USERS, 1, 20); res.render("users_index", { title: "Người dùng", pageHeading: "Người dùng", items: p.items }); });
  router.post("/users/:id/delete", (req, res) => { USERS = USERS.filter(x => x._id !== req.params.id); res.redirect("/admin/users"); });

  // ========== Generic helpers: Addresses / Reviews / Wishlists ==========
  function renderEntityIndex(res, title, items, fields) {
    res.render("entity_index", { title, pageHeading: title, items, fields, pagination: { itemsCount: items.length } });
  }
  function renderEntityForm(res, title, item, fields, actionBase) {
    res.render("entity_form", { title, pageHeading: title, item, fields, actionBase });
  }

  router.get("/addresses", (req, res) => renderEntityIndex(res, "Địa chỉ", ADDRESSES, ["user", "address_line", "is_default", "createdAt"]));
  router.get("/addresses/new", (req, res) => renderEntityForm(res, "Thêm địa chỉ", null, ["user", "address_line", "is_default"], "/admin/addresses"));
  router.get("/addresses/:id", (req, res) => { const item = ADDRESSES.find(x => x._id == req.params.id); if (!item) return res.status(404).send("Not found"); renderEntityForm(res, "Sửa địa chỉ", item, ["user", "address_line", "is_default"], "/admin/addresses"); });
  router.post("/addresses", (req, res) => { ADDRESSES.unshift({ _id: "ad" + Date.now(), user: req.body.user, address_line: req.body.address_line, is_default: Boolean(req.body.is_default), createdAt: new Date() }); res.redirect("/admin/addresses"); });
  router.post("/addresses/:id", (req, res) => { const i = ADDRESSES.findIndex(x => x._id == req.params.id); if (i > -1) { ADDRESSES[i] = { ...ADDRESSES[i], user: req.body.user, address_line: req.body.address_line, is_default: Boolean(req.body.is_default) } } res.redirect("/admin/addresses"); });
  router.post("/addresses/:id/delete", (req, res) => { ADDRESSES = ADDRESSES.filter(x => x._id != req.params.id); res.redirect("/admin/addresses"); });

  router.get("/reviews", (req, res) => renderEntityIndex(res, "Đánh giá", REVIEWS, ["product", "user", "guest_name", "guest_email", "rating", "comment", "createdAt"]))
  router.get("/reviews/new", (req, res) => renderEntityForm(res, "Thêm đánh giá", null, ["product", "user", "guest_name", "guest_email", "rating", "comment"], "/admin/reviews"));
  router.get("/reviews/:id", (req, res) => { const item = REVIEWS.find(x => x._id == req.params.id); if (!item) return res.status(404).send("Not found"); renderEntityForm(res, "Sửa đánh giá", item, ["product", "user", "guest_name", "guest_email", "rating", "comment"], "/admin/reviews"); });
  router.post("/reviews", (req, res) => { REVIEWS.unshift({ _id: "rv" + Date.now(), product: req.body.product, user: req.body.user, guest_name: req.body.guest_name || null, guest_email: req.body.guest_email || null, comment: req.body.comment, rating: Number(req.body.rating || 0), createdAt: new Date() }); res.redirect("/admin/reviews"); });
  router.post("/reviews/:id", (req, res) => { const i = REVIEWS.findIndex(x => x._id == req.params.id); if (i > -1) { REVIEWS[i] = { ...REVIEWS[i], product: req.body.product, user: req.body.user, guest_name: req.body.guest_name, guest_email: req.body.guest_email, comment: req.body.comment, rating: Number(req.body.rating || 0) } } res.redirect("/admin/reviews"); });
  router.post("/reviews/:id/delete", (req, res) => { REVIEWS = REVIEWS.filter(x => x._id != req.params.id); res.redirect("/admin/reviews"); });

  router.get("/wishlists", (req, res) => renderEntityIndex(res, "Wishlist", WISHLISTS, ["user", "product_variant_sku", "createdAt"]))
  router.get("/wishlists/new", (req, res) => renderEntityForm(res, "Thêm wishlist", null, ["user", "product_variant_sku"], "/admin/wishlists"));
  router.get("/wishlists/:id", (req, res) => { const item = WISHLISTS.find(x => x._id == req.params.id); if (!item) return res.status(404).send("Not found"); renderEntityForm(res, "Sửa wishlist", item, ["user", "product_variant_sku"], "/admin/wishlists"); });
  router.post("/wishlists", (req, res) => { WISHLISTS.unshift({ _id: "wl" + Date.now(), user: req.body.user, product_variant_sku: req.body.product_variant_sku, createdAt: new Date() }); res.redirect("/admin/wishlists"); });
  router.post("/wishlists/:id", (req, res) => { const i = WISHLISTS.findIndex(x => x._id == req.params.id); if (i > -1) { WISHLISTS[i] = { ...WISHLISTS[i], user: req.body.user, product_variant_sku: req.body.product_variant_sku } } res.redirect("/admin/wishlists"); });
  router.post("/wishlists/:id/delete", (req, res) => { WISHLISTS = WISHLISTS.filter(x => x._id != req.params.id); res.redirect("/admin/wishlists"); });

  // ========== Account: đổi mật khẩu & đăng xuất ==========
  router.get("/account/password", (req, res) => {
    res.render("account_password", {
      title: "Đổi mật khẩu",
      pageHeading: "Đổi mật khẩu",
      errorMsg: null,
      successMsg: null
    });
  });

  router.post("/account/password", (req, res) => {
    const { current_password, new_password, confirm_password } = req.body || {};
    const viewBase = { title: "Đổi mật khẩu", pageHeading: "Đổi mật khẩu" };

    if (!current_password || !new_password || !confirm_password) {
      return res.render("account_password", { ...viewBase, errorMsg: "Vui lòng nhập đủ thông tin.", successMsg: null });
    }
    if (current_password !== ADMIN_ACCOUNT.password) {
      return res.render("account_password", { ...viewBase, errorMsg: "Mật khẩu hiện tại không đúng.", successMsg: null });
    }
    if (new_password !== confirm_password) {
      return res.render("account_password", { ...viewBase, errorMsg: "Xác nhận mật khẩu không khớp.", successMsg: null });
    }
    if (new_password.length < 6) {
      return res.render("account_password", { ...viewBase, errorMsg: "Mật khẩu mới tối thiểu 6 ký tự.", successMsg: null });
    }
    ADMIN_ACCOUNT.password = new_password;
    return res.render("account_password", { ...viewBase, errorMsg: null, successMsg: "Đổi mật khẩu thành công." });
  });

  router.post("/logout", (_req, res) => {
    res.redirect("/admin?s=Đã đăng xuất");
  });

  return router;
};
