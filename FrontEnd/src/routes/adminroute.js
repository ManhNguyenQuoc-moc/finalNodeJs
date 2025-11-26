

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
  async function fetchUsers(req) {
    const fallback = () => USERS; // vẫn giữ mock cho trường hợp chưa có BACKEND

    try {
      if (!BACKEND) return fallback();

      // tuỳ backend của bạn, ở trên bạn nói: http://localhost:5000/api/user/
      const url = `${BACKEND}/api/user/`;
      const data = await fetchJSONAuth(req, url);

      // chuẩn theo response bạn gửi:
      // { success: true, users: [ ... ] }
      if (data && data.success && Array.isArray(data.users)) {
        return data.users;
      }

      // fallback: nếu BE trả array trực tiếp
      if (Array.isArray(data)) return data;

      throw new Error("Unexpected USERS payload from backend");
    } catch (err) {
      console.error("Fetch USERS failed:", err.message);
      return fallback();
    }
  }
  async function fetchCreateColor(req) {
    try {
      if (!BACKEND) {
        // fallback mock
        PRODUCT_COLORS.unshift({
          _id: "pc" + Date.now(),
          product: req.body.product,
          color_name: req.body.color_name,
          color_code: req.body.color_code,
          createdAt: new Date(),
        });
        return { ok: true, message: "Tạo màu (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/color`;
      const payload = {
        product: req.body.product || null,
        color_name: req.body.color_name,
        color_code: req.body.color_code,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Tạo màu thất bại");
      }

      return { ok: true, message: "Tạo màu thành công!", data: data.data };
    } catch (err) {
      console.error("Create COLOR failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo màu" };
    }
  }

  async function fetchUpdateColor(req, id) {
    try {
      if (!BACKEND) {
        const i = PRODUCT_COLORS.findIndex((x) => x._id == id);
        if (i === -1) return { ok: false, message: "Không tìm thấy màu (mock)" };

        PRODUCT_COLORS[i] = {
          ...PRODUCT_COLORS[i],
          product: req.body.product,
          color_name: req.body.color_name,
          color_code: req.body.color_code,
        };
        return { ok: true, message: "Cập nhật màu (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/color/${id}`;
      const payload = {
        product: req.body.product,
        color_name: req.body.color_name,
        color_code: req.body.color_code,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Cập nhật màu thất bại");
      }

      return { ok: true, message: "Cập nhật màu thành công!", data: data.data };
    } catch (err) {
      console.error("Update COLOR failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật màu" };
    }
  }

  async function fetchDeleteColor(req, id) {
    try {
      if (!BACKEND) {
        PRODUCT_COLORS = PRODUCT_COLORS.filter((x) => x._id != id);
        return { ok: true, message: "Xoá màu (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/color/${id}`;
      const data = await fetchJSONAuth(req, url, { method: "DELETE" });

      if (!data?.success) {
        throw new Error(data?.message || "Xoá màu thất bại");
      }

      return { ok: true, message: "Xoá màu thành công!" };
    } catch (err) {
      console.error("Delete COLOR failed:", err.message);
      return { ok: false, message: err.message || "Không thể xoá màu" };
    }
  }

  // ===== Helpers cho SIZE =====
  async function fetchCreateSize(req) {
    try {
      if (!BACKEND) {
        PRODUCT_SIZES.unshift({
          _id: "ps" + Date.now(),
          product: req.body.product,
          size_name: req.body.size_name,
          size_order: Number(req.body.size_order || 0),
          createdAt: new Date(),
        });
        return { ok: true, message: "Tạo size (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/size`;
      const payload = {
        product: req.body.product,
        size_name: req.body.size_name,
        size_order: Number(req.body.size_order || 0),
      };

      const data = await fetchJSONAuth(req, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Tạo size thất bại");
      }

      return { ok: true, message: "Tạo size thành công!", data: data.data };
    } catch (err) {
      console.error("Create SIZE failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo size" };
    }
  }

  async function fetchUpdateSize(req, id) {
    try {
      if (!BACKEND) {
        const i = PRODUCT_SIZES.findIndex((x) => x._id == id);
        if (i === -1) return { ok: false, message: "Không tìm thấy size (mock)" };

        PRODUCT_SIZES[i] = {
          ...PRODUCT_SIZES[i],
          product: req.body.product,
          size_name: req.body.size_name,
          size_order: Number(req.body.size_order || 0),
        };
        return { ok: true, message: "Cập nhật size (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/size/${id}`;
      const payload = {
        product: req.body.product,
        size_name: req.body.size_name,
        size_order: Number(req.body.size_order || 0),
      };

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Cập nhật size thất bại");
      }

      return { ok: true, message: "Cập nhật size thành công!", data: data.data };
    } catch (err) {
      console.error("Update SIZE failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật size" };
    }
  }

  async function fetchDeleteSize(req, id) {
    try {
      if (!BACKEND) {
        PRODUCT_SIZES = PRODUCT_SIZES.filter((x) => x._id != id);
        return { ok: true, message: "Xoá size (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/size/${id}`;
      const data = await fetchJSONAuth(req, url, { method: "DELETE" });

      if (!data?.success) {
        throw new Error(data?.message || "Xoá size thất bại");
      }

      return { ok: true, message: "Xoá size thành công!" };
    } catch (err) {
      console.error("Delete SIZE failed:", err.message);
      return { ok: false, message: err.message || "Không thể xoá size" };
    }
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
  // ===== Helpers cho CATEGORY =====
  async function fetchCreateCategory(req) {
    try {
      if (!BACKEND) {
        CATEGORIES.unshift({
          _id: "c" + Date.now(),
          name: req.body.name,
          slug: req.body.slug,
          description: req.body.description,
          createdAt: new Date(),
        });
        return { ok: true, message: "Tạo danh mục (mock) thành công!" };
      }

      const url = `${BACKEND}/api/category`;
      const payload = {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Tạo danh mục thất bại");
      }

      return { ok: true, message: "Tạo danh mục thành công!", data: data.data };
    } catch (err) {
      console.error("Create CATEGORY failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo danh mục" };
    }
  }

  async function fetchUpdateCategory(req, id) {
    try {
      if (!BACKEND) {
        const i = CATEGORIES.findIndex((x) => x._id == id);
        if (i === -1) return { ok: false, message: "Không tìm thấy danh mục (mock)" };

        CATEGORIES[i] = {
          ...CATEGORIES[i],
          name: req.body.name,
          slug: req.body.slug,
          description: req.body.description,
        };
        return { ok: true, message: "Cập nhật danh mục (mock) thành công!" };
      }

      // BE: router.put("/categories/:id") -> /api/category/categories/:id
      const url = `${BACKEND}/api/category/categories/${id}`;
      const payload = {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Cập nhật danh mục thất bại");
      }

      return { ok: true, message: "Cập nhật danh mục thành công!", data: data.data };
    } catch (err) {
      console.error("Update CATEGORY failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật danh mục" };
    }
  }

  async function fetchDeleteCategory(req, id) {
    try {
      if (!BACKEND) {
        CATEGORIES = CATEGORIES.filter((x) => x._id != id);
        return { ok: true, message: "Xoá danh mục (mock) thành công!" };
      }

      // BE: router.delete("/categories/:id") -> /api/category/categories/:id
      const url = `${BACKEND}/api/category/categories/${id}`;
      const data = await fetchJSONAuth(req, url, { method: "DELETE" });

      if (!data?.success) {
        throw new Error(data?.message || "Xoá danh mục thất bại");
      }

      return { ok: true, message: "Xoá danh mục thành công!" };
    } catch (err) {
      console.error("Delete CATEGORY failed:", err.message);
      return { ok: false, message: err.message || "Không thể xoá danh mục" };
    }
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
  async function fetchDiscountCodes(req) {
    // Nếu chưa cấu hình BACKEND → dùng mock DISCOUNTS + paginate local
    if (!BACKEND) {
      const { page = 1 } = req.query || {};
      const p = paginate(DISCOUNTS, page, 20); // page size tuỳ bạn
      return {
        items: p.items,
        pagination: {
          page: p.page,
          totalPages: p.totalPages,
          totalItems: p.totalItems,
          pageSize: 20,
        },
      };
    }

    try {
      // build query (page, limit, search nếu cần)
      const { page = 1, limit = 20 } = req.query || {};
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
      const url = `${BACKEND}/api/discount-code?${qs}`;

      const data = await fetchJSONAuth(req, url);

      // Chuẩn payload theo controller bạn đã viết:
      // {
      //   success: true,
      //   items: [...],
      //   pagination: { page, totalPages, totalItems, pageSize }
      // }
      if (data && data.success && Array.isArray(data.items)) {
        return {
          items: data.items,
          pagination: data.pagination || {
            page: Number(page) || 1,
            totalPages: 1,
            totalItems: data.items.length,
            pageSize: Number(limit) || data.items.length,
          },
        };
      }

      // fallback: nếu BE trả array trực tiếp
      if (Array.isArray(data)) {
        return {
          items: data,
          pagination: {
            page: Number(page) || 1,
            totalPages: 1,
            totalItems: data.length,
            pageSize: data.length,
          },
        };
      }

      throw new Error("Unexpected discount codes payload shape");
    } catch (err) {
      console.error("Fetch DISCOUNT CODES failed:", err.message);
      // lỗi thì trả rỗng để UI vẫn render được
      return {
        items: [],
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: 0,
          pageSize: 20,
        },
      };
    }
  }
  // Tạo mã giảm giá
  async function fetchCreateDiscountCode(req) {
    try {
      // Fallback local khi chưa có BACKEND
      if (!BACKEND) {
        const { code, discount_value, usage_limit, is_active } = req.body || {};
        if (!code || String(code).length !== 5) {
          return { ok: false, message: "Mã code phải đủ 5 ký tự" };
        }

        const upper = String(code).toUpperCase();
        const exist = DISCOUNTS.find(d => d.code === upper);
        if (exist) {
          return { ok: false, message: "Mã giảm giá đã tồn tại" };
        }

        DISCOUNTS.unshift({
          code: upper,
          discount_value: Number(discount_value || 0),
          usage_limit: Number(usage_limit || 1),
          usage_count: 0,
          is_active: Boolean(is_active),
          createdAt: new Date(),
        });

        return { ok: true, message: "Tạo mã giảm giá (mock) thành công!" };
      }

      const url = `${BACKEND}/api/discount-code`;
      const payload = {
        code: req.body.code,
        discount_value: Number(req.body.discount_value || 0),
        usage_limit: Number(req.body.usage_limit || 1),
        is_active: Boolean(req.body.is_active),
      };

      const data = await fetchJSONAuth(req, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Create discount failed");
      }

      return {
        ok: true,
        message: "Tạo mã giảm giá thành công!",
        data: data.data,
      };
    } catch (err) {
      console.error("Create DISCOUNT CODE failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo mã giảm giá" };
    }
  }

  // Lấy 1 mã giảm giá theo id
  async function fetchGetDiscountCode(req, id) {
    // Fallback mock: tìm theo code = id
    if (!BACKEND) {
      const item = DISCOUNTS.find(d => d.code === id);
      if (!item) throw new Error("Discount not found");
      return item;
    }

    const url = `${BACKEND}/api/discount-code/${id}`;
    const data = await fetchJSONAuth(req, url);
    if (!data?.success || !data?.data) {
      throw new Error(data?.message || "Discount not found");
    }
    return data.data;
  }

  // Cập nhật mã giảm giá
  async function fetchUpdateDiscountCode(req, id) {
    try {
      if (!BACKEND) {
        // mock: update theo code
        const i = DISCOUNTS.findIndex(d => d.code === id);
        if (i === -1) {
          return { ok: false, message: "Discount not found (mock)" };
        }

        DISCOUNTS[i] = {
          ...DISCOUNTS[i],
          discount_value: Number(req.body.discount_value ?? DISCOUNTS[i].discount_value),
          usage_limit: Number(req.body.usage_limit ?? DISCOUNTS[i].usage_limit),
          is_active: req.body.is_active !== undefined
            ? Boolean(req.body.is_active)
            : DISCOUNTS[i].is_active,
        };

        return { ok: true, message: "Cập nhật mã giảm giá (mock) thành công!" };
      }

      const url = `${BACKEND}/api/discount-code/${id}`;
      const payload = {
        discount_value: req.body.discount_value !== undefined
          ? Number(req.body.discount_value)
          : undefined,
        usage_limit: req.body.usage_limit !== undefined
          ? Number(req.body.usage_limit)
          : undefined,
        is_active: req.body.is_active !== undefined
          ? Boolean(req.body.is_active)
          : undefined,
      };

      // xoá các field undefined để tránh ghi đè bậy
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Update discount failed");
      }

      return {
        ok: true,
        message: "Cập nhật mã giảm giá thành công!",
        data: data.data,
      };
    } catch (err) {
      console.error("Update DISCOUNT CODE failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật mã giảm giá" };
    }
  }

  // Xoá mã giảm giá
  async function fetchDeleteDiscountCode(req, id) {
    try {
      if (!BACKEND) {
        DISCOUNTS = DISCOUNTS.filter(d => d.code !== id);
        return { ok: true, message: "Xoá mã giảm giá (mock) thành công!" };
      }

      const url = `${BACKEND}/api/discount-code/${id}`;
      const data = await fetchJSONAuth(req, url, { method: "DELETE" });

      if (!data?.success) {
        throw new Error(data?.message || "Delete discount failed");
      }

      return { ok: true, message: "Xoá mã giảm giá thành công!" };
    } catch (err) {
      console.error("Delete DISCOUNT CODE failed:", err.message);
      return { ok: false, message: err.message || "Không thể xoá mã giảm giá" };
    }
  }
  // ===== Helpers cho BRAND =====
  async function fetchCreateBrand(req) {
    try {
      if (!BACKEND) {
        BRANDS.unshift({
          _id: "b" + Date.now(),
          name: req.body.name,
          slug: req.body.slug,
          createdAt: new Date(),
        });
        return { ok: true, message: "Tạo thương hiệu (mock) thành công!" };
      }

      const url = `${BACKEND}/api/brand`;     // BE: router.post("/")
      const payload = {
        name: req.body.name,
        slug: req.body.slug,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Tạo thương hiệu thất bại");
      }

      return { ok: true, message: "Tạo thương hiệu thành công!", data: data.data };
    } catch (err) {
      console.error("Create BRAND failed:", err.message);
      return { ok: false, message: err.message || "Không thể tạo thương hiệu" };
    }
  }

  async function fetchUpdateBrand(req, id) {
    try {
      if (!BACKEND) {
        const i = BRANDS.findIndex((x) => x._id == id);
        if (i === -1) return { ok: false, message: "Không tìm thấy thương hiệu (mock)" };

        BRANDS[i] = {
          ...BRANDS[i],
          name: req.body.name,
          slug: req.body.slug,
        };
        return { ok: true, message: "Cập nhật thương hiệu (mock) thành công!" };
      }

      // BE: router.put("/brands/:id", ...) -> /api/brand/brands/:id
      const url = `${BACKEND}/api/brand/brands/${id}`;
      const payload = {
        name: req.body.name,
        slug: req.body.slug,
      };

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Cập nhật thương hiệu thất bại");
      }

      return { ok: true, message: "Cập nhật thương hiệu thành công!", data: data.data };
    } catch (err) {
      console.error("Update BRAND failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật thương hiệu" };
    }
  }

  async function fetchDeleteBrand(req, id) {
    try {
      if (!BACKEND) {
        BRANDS = BRANDS.filter((x) => x._id != id);
        return { ok: true, message: "Xoá thương hiệu (mock) thành công!" };
      }
      // BE: router.delete("/brands/:id") -> /api/brand/brands/:id
      const url = `${BACKEND}/api/brand/brands/${id}`;
      const data = await fetchJSONAuth(req, url, { method: "DELETE" });

      if (!data?.success) {
        throw new Error(data?.message || "Xoá thương hiệu thất bại");
      }

      return { ok: true, message: "Xoá thương hiệu thành công!" };
    } catch (err) {
      console.error("Delete BRAND failed:", err.message);
      return { ok: false, message: err.message || "Không thể xoá thương hiệu" };
    }
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
          form.append(
            f.fieldname,
            new Blob([f.buffer], { type: f.mimetype || "application/octet-stream" }),
            f.originalname || "file"
          );
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
  async function fetchUpdateProduct(req, id) {
    try {
      if (!BACKEND) throw new Error("BACKEND is not configured");
      const url = `${BACKEND}/api/product/${id}`;

      const form = new FormData();

      // ---- Text fields giống Postman ----
      const textKeys = [
        "name", "slug", "brand", "category",
        "short_description", "long_description", "statusName",
        "imagesToDelete" // quan trọng cho xoá ảnh product
      ];
      for (const k of textKeys) {
        if (req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "") {
          form.append(k, String(req.body[k]));
        }
      }

      // ---- variants: luôn là JSON string ----
      if (req.body.variants !== undefined) {
        const v = req.body.variants;
        form.append("variants", typeof v === "string" ? v : JSON.stringify(v));
      }

      // ---- Files: productImages & variantImagesMap[*] ----
      if (Array.isArray(req.files)) {
        for (const f of req.files) {
          form.append(
            f.fieldname,
            new Blob([f.buffer], { type: f.mimetype || "application/octet-stream" }),
            f.originalname || "file"
          );
        }
      }

      const resp = await fetch(url, {
        method: "PUT",
        headers: { cookie: req.headers.cookie || "" },
        body: form,
        redirect: "manual",
      });

      let data = {};
      try { data = await resp.json(); } catch { }

      if (!resp.ok) {
        return { ok: false, message: data?.message || `[${resp.status}] Update failed` };
      }

      // tuỳ backend trả gì, mình chỉ cần message
      return {
        ok: true,
        message: data?.message || `Cập nhật sản phẩm thành công!`
      };
    } catch (err) {
      console.error("Update PRODUCT failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật sản phẩm" };
    }
  }
  // === Load VARIANTS (tồn kho) ===
  // let VARIANTS_PAGINATION = {
  //   page: 1,
  //   totalPages: 1,
  //   totalItems: PRODUCT_VARIANTS.length,
  //   pageSize: 50,
  // };

  async function tryLoadVariants(req) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 50;

    // Không có BACKEND -> dùng mock
    if (!BACKEND) {
      const p = paginate(PRODUCT_VARIANTS, page, limit);
      VARIANTS_PAGINATION = {
        page: p.page,
        totalPages: p.totalPages,
        totalItems: p.totalItems,
        pageSize: p.pageSize,
      };
      return { items: p.items, pagination: VARIANTS_PAGINATION };
    }

    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      }).toString();

      const url = `${BACKEND}/api/product/variants?${qs}`;
      const data = await fetchJSONAuth(req, url).catch(() => null);

      console.log("VARIANTS API payload:", JSON.stringify(data).slice(0, 500));

      // ----- BÓC ITEMS THEO NHIỀU DẠNG PHỔ BIẾN -----
      let rawItems = [];
      let total = 0;
      let totalPages = 1;
      let pageSize = limit;

      if (data && data.success) {
        // 1) { success:true, items:[...], total, page, limit, totalPages }
        if (Array.isArray(data.items)) {
          rawItems = data.items;
          total = data.total ?? data.items.length;
          totalPages = data.totalPages ?? 1;
          pageSize = data.limit ?? limit;
        }
        // 2) { success:true, data:[...] }
        else if (Array.isArray(data.data)) {
          rawItems = data.data;
          total = rawItems.length;
        }
        // 3) { success:true, data:{ items:[...], total,... } }
        else if (data.data && Array.isArray(data.data.items)) {
          rawItems = data.data.items;
          total = data.data.total ?? rawItems.length;
          totalPages = data.data.totalPages ?? 1;
          pageSize = data.data.limit ?? limit;
        }
      } else if (Array.isArray(data)) {
        // 4) Trả array trực tiếp
        rawItems = data;
        total = rawItems.length;
      }

      // Nếu vẫn không có items -> fallback mock
      if (!Array.isArray(rawItems) || !rawItems.length) {
        console.warn("VARIANTS: no items from backend, fallback to mock");
        const p = paginate(PRODUCT_VARIANTS, page, limit);
        VARIANTS_PAGINATION = {
          page: p.page,
          totalPages: p.totalPages,
          totalItems: p.totalItems,
          pageSize: p.pageSize,
        };
        return { items: p.items, pagination: VARIANTS_PAGINATION };
      }

      // ----- MAP RA DATA PHẲNG CHO FORM ADMIN (edit tồn kho) -----
      PRODUCT_VARIANTS = rawItems.map((v) => {
        const productName = v.product?.name || v.product_name || "";
        const productId = v.product?._id || v.product_id || "";
        const colorName = v.color?.color_name || v.color_name || "";
        const sizeName = v.size?.size_name || v.size_name || "";
        const imageUrl =
          (Array.isArray(v.images) && (v.images[0]?.url || v.images[0])) ||
          (Array.isArray(v.product?.images) &&
            (v.product.images[0]?.url || v.product.images[0])) ||
          "";

        return {
          _id: v._id || v.id || v.sku,
          sku: v.sku,
          product: productName,
          product_id: productId,
          color: colorName,
          size: sizeName,
          price: v.price,
          stock_quantity: v.stock_quantity,
          image_url: imageUrl,
        };
      });

      VARIANTS_PAGINATION = {
        page: data.page || page,
        totalPages,
        totalItems: total || PRODUCT_VARIANTS.length,
        pageSize,
      };

      // ⬅️ Quan trọng: list dùng RAW items để EJS đọc product/color/size/images
      return { items: rawItems, pagination: VARIANTS_PAGINATION };
    } catch (e) {
      console.error("Load VARIANTS failed:", e.message);
      const p = paginate(PRODUCT_VARIANTS, page, limit);
      VARIANTS_PAGINATION = {
        page: p.page,
        totalPages: p.totalPages,
        totalItems: p.totalItems,
        pageSize: p.pageSize,
      };
      return { items: p.items, pagination: VARIANTS_PAGINATION };
    }
  }


  async function fetchUpdateVariantStockAdmin(req, id) {
    try {
      if (!BACKEND) {
        const i = PRODUCT_VARIANTS.findIndex((x) => String(x._id || x.sku) === String(id));
        if (i === -1) return { ok: false, message: "Variant not found (mock)" };
        PRODUCT_VARIANTS[i] = {
          ...PRODUCT_VARIANTS[i],
          price: Number(req.body.price || PRODUCT_VARIANTS[i].price || 0),
          stock_quantity: Number(req.body.stock_quantity || PRODUCT_VARIANTS[i].stock_quantity || 0),
        };
        return { ok: true, message: "Cập nhật tồn kho (mock) thành công!" };
      }

      const url = `${BACKEND}/api/product/variants/${id}/stock`;
      const payload = {
        price: req.body.price !== undefined ? Number(req.body.price) : undefined,
        stock_quantity: req.body.stock_quantity !== undefined ? Number(req.body.stock_quantity) : undefined,
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const data = await fetchJSONAuth(req, url, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        throw new Error(data?.message || "Cập nhật tồn kho thất bại");
      }

      return { ok: true, message: "Cập nhật tồn kho thành công!" };
    } catch (err) {
      console.error("Update VARIANT STOCK failed:", err.message);
      return { ok: false, message: err.message || "Không thể cập nhật tồn kho" };
    }
  }

  // ===== Lấy 1 variant theo id cho trang Admin =====
  async function fetchVariantByIdAdmin(req, id) {
    try {
      // Mock mode: dùng dữ liệu local
      if (!BACKEND) {
        await tryLoadVariants(req); // đảm bảo PRODUCT_VARIANTS đã được fill
        return (
          PRODUCT_VARIANTS.find(
            (x) => String(x._id || x.sku) === String(id)
          ) || null
        );
      }

      const url = `${BACKEND}/api/product/variants/${id}`;
      const data = await fetchJSONAuth(req, url).catch(() => null);

      console.log(
        "VARIANT DETAIL payload:",
        data ? JSON.stringify(data).slice(0, 500) : "null"
      );

      let v = null;

      // BE trả { success: true, data: {...} }
      if (data?.success && data?.data) {
        v = data.data;
      }
      // Hoặc trả thẳng object variant
      else if (data && (data._id || data.id || data.sku)) {
        v = data;
      }

      if (!v) return null;

      const productName = v.product?.name || v.product_name || "";
      const productId = v.product?._id || v.product_id || "";
      const colorName = v.color?.color_name || v.color_name || "";
      const sizeName = v.size?.size_name || v.size_name || "";
      const imageUrl =
        (Array.isArray(v.images) && (v.images[0]?.url || v.images[0])) ||
        (Array.isArray(v.product?.images) &&
          (v.product.images[0]?.url || v.product.images[0])) ||
        "";

      // Trả về dạng phẳng giống tryLoadVariants để form dùng chung
      return {
        _id: v._id || v.id || v.sku,
        sku: v.sku,
        product: productName,
        product_id: productId,
        color: colorName,
        size: sizeName,
        price: v.price,
        stock_quantity: v.stock_quantity,
        image_url: imageUrl,
      };
    } catch (err) {
      console.error("Fetch VARIANT by id failed:", err.message);
      return null;
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
    return {
      items: array.slice(start, end),
      page: current,
      totalPages,
      totalItems,
      pageSize,
    };
  }
  function baseUrl(req) {
    const q = new URLSearchParams(req.query);
    q.delete("page");

    const prefix = req.baseUrl || "";  // '/admin'
    const path = req.path || "";     // '/products'
    const url = prefix + path;      // '/admin/products'

    return url + (q.toString() ? `?${q.toString()}&page=` : "?page=");
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
        console.log("Load product by id data:", data);
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
      const images = Array.isArray(v?.images)
        ? v.images.map(img => ({
          url: img?.url || "",
          public_id: img?.public_id || "",
          is_primary: !!img?.is_primary,
        }))
        : [];

      let primaryIndex = images.findIndex(i => i.is_primary);
      if (primaryIndex < 0) primaryIndex = 0;

      return {
        // GIỮ ID LẠI
        id: String(v?._id || v?.id || ""),
        _id: String(v?._id || v?.id || ""), // optional, nếu muốn
        sku: String(v?.sku || "").trim(),
        price: Number(v?.price ?? 0),
        stock_quantity: Number(v?.stock_quantity ?? 0),
        color: v?.color ? String(v.color) : "",
        size: v?.size ? String(v.size) : "",
        images,
        primaryIndex,
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
    console.log("[ADMIN IN] fields:", Object.keys(req.body));
    console.log("[ADMIN IN] variants(raw):", typeof req.body.variants, String(req.body.variants).slice(0, 200));
    console.log("[ADMIN IN] files:", (req.files || []).map(f => ({
      fieldname: f.fieldname, name: f.originalname, size: f.size
    })));
    const r = await fetchCreateProduct(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    return res.redirect(`/admin/products?${q.toString()}`);
  });

  router.post("/products/:id", upload.any(), async (req, res) => {
    console.log("[ADMIN UPDATE IN] fields:", Object.keys(req.body));
    console.log("[ADMIN UPDATE IN] variants(raw):", typeof req.body.variants, String(req.body.variants || "").slice(0, 300));
    console.log("[ADMIN UPDATE IN] files:", (req.files || []).map(f => ({
      fieldname: f.fieldname, name: f.originalname, size: f.size
    })));

    const r = await fetchUpdateProduct(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    return res.redirect(`/admin/products?${q.toString()}`);
  });
  router.post("/products/:id/delete", (req, res) => { PRODUCTS = PRODUCTS.filter(x => x._id !== req.params.id); res.redirect("/admin/products"); });

  router.get("/product-variants", async (req, res) => {
    const { items: rawItems, pagination } = await tryLoadVariants(req);

    let items = rawItems || [];

    const {
      q,
      color,
      price_min,
      price_max,
      stock_min,
      stock_max,
    } = req.query || {};

    // Tìm theo SKU hoặc tên sản phẩm
    if (q) {
      const qLower = String(q).toLowerCase();
      items = items.filter((v) => {
        const sku = (v.sku || "").toLowerCase();
        const productName = (v.product && v.product.name
          ? v.product.name
          : v.product_name || ""
        ).toLowerCase();
        return sku.includes(qLower) || productName.includes(qLower);
      });
    }

    // Lọc theo màu (theo color.color_name hoặc color_name)
    if (color) {
      const cLower = String(color).toLowerCase();
      items = items.filter((v) => {
        const colorName =
          (v.color && v.color.color_name) ||
          v.color_name ||
          "";
        return String(colorName).toLowerCase() === cLower;
      });
    }

    // Lọc theo giá
    if (price_min) {
      const min = Number(price_min);
      items = items.filter((v) => Number(v.price || 0) >= min);
    }
    if (price_max) {
      const max = Number(price_max);
      items = items.filter((v) => Number(v.price || 0) <= max);
    }

    // Lọc theo tồn kho
    if (stock_min) {
      const minS = Number(stock_min);
      items = items.filter((v) => Number(v.stock_quantity || 0) >= minS);
    }
    if (stock_max) {
      const maxS = Number(stock_max);
      items = items.filter((v) => Number(v.stock_quantity || 0) <= maxS);
    }

    // Danh sách màu để đổ vào select lọc màu
    const colorOptions = Array.from(
      new Set(
        (rawItems || []).map((v) => {
          const colorName =
            (v.color && v.color.color_name) ||
            v.color_name ||
            "";
          return colorName || null;
        })
      )
    ).filter(Boolean);

    res.render("entity_index", {
      title: "Tồn kho",
      pageHeading: "Tồn kho",
      items,
      fields: ["sku", "product", "color", "size", "price", "stock_quantity"],
      pagination: {
        ...pagination,
        baseUrl: baseUrl(req), // /admin/product-variants?...&page=
      },
      query: req.query || {},
      colorOptions,
    });
  });


  router.get("/product-variants/:id", async (req, res) => {
    const item = await fetchVariantByIdAdmin(req, req.params.id);

    if (!item) return res.status(404).send("Not found");

    res.render("entity_form", {
      title: "Sửa tồn kho",
      pageHeading: "Sửa tồn kho",
      item,
      // thực tế chỉ cần sửa price + stock_quantity
      fields: ["sku", "product", "color", "size", "price", "stock_quantity"],
      actionBase: "/admin/product-variants",
    });
  });
  router.post("/product-variants/:id", async (req, res) => {
    const r = await fetchUpdateVariantStockAdmin(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-variants?${q.toString()}`);
  });
  router.get("/product-colors", async (req, res) => {
    await tryLoadColors(req);
    const p = paginate(PRODUCT_COLORS, 1, 50);

    res.render("entity_index", {
      title: "Màu sắc",
      pageHeading: "Màu sắc",
      items: p.items,
      // fields để entity_index.ejs render cột
      fields: ["product", "color_name", "color_code", "createdAt"],
      pagination: {
        ...p,
        baseUrl: "/admin/product-colors?page=",
      },
    });
  });

  router.get("/product-colors/new", (req, res) => res.render("entity_form", {
    title: "Thêm màu", pageHeading: "Thêm màu", item: null,
    fields: ["product", "color_name", "color_code"], actionBase: "/admin/product-colors"
  }));
  router.get("/product-colors", async (req, res) => { const p = paginate(PRODUCT_COLORS, 1, 50); res.render("entity_index", { title: "Màu sắc", pageHeading: "Màu sắc", items: p.items, fields: ["product", "color_name", "color_code", "createdAt"], pagination: { ...p, baseUrl: "/admin/product-colors?page=" } }); });
  router.get("/product-colors/:id", async (req, res) => {
    await tryLoadColors(req);
    const item = PRODUCT_COLORS.find(x => String(x._id) == String(req.params.id));
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa màu", pageHeading: "Sửa màu", item,
      fields: ["product", "color_name", "color_code"], actionBase: "/admin/product-colors"
    });
  });

  router.post("/product-colors", async (req, res) => {
    const r = await fetchCreateColor(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-colors?${q.toString()}`);
  });

  router.post("/product-colors/:id", async (req, res) => {
    const r = await fetchUpdateColor(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-colors?${q.toString()}`);
  });

  router.post("/product-colors/:id/delete", async (req, res) => {
    const r = await fetchDeleteColor(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-colors?${q.toString()}`);
  });

  router.get("/product-sizes", async (req, res) => {
    await tryLoadSizes(req);
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

  router.get("/product-sizes/:id", async (req, res) => {
    await tryLoadSizes(req);
    const item = PRODUCT_SIZES.find(x => String(x._id) == String(req.params.id));
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa size", pageHeading: "Sửa size", item,
      fields: ["product", "size_name", "size_order"], actionBase: "/admin/product-sizes"
    });
  });

  router.post("/product-sizes", async (req, res) => {
    const r = await fetchCreateSize(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-sizes?${q.toString()}`);
  });

  router.post("/product-sizes/:id", async (req, res) => {
    const r = await fetchUpdateSize(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-sizes?${q.toString()}`);
  });

  router.post("/product-sizes/:id/delete", async (req, res) => {
    const r = await fetchDeleteSize(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/product-sizes?${q.toString()}`);
  });

  // ========== Brands / Categories (generic) ==========
  router.get("/brands", async (req, res) => {
    await tryLoadBrands(req);
    const p = paginate(BRANDS, 1, 100);
    res.render("entity_index", { title: "Thương hiệu", pageHeading: "Thương hiệu", items: p.items, fields: ["name", "slug", "createdAt"], pagination: { ...p, baseUrl: "/admin/brands?page=" } });
  });
  router.get("/brands/new", (req, res) =>
    res.render("entity_form", {
      title: "Thêm thương hiệu",
      pageHeading: "Thêm thương hiệu",
      item: null,
      fields: ["name", "slug"],
      actionBase: "/admin/brands",
    })
  );

  router.get("/brands/:id", (req, res) => {
    const item = BRANDS.find((x) => x._id == req.params.id);
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa thương hiệu",
      pageHeading: "Sửa thương hiệu",
      item,
      fields: ["name", "slug"],
      actionBase: "/admin/brands",
    });
  });

  // CREATE -> gọi BE POST /api/brand
  router.post("/brands", async (req, res) => {
    const r = await fetchCreateBrand(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/brands?${q.toString()}`);
  });

  // UPDATE -> gọi BE PUT /api/brand/brands/:id
  router.post("/brands/:id", async (req, res) => {
    const r = await fetchUpdateBrand(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/brands?${q.toString()}`);
  });

  // DELETE -> gọi BE DELETE /api/brand/brands/:id
  router.post("/brands/:id/delete", async (req, res) => {
    const r = await fetchDeleteBrand(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/brands?${q.toString()}`);
  });


  router.get("/categories", async (req, res) => {
    await tryLoadCategories(req);
    const p = paginate(CATEGORIES, 1, 100);
    res.render("entity_index", { title: "Danh mục", pageHeading: "Danh mục", items: p.items, fields: ["name", "slug", "description", "createdAt"], pagination: { ...p, baseUrl: "/admin/categories?page=" } });
  });
  router.get("/categories/new", (req, res) =>
    res.render("entity_form", {
      title: "Thêm danh mục",
      pageHeading: "Thêm danh mục",
      item: null,
      fields: ["name", "slug", "description"],
      actionBase: "/admin/categories",
    })
  );

  router.get("/categories/:id", (req, res) => {
    const item = CATEGORIES.find((x) => x._id == req.params.id);
    if (!item) return res.status(404).send("Not found");
    res.render("entity_form", {
      title: "Sửa danh mục",
      pageHeading: "Sửa danh mục",
      item,
      fields: ["name", "slug", "description"],
      actionBase: "/admin/categories",
    });
  });

  // CREATE -> BE POST /api/category
  router.post("/categories", async (req, res) => {
    const r = await fetchCreateCategory(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/categories?${q.toString()}`);
  });

  // UPDATE -> BE PUT /api/category/categories/:id
  router.post("/categories/:id", async (req, res) => {
    const r = await fetchUpdateCategory(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/categories?${q.toString()}`);
  });

  // DELETE -> BE DELETE /api/category/categories/:id
  router.post("/categories/:id/delete", async (req, res) => {
    const r = await fetchDeleteCategory(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/categories?${q.toString()}`);
  });


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

  // ========== Discounts ==========//
  router.get("/discounts", async (req, res) => {
    const { items, pagination } = await fetchDiscountCodes(req);

    res.render("discounts_index", {
      title: "Mã giảm giá",
      pageHeading: "Mã giảm giá",
      items,
      pagination: {
        ...pagination,
        baseUrl: "/admin/discounts?page=",
      },
    });
  });

  // Tạo mới mã giảm giá từ form Admin
  router.post("/discounts", async (req, res) => {
    const r = await fetchCreateDiscountCode(req);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/discounts?${q.toString()}`);
  });

  // (Tuỳ nhu cầu) Trang edit 1 mã giảm giá, dùng entity_form chung
  router.get("/discounts/:id", async (req, res) => {
    try {
      const item = await fetchGetDiscountCode(req, req.params.id);
      res.render("entity_form", {
        title: "Sửa mã giảm giá",
        pageHeading: "Sửa mã giảm giá",
        item,
        fields: ["code", "discount_value", "usage_limit", "usage_count", "is_active"],
        actionBase: "/admin/discounts",
      });
    } catch (err) {
      console.error("GET discount by id failed:", err.message);
      res.status(404).send("Không tìm thấy mã giảm giá");
    }
  });

  // Update từ form /admin/discounts/:id
  router.post("/discounts/:id", async (req, res) => {
    const r = await fetchUpdateDiscountCode(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/discounts?${q.toString()}`);
  });

  // Xoá mã giảm giá
  router.post("/discounts/:id/delete", async (req, res) => {
    const r = await fetchDeleteDiscountCode(req, req.params.id);
    const q = new URLSearchParams(r.ok ? { s: r.message } : { e: r.message });
    res.redirect(`/admin/discounts?${q.toString()}`);
  });
  // ========== Users ==========
  router.get("/users", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 20;
    const q = (req.query.q || "").trim().toLowerCase();

    // lấy users từ backend (hoặc mock nếu chưa config BACKEND)
    let list = await fetchUsers(req);

    // search theo tên / email
    if (q) {
      list = list.filter((u) => {
        const name = (u.full_name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    // sort cho “đẹp”: user mới tạo lên trước
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const p = paginate(list, page, pageSize);

    res.render("users_index", {
      title: "Người dùng",
      pageHeading: "Người dùng",
      items: p.items,
      q, // để giữ lại giá trị ô search
      pagination: {
        ...p,
        baseUrl: baseUrl(req), // /admin/users?...&page=
      },
    });
  });
  router.get("/users/:id", async (req, res) => {
    try {
      if (!BACKEND) {
        return res.status(500).send("BACKEND chưa được cấu hình");
      }

      const id = req.params.id;
      const data = await fetchJSONAuth(req, `${BACKEND}/api/user/${id}/details`);

      const user = data.user;
      const addresses = data.addresses || [];
      const orders = data.orders || [];

      if (!user) {
        return res.status(404).send("Không tìm thấy người dùng");
      }

      return res.render("user_detail", {
        title: `Người dùng: ${user.full_name || user.email}`,
        pageHeading: "Chi tiết người dùng",
        user,
        addresses,
        orders,
      });
    } catch (err) {
      console.error("Load user detail failed:", err.message);
      return res.status(500).send("Không thể tải thông tin người dùng");
    }
  });
  // Ban user
  router.post("/users/:id/ban", async (req, res) => {
    const id = req.params.id;
    try {
      if (BACKEND) {
        const url = `${BACKEND}/api/user/${id}/ban`;
        const data = await fetchJSONAuth(req, url, { method: "PATCH" });
        if (!data?.success) throw new Error(data?.message || "Không thể khóa người dùng");
      } else {
        // fallback mock
        const i = USERS.findIndex((u) => u._id === id);
        if (i > -1) USERS[i].is_banned = true;
      }
      res.redirect("/admin/users?s=Đã khóa người dùng");
    } catch (err) {
      console.error("Ban user failed:", err.message);
      res.redirect(`/admin/users?e=${encodeURIComponent(err.message || "Không thể khóa người dùng")}`);
    }
  });

  // Unban user
  router.post("/users/:id/unban", async (req, res) => {
    const id = req.params.id;
    try {
      if (BACKEND) {
        const url = `${BACKEND}/api/user/${id}/unban`;
        const data = await fetchJSONAuth(req, url, { method: "PATCH" });
        if (!data?.success) throw new Error(data?.message || "Không thể mở khóa người dùng");
      } else {
        // fallback mock
        const i = USERS.findIndex((u) => u._id === id);
        if (i > -1) USERS[i].is_banned = false;
      }
      res.redirect("/admin/users?s=Đã mở khóa người dùng");
    } catch (err) {
      console.error("Unban user failed:", err.message);
      res.redirect(`/admin/users?e=${encodeURIComponent(err.message || "Không thể mở khóa người dùng")}`);
    }
  });

  // Delete user
  router.post("/users/:id/delete", async (req, res) => {
    const id = req.params.id;
    try {
      if (BACKEND) {
        const url = `${BACKEND}/api/user/${id}`;
        const data = await fetchJSONAuth(req, url, { method: "DELETE" });
        if (!data?.success) throw new Error(data?.message || "Xoá user thất bại");
      } else {
        USERS = USERS.filter((x) => x._id !== id);
      }
      res.redirect("/admin/users?s=Đã xóa người dùng");
    } catch (err) {
      console.error("Delete user failed:", err.message);
      res.redirect(`/admin/users?e=${encodeURIComponent(err.message || "Không thể xóa người dùng")}`);
    }
  });


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
