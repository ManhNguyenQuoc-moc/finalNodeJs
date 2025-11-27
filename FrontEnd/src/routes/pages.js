// src/routes/pages.js — tách riêng FE routes
const express = require("express");

module.exports = function createPagesRouter({ BACKEND, proxy }) {
    const router = express.Router();

    // ====== Helpers chung ======
    function withQuery(url, params) {
        try {
            const u = new URL(url, "http://dummy");
            const s = new URLSearchParams(u.search);
            Object.entries(params || {}).forEach(([k, v]) => {
                if (v === null || v === undefined) return;
                if (v === "") s.delete(k); else s.set(k, v);
            });
            u.search = s.toString();
            return u.pathname + (u.search ? `?${u.search}` : "");
        } catch {
            const hasQ = url.includes("?");
            const q = new URLSearchParams(params).toString();
            return url + (hasQ ? "&" : "?") + q;
        }
    }
    function getSetCookie(resp) {
        if (typeof resp.headers.getSetCookie === "function") return resp.headers.getSetCookie();
        const one = resp.headers.get("set-cookie");
        return one ? [one] : [];
    }
    function getAccessTokenFromCookie(req) {
        const cookie = req.headers.cookie || "";
        const match = cookie.match(/accessToken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : null;
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
        const token = getAccessTokenFromCookie(req);

        const headers = {
            "Content-Type": "application/json",
            cookie: req?.headers?.cookie || "",
            ...(init.headers || {}),
        };

        if (token && !headers.Authorization) {
            headers.Authorization = `Bearer ${token}`;  // 👈 thêm auth header
        }

        return fetchJSONRaw(url, { ...init, headers });
    }
    async function postFormAndForwardCookies(req, res, url, bodyObj) {
        const form = new URLSearchParams();
        Object.entries(bodyObj || {}).forEach(([k, v]) => form.append(k, v));
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: req.headers.cookie || "" },
            body: form, redirect: "manual",
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
            const ct = r.headers.get("content-type") || "";
            const t = await r.text();
            if (!ct.includes("application/json")) return [];
            return JSON.parse(t || "[]");
        } catch { return []; }
    }

    // ====== EJS defaults ======
    router.use((req, res, next) => {
        const orig = res.render.bind(res);
        res.render = (view, locals = {}, cb) => {
            const defProducts = { content: [], totalPages: 1, number: 0, hasPrevious: false, hasNext: false };
            const formatPrice = (n) => new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + " đ";
            const merged = {
                title: "", error: null, success: null,
                activeAccountTab: "", status: "",
                brands: [], products: defProducts,
                productSizes: [], allImages: [], thumbImages: [],
                sort: "", color: "", price_range: "", brand: "", rating: "", q: "",
                formatPrice,
                ...locals,
                products: locals.products || defProducts,
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

    // ====== Common header: categories + minicart + user ======
    router.use(async (req, res, next) => {
        try {
            const catJson = await fetchJSONPublic(`${BACKEND}/api/page/categories`).catch(() => ({ ok: false, categories: [] }));
            res.locals.categories = (catJson.ok && Array.isArray(catJson.categories)) ? catJson.categories : [];
            const miniJson = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({ ok: false }));
            if (miniJson.ok) {
                res.locals.carts = miniJson.carts || [];
                res.locals.cartCount = miniJson.cartCount || 0;
                res.locals.total = miniJson.total || 0;
                res.locals.formattedTotal = miniJson.formattedTotal || "0 đ";
                res.locals.user = miniJson.user || null;
                res.locals.loggedInUser = !!miniJson.user;
            } else {
                res.locals.carts = []; res.locals.cartCount = 0; res.locals.total = 0; res.locals.formattedTotal = "0 đ"; res.locals.user = null; res.locals.loggedInUser = false;
            }
        } catch {
            res.locals.categories = []; res.locals.carts = []; res.locals.cartCount = 0; res.locals.total = 0; res.locals.formattedTotal = "0 đ"; res.locals.user = null; res.locals.loggedInUser = false;
        }
        next();
    });

    // ====== PAGES ======
    router.get(["/", "/home"], async (req, res) => {
        const data = await fetchJSONPublic(`${BACKEND}/api/page/home`).catch(() => ({ ok: true, latest: [], trending: [], popular: [], products: [] }));
        res.render("home", { title: "Trang chủ", ...data });
    });

    router.get("/category/alls", async (req, res) => {
        const params = new URLSearchParams(req.query).toString();
        const data = await fetchJSONPublic(`${BACKEND}/api/page/category/alls?${params}`).catch(() => ({ ok: true, products: [] }));
        const brands = await loadBrands(req);
        const list = Array.isArray(data.products) ? data.products : [];
        const pageNo = Math.max(parseInt(req.query.pageNo || "1", 10), 1);
        res.render("category", {
            title: "Danh mục",
            selectedCategoryId: "alls",
            selectedCategoryName: "Tất cả",
            brands,
            sort: req.query.sort || "", color: req.query.color || "", price_range: req.query.price_range || "",
            brand: req.query.brand || "", rating: req.query.rating || "", q: req.query.q || "",
            products: { content: list, totalPages: 1, number: pageNo - 1, hasPrevious: pageNo > 1, hasNext: false },
        });
    });

    router.get("/category/:id", async (req, res) => {
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
                sort: req.query.sort || "", color: req.query.color || "", price_range: req.query.price_range || "",
                brand: req.query.brand || "", rating: req.query.rating || "", q: req.query.q || "",
                products: { content: list, totalPages: 1, number: pageNo - 1, hasPrevious: pageNo > 1, hasNext: false },
            });
        } catch {
            return res.redirect("/category/alls");
        }
    });

    router.get("/about", (_req, res) => {
        res.render("about", { title: "Giới thiệu" });
    });

    router.get("/blog", (_req, res) => {
        res.render("blog", { title: "Blog" });
    });

    router.get("/contact", (_req, res) => {
        res.render("contact", { title: "Liên hệ" });
    });

    router.get("/search", async (req, res) => {
        const params = new URLSearchParams(req.query).toString();
        const data = await fetchJSONPublic(`${BACKEND}/api/page/search?${params}`).catch(() => ({ ok: true, products: [], q: "" }));
        res.render("product_search", { title: "Tìm kiếm", ...data });
    });

    // PRODUCT DETAIL (giữ nguyên logic build allImages/productSizes/variantMatrix)
    router.get("/product_detail/:id", async (req, res) => {
        try {
            const r = await fetch(`${BACKEND}/api/page/product/${req.params.id}`, {
                headers: { "Content-Type": "application/json" },
                redirect: "manual"
            });
            if (r.status === 404) return res.status(404).send("Sản phẩm không tồn tại");
            const ct = r.headers.get("content-type") || "";
            const text = await r.text();
            console.log("Product detail fetch response:", text);
            if (!r.ok || !ct.includes("application/json"))
                return res.status(500).send("Lỗi dữ liệu sản phẩm");

            const data = JSON.parse(text);

            const product = data?.product || {};
            const variants = Array.isArray(data?.variants) ? data.variants : [];
            console.log("Product variants loaded:", data);
            const imgs = [];
            if (Array.isArray(product.images))
                for (const im of product.images)
                    imgs.push(typeof im === "string" ? im : im?.url);
            for (const v of variants)
                if (Array.isArray(v?.images))
                    for (const im of v.images)
                        imgs.push(typeof im === "string" ? im : im?.url);

            const uniq = Array.from(new Set(imgs.filter(Boolean)));
            const allImages = (uniq.length ? uniq : ["/images/default.png"]);
            while (allImages.length > 0 && allImages.length < 3) allImages.push(allImages[0]);
            const thumbImages = allImages.slice(0, Math.min(6, allImages.length));

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
                    stock: v?.stock_quantity ?? null
                });
            }

            const variantMatrix = {};
            for (const v of variants) {
                const s = v?.size?._id ? String(v.size._id) : "";
                const c = v?.color?._id ? String(v.color._id) : "";
                if (s && c && v?.sku) variantMatrix[`${s}:${c}`] = v.sku;
            }

            const related = Array.isArray(data?.products) ? data.products : [];

            // truyền thêm variants vào EJS (và giữ nguyên toàn bộ data khác như reviews, loggedInUser...)
            res.render("product_detail", {
                ...data,                         // reviews, likerId, loggedInUser, v.v...
                title: product?.name || "Chi tiết sản phẩm",
                product,
                variants,
                products: related,
                allImages,
                thumbImages,
                productSizes,
                variantMatrix,
            });
        } catch {
            return res.status(500).send("Có lỗi khi tải chi tiết sản phẩm");
        }
    });


    // CART pages
    router.get("/cart", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({ ok: true, carts: [] }));
        const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
        res.render("cart", { title: "Giỏ hàng", isEmpty, ...data });
    });
    router.get("/shop-cart", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({ ok: true, carts: [] }));
        const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
        res.render("shop_cart", { title: "Giỏ hàng", isEmpty, ...data });
    });
    router.get("/shop-cart/checkout", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({ ok: true, carts: [] }));
        const isEmpty = !Array.isArray(data.carts) || data.carts.length === 0;
        res.render("shop_checkout", { title: "Thanh toán", isEmpty, ...data });
    });

    // AUTH pages & actions
    router.get("/login-register", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
        if (data.loggedInUser) return res.redirect("/my-account");
        res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, ...data });
    });
    router.get("/login", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
        if (data.loggedInUser) return res.redirect("/my-account");
        res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, activeTab: "login", ...data });
    });
    router.get("/register", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
        if (data.loggedInUser) return res.redirect("/my-account");
        res.render("login_register", { title: "Đăng nhập & Đăng ký", error: null, success: null, activeTab: "register", ...data });
    });
    // ====== FORGOT PASSWORD & RESET PASSWORD ======

    // Quên mật khẩu - form nhập email
    router.get("/forgot-password", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
        res.render("auth_forgot_password", {
            title: "Quên mật khẩu",
            error: null,
            success: null,
            email: "",
            ...data,
        });
    });

    // Xử lý submit quên mật khẩu -> gọi BE /api/auth/forgot-password
    router.post("/forgot-password", async (req, res) => {
        const { email } = req.body;
        const dataMini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));

        if (!email) {
            return res.render("auth_forgot_password", {
                title: "Quên mật khẩu",
                error: "Vui lòng nhập email.",
                success: null,
                email,
                ...dataMini,
            });
        }

        try {
            const resp = await fetch(`${BACKEND}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await resp.json().catch(() => null);

            if (!resp.ok) {
                return res.render("auth_forgot_password", {
                    title: "Quên mật khẩu",
                    error: (data && data.message) || "Không thể gửi email đặt lại mật khẩu.",
                    success: null,
                    email,
                    ...dataMini,
                });
            }

            return res.render("auth_forgot_password", {
                title: "Quên mật khẩu",
                error: null,
                success: data && data.message
                    ? data.message
                    : "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.",
                email,
                ...dataMini,
            });
        } catch (err) {
            console.error("Forgot-password FE error:", err);
            return res.render("auth_forgot_password", {
                title: "Quên mật khẩu",
                error: "Có lỗi xảy ra. Vui lòng thử lại sau.",
                success: null,
                email,
                ...dataMini,
            });
        }
    });

    // Trang reset password (từ link email: /reset-password?token=...)
    router.get("/reset-password", async (req, res) => {
        const token = req.query.token || "";
        if (!token) {
            return res.status(400).send("Token không hợp lệ.");
        }

        const dataMini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));

        return res.render("auth_reset_password", {
            title: "Đặt lại mật khẩu",
            token,
            error: null,
            formError: null,
            done: false,
            message: "",
            ...dataMini,
        });
    });

    // Xử lý submit reset password -> gọi BE /api/auth/reset-password
    router.post("/reset-password", async (req, res) => {
        const { token, password, confirm_password } = req.body;
        const dataMini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));

        if (!token) {
            return res.status(400).send("Token không hợp lệ.");
        }

        if (!password || !confirm_password) {
            return res.render("auth_reset_password", {
                title: "Đặt lại mật khẩu",
                token,
                error: null,
                formError: "Vui lòng nhập đầy đủ mật khẩu.",
                done: false,
                message: "",
                ...dataMini,
            });
        }

        if (password !== confirm_password) {
            return res.render("auth_reset_password", {
                title: "Đặt lại mật khẩu",
                token,
                error: null,
                formError: "Mật khẩu và xác nhận mật khẩu phải giống nhau.",
                done: false,
                message: "",
                ...dataMini,
            });
        }

        try {
            const resp = await fetch(`${BACKEND}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password }),
            });

            const data = await resp.json().catch(() => null);

            if (!resp.ok) {
                return res.render("auth_reset_password", {
                    title: "Đặt lại mật khẩu",
                    token,
                    error: (data && data.message) || "Không thể đặt lại mật khẩu.",
                    formError: null,
                    done: false,
                    message: "",
                    ...dataMini,
                });
            }

            return res.render("auth_reset_password", {
                title: "Đặt lại mật khẩu",
                token: null,
                error: null,
                formError: null,
                done: true,
                message: data && data.message ? data.message : "Mật khẩu đã được đặt lại thành công.",
                ...dataMini,
            });
        } catch (err) {
            console.error("Reset-password FE error:", err);
            return res.render("auth_reset_password", {
                title: "Đặt lại mật khẩu",
                token,
                error: "Có lỗi xảy ra. Vui lòng thử lại sau.",
                formError: null,
                done: false,
                message: "",
                ...dataMini,
            });
        }
    });
    router.get("/my-account", (_req, res) => res.redirect("/account/profile"));
    router.get("/account/profile", async (req, res) => {
        console.log("FE /account/profile COOKIE từ browser:", req.headers.cookie);
        const data = await fetchJSONAuth(req, `${BACKEND}/api/user/account/profile`).catch(() => null);

        if (!data || !data.success || !data.user) {
            return res.redirect("/login");
        }

        res.render("account_profile", {
            title: "Tài khoản",
            activeAccountTab: "profile",
            user: data.user,   // <<< QUAN TRỌNG!!!
            error: null,
            success: null
        });
    });
    router.post("/account/profile/update", async (req, res) => {
        const profile = await fetchJSONAuth(req, `${BACKEND}/api/user/account/profile`).catch(() => null);
        const currentUser = profile?.user || null;

        if (!profile || !profile.success) {
            return res.redirect("/login");
        }

        try {
            const payload = {
                full_name: req.body.full_name,
                phone: req.body.phone,
                gender: req.body.gender,
                birthday: req.body.birthday || null
            };

            const token = getAccessTokenFromCookie(req);

            const headers = {
                "Content-Type": "application/json",
                cookie: req.headers.cookie || "",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const resp = await fetch(`${BACKEND}/api/user/account/profile`, {
                method: "PUT",
                headers,
                body: JSON.stringify(payload)
            });

            const data = await resp.json().catch(() => null);

            const newUser = data?.user || currentUser;

            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                user: newUser,
                error: resp.ok ? null : (data?.message || "Cập nhật thất bại."),
                success: resp.ok ? (data?.message || "Cập nhật thành công.") : null
            });

        } catch (e) {
            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                user: currentUser,
                error: "Có lỗi xảy ra.",
                success: null
            });
        }
    });
    router.post("/account/profile/change-password", async (req, res) => {
        const { current_password, new_password, confirm_password } = req.body;

        // lấy lại dữ liệu profile để render
        const profile = await fetchJSONAuth(req, `${BACKEND}/api/page/account/profile`).catch(() => null);
        if (!profile || profile.redirectToLogin) return res.redirect("/login");

        // validate đơn giản ở FE server
        if (!current_password || !new_password || !confirm_password) {
            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                error: "Vui lòng nhập đầy đủ thông tin mật khẩu.",
                success: null,
                ...profile,
            });
        }

        if (new_password !== confirm_password) {
            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                error: "Mật khẩu mới và xác nhận mật khẩu không khớp.",
                success: null,
                ...profile,
            });
        }

        try {
            const resp = await fetch(`${BACKEND}/api/auth/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    cookie: req.headers.cookie || "",
                },
                body: JSON.stringify({
                    oldPassword: current_password,
                    newPassword: new_password,
                }),
            });

            const data = await resp.json().catch(() => null);

            if (!resp.ok) {
                return res.render("account_profile", {
                    title: "Tài khoản",
                    activeAccountTab: "profile",
                    error: (data && data.message) || "Đổi mật khẩu thất bại.",
                    success: null,
                    ...profile,
                });
            }

            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                error: null,
                success: data && data.message ? data.message : "Đổi mật khẩu thành công.",
                ...profile,
            });
        } catch (e) {
            console.error("Change-password FE error:", e);
            return res.render("account_profile", {
                title: "Tài khoản",
                activeAccountTab: "profile",
                error: "Có lỗi xảy ra, vui lòng thử lại.",
                success: null,
                ...profile,
            });
        }
    });

    router.get("/account/addresses", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/user/account/addresses`).catch(() => null);

        if (!data || !data.success) return res.redirect("/login");

        res.render("account_addresses", {
            title: "Địa chỉ",
            activeAccountTab: "addresses",
            addresses: data.addresses || [],
            error: null,
            success: null
        });
    });
    router.post("/account/addresses/add", async (req, res) => {
        const { address_line, is_default } = req.body;
        console.log("Client cookie:", req.headers.cookie);

        try {
            const token = getAccessTokenFromCookie(req);

            const headers = {
                "Content-Type": "application/json",
                "Cookie": req.headers.cookie || "",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const resp = await fetch(`${BACKEND}/api/user/account/addresses`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    address_line,
                    is_default: is_default === "on",
                }),
            });

            const data = await resp.json().catch(() => null);

            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: resp.ok ? null : (data?.message || "Không thể thêm địa chỉ"),
                success: resp.ok ? "Thêm địa chỉ thành công" : null,
            });
        } catch (err) {
            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: "Có lỗi xảy ra",
                success: null,
            });
        }
    });

    router.post("/account/addresses/update/:id", async (req, res) => {
        const addressId = req.params.id;
        const { address_line, is_default } = req.body;

        try {
            const token = getAccessTokenFromCookie(req);

            const headers = {
                "Content-Type": "application/json",
                "Cookie": req.headers.cookie || "",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const resp = await fetch(`${BACKEND}/api/user/account/addresses/${addressId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    address_line,
                    is_default: is_default === "on",
                }),
            });

            const data = await resp.json().catch(() => null);
            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: resp.ok ? null : (data?.message || "Cập nhật thất bại"),
                success: resp.ok ? "Cập nhật địa chỉ thành công" : null,
            });
        } catch (err) {
            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: "Lỗi server",
                success: null,
            });
        }
    });

    router.post("/account/addresses/delete/:id", async (req, res) => {
        const addressId = req.params.id;

        try {
            const token = getAccessTokenFromCookie(req);

            const headers = {
                "Content-Type": "application/json",
                "Cookie": req.headers.cookie || "",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const resp = await fetch(`${BACKEND}/api/user/account/addresses/${addressId}`, {
                method: "DELETE",
                headers,
            });

            const data = await resp.json().catch(() => null);
            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: resp.ok ? null : (data?.message || "Xóa địa chỉ thất bại"),
                success: resp.ok ? "Xóa địa chỉ thành công" : null,
            });
        } catch (err) {
            const list = await fetchJSONAuth(
                req,
                `${BACKEND}/api/user/account/addresses`
            ).catch(() => null);

            return res.render("account_addresses", {
                title: "Địa chỉ",
                activeAccountTab: "addresses",
                addresses: list?.addresses || [],
                error: "Có lỗi server",
                success: null,
            });
        }
    });

    router.get("/account-orders", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/orders`).catch(() => null);
        if (!data || data.redirectToLogin) return res.redirect("/login");
        res.render("account_orders", { title: "Đơn hàng", activeAccountTab: "orders", status: req.query.status || "all", ...data });
    });
    router.get("/orders/:id/details", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/orders/${req.params.id}/details`).catch(() => null);
        if (!data || data.redirectToLogin) return res.redirect("/login");
        res.render("order_detail", { title: "Chi tiết đơn", activeAccountTab: "orders", ...data });
    });
    router.get("/account/orders", async (req, res) => {
        const params = new URLSearchParams(req.query).toString();
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/orders/filter?${params}`).catch(() => null);
        if (!data || data.redirectToLogin) return res.redirect("/login");
        res.render("account_orders", { title: "Đơn hàng", activeAccountTab: "orders", status: req.query.status || "all", ...data });
    });
    router.get("/account/vouchers", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/vouchers`).catch(() => null);
        if (!data || data.redirectToLogin) return res.redirect("/login");
        res.render("account_vouchers", { title: "Mã giảm giá", activeAccountTab: "vouchers", ...data });
    });
    router.get("/account/points", async (req, res) => {
        const data = await fetchJSONAuth(req, `${BACKEND}/api/page/account/points`).catch(() => null);
        if (!data || data.redirectToLogin) return res.redirect("/login");
        res.render("account_points", { title: "Điểm thưởng", activeAccountTab: "points", ...data });
    });
    router.post("/login", async (req, res) => {
        try {
            const resp = await fetch(`${BACKEND}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    cookie: req.headers.cookie || "",
                },
                body: JSON.stringify({
                    email: req.body.username || req.body.email,
                    password: req.body.password,
                }),
                redirect: "manual",
            });

            let data = null;
            try { data = await resp.json(); } catch { }

            if (resp.ok && data) {
                // 👇 LƯU TOKEN VÀO COOKIE
                if (data.tokens?.accessToken) {
                    res.cookie("accessToken", data.tokens.accessToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                    });
                }
                if (data.tokens?.refreshToken) {
                    res.cookie("refreshToken", data.tokens.refreshToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                    });
                }

                return res.redirect("/my-account");
            }

            const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
            return res.status(resp.status || 401).render("login_register", {
                title: "Đăng nhập & Đăng ký",
                error: (data && data.message) || "Email hoặc mật khẩu không đúng!",
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

    router.post("/api/auth/login", async (req, res) => {
        try {
            const resp = await fetch(`${BACKEND}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    cookie: req.headers.cookie || "",
                },
                body: JSON.stringify({
                    email: req.body.email || req.body.username,
                    password: req.body.password,
                }),
                redirect: "manual",
            });

            let data = null;
            try { data = await resp.json(); } catch { }

            if (resp.ok && data) {
                // 👇 LƯU TOKEN VÀO COOKIE
                if (data.tokens?.accessToken) {
                    res.cookie("accessToken", data.tokens.accessToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                    });
                }
                if (data.tokens?.refreshToken) {
                    res.cookie("refreshToken", data.tokens.refreshToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                    });
                }

                return res.status(200).json({ ok: true, redirect: "/my-account", ...data });
            }

            return res.status(resp.status || 401).json({
                ok: false,
                error: (data && data.message) || "Email hoặc mật khẩu không đúng!",
            });
        } catch {
            return res.status(500).json({ ok: false, error: "Login failed" });
        }
    });


    router.post("/register", async (req, res) => {
        try {
            const resp = await fetch(`${BACKEND}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    cookie: req.headers.cookie || "",
                },
                body: JSON.stringify({
                    email: req.body.register_email,   // map vào email
                    full_name: req.body.register_name,    // map vào full_name
                    address_line: req.body.register_address, // map vào address_line
                }),
                redirect: "manual",
            });

            const data = await resp.json().catch(() => null);

            // Backend register trả 201 khi thành công
            if (resp.status === 201 && data) {
                const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
                return res.status(200).render("login_register", {
                    title: "Đăng nhập & Đăng ký",
                    error: null,
                    success: data.message || "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
                    activeTab: "login", // sau khi đăng ký xong cho user về tab login
                    ...mini,
                });
            }

            const mini = await fetchJSONAuth(req, `${BACKEND}/api/page/minicart`).catch(() => ({}));
            return res.status(400).render("login_register", {
                title: "Đăng nhập & Đăng ký",
                error: (data && data.message) || "Đăng ký thất bại",
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
    router.get("/logout", async (req, res) => {
        try {
            const resp = await fetch(`${BACKEND}/api/auth/logout`, {
                method: "POST",    // nên dùng POST logout
                headers: {
                    cookie: req.headers.cookie || ""
                }
            });
            console.log(resp);
            const setCookie = getSetCookie(resp);
            if (setCookie?.length) {
                res.setHeader("set-cookie", setCookie);
            }
        } catch (e) {
            console.error("Logout FE error", e);
        }

        // FE tự redirect
        return res.redirect("/login");
    });
    // ====== VERIFY ACCOUNT + SET PASSWORD PAGE ======
    router.get("/verify-account", async (req, res) => {
        const loginUrl = "/login";
        const registerUrl = "/register";

        const params = new URLSearchParams(req.query).toString();

        let success = false;
        let message = "Link xác thực không hợp lệ hoặc đã hết hạn.";
        let full_name = "";
        let userId = null;

        try {
            // gọi BE verify
            const data = await fetchJSONPublic(`${BACKEND}/api/auth/verify?${params}`);

            success = true;
            message = data.message || "Email đã được xác thực. Vui lòng tạo mật khẩu.";
            full_name = data.full_name || "";
            userId = data.userId;   // BE verifyEmail đang trả userId như bạn chụp
        } catch (err) {
            console.error("Verify-account FE error:", err.message || err);
            success = false;
        }

        return res.render("auth_set_password", {
            title: "Xác thực tài khoản",
            success,
            message,
            full_name,
            userId,
            loginUrl,
            registerUrl,
            formError: null,
            done: false,
        });
    });
    router.post("/set-password", async (req, res) => {
        const { userId, password, confirm_password } = req.body;
        console.log("SET-PASSWORD BODY:", req.body);
        const loginUrl = "/login";
        const registerUrl = "/register";

        // validate đơn giản
        if (!userId || !password || !confirm_password) {
            return res.render("auth_set_password", {
                title: "Xác thực tài khoản",
                success: true,
                message: "Vui lòng nhập đầy đủ thông tin.",
                full_name: "",
                userId,
                loginUrl,
                registerUrl,
                formError: "Vui lòng nhập đầy đủ mật khẩu.",
                done: false,
            });
        }

        if (password !== confirm_password) {
            return res.render("auth_set_password", {
                title: "Xác thực tài khoản",
                success: true,
                message: "Mật khẩu không khớp.",
                full_name: "",
                userId,
                loginUrl,
                registerUrl,
                formError: "Mật khẩu và xác nhận mật khẩu phải giống nhau.",
                done: false,
            });
        }

        try {
            const resp = await fetch(`${BACKEND}/api/auth/set-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, password }),
            });

            const data = await resp.json().catch(() => null);

            if (!resp.ok) {
                return res.render("auth_set_password", {
                    title: "Xác thực tài khoản",
                    success: true,
                    message: (data && data.message) || "Không thể đặt mật khẩu.",
                    full_name: "",
                    userId,
                    loginUrl,
                    registerUrl,
                    formError: (data && data.message) || "Đặt mật khẩu thất bại.",
                    done: false,
                });
            }

            // Đặt mật khẩu OK -> show trạng thái hoàn tất + nút Đăng nhập
            return res.render("auth_set_password", {
                title: "Hoàn tất đăng ký",
                success: true,
                message: (data && data.message) || "Mật khẩu đã được thiết lập thành công.",
                full_name: data && data.full_name ? data.full_name : "",
                userId: null,
                loginUrl,
                registerUrl,
                formError: null,
                done: true,
            });
        } catch (err) {
            console.error("Set-password FE error:", err);
            return res.render("auth_set_password", {
                title: "Xác thực tài khoản",
                success: true,
                message: "Có lỗi xảy ra khi đặt mật khẩu.",
                full_name: "",
                userId,
                loginUrl,
                registerUrl,
                formError: "Vui lòng thử lại sau.",
                done: false,
            });
        }
    });
    // CART actions
    router.post("/add-to-cart", async (req, res) => {
        const isAjax =
            req.xhr ||
            req.headers["x-requested-with"] === "XMLHttpRequest" ||
            (req.headers.accept || "").includes("application/json");

        try {
            const form = new URLSearchParams();
            for (const [k, v] of Object.entries(req.body || {})) {
                form.append(k, v);
            }

            const resp = await fetch(`${BACKEND}/add-to-cart`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    cookie: req.headers.cookie || "",
                },
                body: form,
                redirect: "manual",
            });

            const setCookie = getSetCookie(resp);
            if (setCookie?.length) res.set("set-cookie", setCookie);

            // ✅ KHÔNG phải ajax -> redirect như cũ
            if (!isAjax) {
                const back = req.get("referer") || "/";
                return res.redirect(withQuery(back, { added: 1, add_error: null }));
            }

            // ✅ AJAX: forward luôn JSON backend trả về
            let data = null;
            try { data = await resp.json(); } catch { data = null; }

            if (data) {
                return res.status(resp.status).json(data);
            }

            return res.status(500).json({ ok: false, message: "Invalid backend response" });
        } catch (err) {
            console.error("Add-to-cart error:", err);

            if (isAjax) {
                return res.status(500).json({
                    ok: false,
                    message: "Không thể thêm vào giỏ hàng, vui lòng thử lại.",
                });
            }

            const back = req.get("referer") || "/";
            return res.redirect(withQuery(back, { add_error: 1 }));
        }
    });

    router.post("/cart/update/:idx", async (req, res) => {
        const idx = req.params.idx;
        try {
            const form = new URLSearchParams({ quantity: String(req.body.quantity || 1) });
            await fetch(`${BACKEND}/cart/update/${idx}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: req.headers.cookie || "" }, body: form });
            const mini = await fetch(`${BACKEND}/api/page/minicart`, { headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" } });
            const miniJson = await mini.json();
            const items = Array.isArray(miniJson.carts) ? miniJson.carts : [];
            const it = items[idx]; const lineTotal = it ? Number(it.price_at_time || 0) * Number(it.quantity || 0) : 0;
            return res.json({ ok: true, lineTotal, totals: { total: Number(miniJson.total || 0) } });
        } catch { return res.status(500).json({ ok: false, message: "Update failed" }); }
    });
    router.post("/cart/remove/:idx", async (req, res) => {
        const idx = req.params.idx;
        try {
            await fetch(`${BACKEND}/cart/remove/${idx}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" } });
            const mini = await fetch(`${BACKEND}/api/page/minicart`, { headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" } });
            const miniJson = await mini.json();
            return res.json({ ok: true, totals: { total: Number(miniJson.total || 0) } });
        } catch { return res.status(500).json({ ok: false, message: "Remove failed" }); }
    });

    // submit checkout -> proxy thẳng Backend
    router.post("/shop-cart/submit", proxy(BACKEND, { proxyReqPathResolver: () => "/shop-cart/submit" }));
    // Tất cả /api/* khác → proxy tới Backend
    router.use("/api", proxy(BACKEND, { proxyReqPathResolver: (req) => `/api${req.url}` }));

    return router;
};
