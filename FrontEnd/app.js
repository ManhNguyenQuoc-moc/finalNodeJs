// app.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");

const app = express();

// ============ Reviews & Ratings (in-memory) ============
const reviewsDB = {}; // productId -> [{id,user,message,createdAt}]
const ratingsDB = {}; // productId -> { byUser: { [email]: stars } }
function getRatingStats(productId) {
  const byUser = ratingsDB[productId]?.byUser || {};
  const scores = Object.values(byUser);
  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
  return { avg: +avg.toFixed(2), count: scores.length };
}

// View engine & static
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Parsers
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session (MemoryStore đủ cho demo/Docker)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use((req, res, next) => {
  // Lấy dữ liệu hiện có từ helper của bạn
  // (getRenderData đã tính carts, total, categories, v.v.)
  const data = (() => {
    try {
      return typeof getRenderData === "function" ? getRenderData(req) : {};
    } catch {
      return {};
    }
  })();

  // Trải các biến vào res.locals, đặt mặc định an toàn
  res.locals.carts = Array.isArray(data.carts) ? data.carts : [];
  res.locals.cartCount =
    typeof data.cartCount === "number"
      ? data.cartCount
      : res.locals.carts.length;

  res.locals.total = typeof data.total === "number" ? data.total : 0;

  // Các biến hay dùng khác
  res.locals.categories = Array.isArray(data.categories) ? data.categories : [];
  res.locals.wishlistCount =
    typeof data.wishlistCount === "number" ? data.wishlistCount : 0;
  res.locals.loggedInUser = !!data.loggedInUser;

  next();
});

// Multer storage (đảm bảo thư mục tồn tại trong container)
const uploadDir = path.join(__dirname, "public/mixishop/images/categories");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Auth guard
const requireLogin = (req, _res, next) => {
  if (!req.session.user) return next(); // cho demo FE, không chặn
  next();
};

// ===== Mock DB / services (giữ nguyên logic cũ) =====
const users = [
  {
    email: "test@example.com",
    password: "password",
    name: "Test User",
    phone: "123456789",
    address: "123 Main St",
  },
];

const cartsDB = [];
const ordersDB = [
  {
    id: 2416,
    userId: "test@example.com",
    orderDate: "October 1, 2023",
    paymentMethod: "Credit Card",
    status: "On hold",
    totalAmount: "$250 for 3 items",
    items: [
      {
        productName: "Áo Thun Đen",
        color: "Red",
        size: "M",
        quantity: 2,
        price: "$100",
        subtotal: "$200",
      },
      {
        productName: "Quần Jeans",
        color: "Blue",
        size: "L",
        quantity: 1,
        price: "$50",
        subtotal: "$50",
      },
    ],
  },
];

let categoriesDB = [
  {
    id: 1,
    name: "Category 1",
    imageUrl: "/mixishop/images/cat1.jpg",
    status: 1,
  },
  {
    id: 2,
    name: "Category 2",
    imageUrl: "/mixishop/images/cat2.jpg",
    status: 1,
  },
];

const orderService = {
  getOrdersByUserId: (userId) => ordersDB.filter((o) => o.userId === userId),
  getOrderById: (orderId, userId) =>
    ordersDB.find((o) => o.id === parseInt(orderId) && o.userId === userId),
  createOrderFromCart: (userId) => {
    const carts = cartService.getCartItems(userId);
    if (carts.length === 0) return null;
    const totalAmount = carts.reduce(
      (s, c) => s + c.productColor.product.price * c.quantity,
      0
    );
    const order = {
      id: ordersDB.length + 1,
      userId,
      orderDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      paymentMethod: "Credit Card",
      status: "On hold",
      totalAmount: `$${totalAmount} for ${carts.length} items`,
      items: carts.map((cart) => ({
        productName: cart.productColor.product.name,
        color: cart.productColor.color,
        size: cart.productSize.size,
        quantity: cart.quantity,
        price: cart.productColor.product.getFormattedPrice(
          cart.productColor.product.price
        ),
        subtotal: cart.productColor.product.getFormattedPrice(
          cart.productColor.product.price * cart.quantity
        ),
      })),
    };
    ordersDB.push(order);
    // clear cart user
    for (let i = cartsDB.length - 1; i >= 0; i--) {
      if (cartsDB[i].userId === userId) cartsDB.splice(i, 1);
    }
    return order;
  },
};

const productsData = [
  {
    id: 1,
    name: "Áo Thun Đen",
    brand: { name: "Mixi" },
    price: 100,
    description:
      "Áo thun cotton thoáng mát.\nPhom regular.\nBo cổ bền.\nIn bền màu.\nPhối đồ đa dụng.",
    productStatus: { statusName: "Bán chạy" },
    sizes: [{ size: "S" }, { size: "M" }, { size: "L" }],
    colors: [
      {
        color: "Red",
        imageUrls: [
          "/mixishop/images/products/ao2023.png",
          "/mixishop/images/products/ao2024.png",
          "/mixishop/images/products/ao20241.png",
        ],
      },
      {
        color: "Black",
        imageUrls: [
          "/mixishop/images/products/ao3loMixi.png",
          "/mixishop/images/products/ao20242.png",
          "/mixishop/images/products/ao20243.png",
        ],
      },
    ],
    category: { id: 1, name: "Category 1" },
    stock: { Red: { S: 10, M: 5, L: 0 }, Black: { S: 8, M: 3, L: 2 } },
    getFormattedPrice: (price) => `$${price}`,
  },
  {
    id: 2,
    name: "Quần Jeans",
    brand: { name: "DenimCo" },
    price: 200,
    description:
      "Jeans nam co giãn nhẹ.\nForm vừa vặn.\nBạc màu nhẹ.\nKhóa kéo kim loại.\nỐng đứng dễ mặc.",
    productStatus: { statusName: "Trending" },
    sizes: [{ size: "M" }, { size: "L" }, { size: "XL" }],
    colors: [
      {
        color: "Red",
        imageUrls: [
          "/mixishop/images/products/ao2023.png",
          "/mixishop/images/products/ao2024.png",
          "/mixishop/images/products/ao20241.png",
        ],
      },
      {
        color: "Black",
        imageUrls: [
          "/mixishop/images/products/ao3loMixi.png",
          "/mixishop/images/products/ao20242.png",
          "/mixishop/images/products/ao20243.png",
        ],
      },
    ],
    category: { id: 2, name: "Category 2" },
    stock: { Blue: { M: 15, L: 7, XL: 4 }, Black: { M: 6, L: 2, XL: 0 } },
    getFormattedPrice: (price) => `$${price}`,
  },
  {
    id: 3,
    name: "Áo Khoác",
    brand: { name: "OuterWear" },
    price: 300,
    description:
      "Áo khoác ấm, cản gió.\nVải dệt dày.\nKhóa kéo trơn mượt.\nNhiều túi tiện lợi.\nĐi làm/đi chơi đều hợp.",
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      {
        color: "Red",
        imageUrls: [
          "/mixishop/images/products/ao2023.png",
          "/mixishop/images/products/ao2024.png",
          "/mixishop/images/products/ao20241.png",
        ],
      },
      {
        color: "Black",
        imageUrls: [
          "/mixishop/images/products/ao3loMixi.png",
          "/mixishop/images/products/ao20242.png",
          "/mixishop/images/products/ao20243.png",
        ],
      },
    ],
    category: { id: 1, name: "Category 1" },
    stock: { Green: { S: 12, M: 8 }, Black: { S: 4, M: 3 } },
    getFormattedPrice: (price) => `$${price}`,
  },
];

const productService = {
  _data: productsData,
  _paged(list, pageNo, pageSize = 12) {
    const totalPages = Math.max(Math.ceil(list.length / pageSize), 1);
    const content = list.slice((pageNo - 1) * pageSize, pageNo * pageSize);
    return {
      content,
      number: pageNo - 1,
      totalPages,
      hasPrevious: pageNo > 1,
      hasNext: pageNo < totalPages,
    };
  },
  getAllProducts(pageNo, sort, priceMin, priceMax, pageSize = 12) {
    let products = this._data.filter(
      (p) => p.price >= priceMin && p.price <= priceMax
    );
    if (sort === "a_z") products.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "z_a")
      products.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "price_low_to_high")
      products.sort((a, b) => a.price - b.price);
    else if (sort === "price_high_to_low")
      products.sort((a, b) => b.price - a.price);
    return this._paged(products, pageNo, pageSize);
  },
  getProductsByCategoryId(
    categoryId,
    pageNo,
    sort,
    priceMin,
    priceMax,
    pageSize = 12
  ) {
    let products = this._data.filter(
      (p) =>
        p.category.id === categoryId &&
        p.price >= priceMin &&
        p.price <= priceMax
    );
    if (sort === "a_z") products.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "z_a")
      products.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "price_low_to_high")
      products.sort((a, b) => a.price - b.price);
    else if (sort === "price_high_to_low")
      products.sort((a, b) => b.price - a.price);
    return this._paged(products, pageNo, pageSize);
  },
  getProductsByColor(color, pageNo, priceMin, priceMax) {
    let products = this._data.filter(
      (p) =>
        p.price >= priceMin &&
        p.price <= priceMax &&
        p.colors.some((c) => c.color === color)
    );
    return this._paged(products, pageNo);
  },
  getProductsByColorAndCategoryId(
    color,
    categoryId,
    priceMin,
    priceMax,
    pageNo
  ) {
    let products = this._data.filter(
      (p) =>
        p.category.id === categoryId &&
        p.price >= priceMin &&
        p.price <= priceMax &&
        p.colors.some((c) => c.color === color)
    );
    return this._paged(products, pageNo);
  },
  getProductById(id) {
    return this._data.find((p) => p.id === parseInt(id));
  },
  checkStock(productId, color, size) {
    const p = this.getProductById(productId);
    if (!p || !p.stock[color] || !p.stock[color][size]) return 0;
    return p.stock[color][size];
  },
  searchProducts(keyword, pageNo, sort, priceMin, priceMax, pageSize = 12) {
    let products = this._data.filter(
      (p) => p.price >= priceMin && p.price <= priceMax
    );
    if (keyword && keyword.trim()) {
      const q = keyword.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.brand?.name || "").toLowerCase().includes(q)
      );
    }
    if (sort === "a_z") products.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "z_a")
      products.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "price_low_to_high")
      products.sort((a, b) => a.price - b.price);
    else if (sort === "price_high_to_low")
      products.sort((a, b) => b.price - a.price);
    const paged = this._paged(products, pageNo, pageSize);
    return { ...paged, totalElements: products.length };
  },
};

const categoryService = {
  getAllCategories: () => categoriesDB,
  getAllActiveCategories: () => categoriesDB.filter((c) => c.status === 1),
  getCategoryById: (id) => categoriesDB.find((c) => c.id === parseInt(id)),
  addCategory: (name, imagePath, status) => {
    const newId = categoriesDB.length
      ? Math.max(...categoriesDB.map((c) => c.id)) + 1
      : 1;
    const newCategory = {
      id: newId,
      name,
      imageUrl: imagePath,
      status: parseInt(status),
    };
    categoriesDB.push(newCategory);
    return newCategory;
  },
  updateCategory: (id, name, imagePath, status) => {
    const category = categoriesDB.find((c) => c.id === parseInt(id));
    if (!category) return false;
    category.name = name;
    if (imagePath) category.imageUrl = imagePath;
    category.status = parseInt(status);
    return true;
  },
};

const wishlistService = { getWishlistCount: () => 3 };

const getRenderData = (req) => {
  const userId = req.session.user ? req.session.user.email : null;
  const user = req.session.user || null;
  const carts = cartService.getCartItems(userId);
  const orders = orderService.getOrdersByUserId(userId);
  const categories = categoryService.getAllActiveCategories();
  const wishlistCount = wishlistService.getWishlistCount();
  const total = carts.reduce(
    (s, c) => s + c.productColor.product.price * c.quantity,
    0
  );
  return {
    user,
    carts,
    orders,
    categories,
    wishlistCount,
    total,
    formattedTotal: `$${total}`,
    loggedInUser: !!req.session.user,
    isEmpty: carts.length === 0,
  };
};

const cartService = {
  getCartItems: (userId) => {
    return userId
      ? cartsDB.filter((c) => c.userId === userId)
      : [
          {
            id: 1,
            productSize: {
              product: {
                id: 1,
                name: "Áo Thun Đen",
                price: 100,
                getFormattedPrice: (p) => `$${p}`,
              },
              size: "M",
            },
            productColor: {
              color: "Red",
              imageUrls: ["/mixishop/images/product1-1.jpg"],
              product: {
                id: 1,
                name: "Áo Thun Đen",
                price: 100,
                getFormattedPrice: (p) => `$${p}`,
              },
            },
            quantity: 2,
          },
          {
            id: 2,
            productSize: {
              product: {
                id: 2,
                name: "Quần Jeans",
                price: 50,
                getFormattedPrice: (p) => `$${p}`,
              },
              size: "L",
            },
            productColor: {
              color: "Blue",
              imageUrls: ["/mixishop/images/product2-1.jpg"],
              product: {
                id: 2,
                name: "Quần Jeans",
                price: 50,
                getFormattedPrice: (p) => `$${p}`,
              },
            },
            quantity: 1,
          },
        ];
  },
  addToCart: (userId, productId, size, color, quantity) => {
    const product = productService.getProductById(productId);
    if (!product) return false;
    const cartItem = {
      id: cartsDB.length + 1,
      userId,
      productSize: {
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          getFormattedPrice: product.getFormattedPrice,
        },
        size,
      },
      productColor: {
        color,
        imageUrls:
          product.colors.find((c) => c.color === color)?.imageUrls || [],
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          getFormattedPrice: product.getFormattedPrice,
        },
      },
      quantity: parseInt(quantity),
    };
    cartsDB.push(cartItem);
    return true;
  },
  removeCartItem: (cartId) => {
    const idx = cartsDB.findIndex((c) => c.id === parseInt(cartId));
    if (idx === -1) return false;
    cartsDB.splice(idx, 1);
    return true;
  },
  updateCartItem: (cartId, quantity) => {
    const item = cartsDB.find((c) => c.id === parseInt(cartId));
    if (!item) return false;
    item.quantity = parseInt(quantity);
    return true;
  },
};

// ===== Routes (giữ như bản bạn gửi, chỉ đổi io.emit -> global.io?.emit) =====
app.get("/admin", requireLogin, (req, res) => {
  res.render("admin/dashboard_admin", { title: "Trang chủ Admin" });
});

app.get("/admin/categogy", requireLogin, (req, res) => {
  const categories = categoryService.getAllCategories();
  res.render("admin/category", {
    title: "Danh sách nhóm sản phẩm",
    categories,
  });
});

app.get("/admin/categogy/addCategogy", requireLogin, (_req, res) => {
  res.render("admin/category_add", { title: "Thêm nhóm sản phẩm" });
});

app.post(
  "/admin/addCategory",
  requireLogin,
  upload.single("image"),
  (req, res) => {
    const { name, status } = req.body;
    let imagePath = "/mixishop/images/categories/default.jpg";
    if (req.file)
      imagePath = "/mixishop/images/categories/" + req.file.filename;
    categoryService.addCategory(name, imagePath, status);
    res.redirect("/admin/categogy");
  }
);

app.get("/admin/categogy/update/:id", requireLogin, (req, res) => {
  const category = categoryService.getCategoryById(req.params.id);
  if (!category) return res.status(404).send("Không tìm thấy nhóm sản phẩm");
  res.render("admin/category_edit", {
    title: "Chỉnh sửa nhóm sản phẩm",
    category,
  });
});

app.post(
  "/admin/updateCategory",
  requireLogin,
  upload.single("image"),
  (req, res) => {
    const { id, name, status } = req.body;
    const imagePath = req.file
      ? "/mixishop/images/categories/" + req.file.filename
      : null;
    const ok = categoryService.updateCategory(id, name, imagePath, status);
    if (!ok)
      return res.status(404).send("Không tìm thấy nhóm sản phẩm để cập nhật");
    res.redirect("/admin/categogy");
  }
);

app.get("/admin/products", requireLogin, (_req, res) => {
  const products = [
    {
      id: 1,
      name: "Áo thun",
      description: "Áo cotton 100%",
      formattedPrice: "150,000đ",
      statusName: "Còn hàng",
    },
    {
      id: 2,
      name: "Quần jean",
      description: "Quần jean nam",
      formattedPrice: "350,000đ",
      statusName: "Hết hàng",
    },
  ];
  const productsData = {
    hasPrevious: false,
    hasNext: true,
    number: 0,
    totalPages: 5,
  };
  res.render("admin/products", {
    title: "Danh sách sản phẩm",
    products,
    productsData,
  });
});

app.get("/admin/products/addProduct", requireLogin, (_req, res) => {
  const productStatuses = [
    { id: 1, statusName: "Còn hàng" },
    { id: 2, statusName: "Hết hàng" },
  ];
  const categories = [
    { id: 1, name: "Áo thun" },
    { id: 2, name: "Quần jean" },
  ];
  res.render("admin/product_add", {
    title: "Thêm sản phẩm",
    productStatuses,
    categories,
  });
});

app.post("/admin/addProducts", requireLogin, (req, res) => {
  console.log("Dữ liệu sản phẩm mới:", req.body);
  res.redirect("/admin/products");
});

const ordersService = {
  getOrders: (pageNo = 1, pageSize = 5) => {
    const allOrders = [
      {
        id: 1,
        customerName: "Nguyễn Văn A",
        customerPhone: "0901234567",
        orderDate: "2025-09-01",
        paymentMethod: "COD",
        totalAmount: 150000,
        notes: "Giao nhanh",
      },
      {
        id: 2,
        customerName: "Trần Thị B",
        customerPhone: "0912345678",
        orderDate: "2025-09-02",
        paymentMethod: "Momo",
        totalAmount: 250000,
        notes: "",
      },
      {
        id: 3,
        customerName: "Phạm Văn C",
        customerPhone: "0923456789",
        orderDate: "2025-09-03",
        paymentMethod: "Banking",
        totalAmount: 300000,
        notes: "Giao buổi tối",
      },
    ];
    const totalPages = Math.ceil(allOrders.length / pageSize);
    const start = (pageNo - 1) * pageSize;
    const end = start + pageSize;
    return {
      content: allOrders.slice(start, end),
      number: pageNo - 1,
      totalPages,
      hasPrevious: pageNo > 1,
      hasNext: pageNo < totalPages,
    };
  },
};

app.get("/admin/order-list", requireLogin, (req, res) => {
  const pageNo = parseInt(req.query.pageNo) || 1;
  const orders = ordersService.getOrders(pageNo, 5);
  res.render("admin/order_list", { title: "Danh sách đơn hàng", orders });
});

app.get("/admin/products/color/:productId", requireLogin, (req, res) => {
  const product = productService.getProductById(parseInt(req.params.productId));
  if (!product) return res.status(404).send("Không tìm thấy sản phẩm");
  const productColors = product.colors.map((c, i) => ({
    id: i + 1,
    color: c.color,
    product,
    imageUrls: c.imageUrls,
  }));
  res.render("admin/product_color", {
    title: "Màu sắc sản phẩm",
    product,
    productColors,
  });
});

app.get("/admin/products/color/:productId/add", requireLogin, (req, res) => {
  const product = productService.getProductById(parseInt(req.params.productId));
  if (!product) return res.status(404).send("Không tìm thấy sản phẩm");
  res.render("admin/product_color_add", {
    title: "Thêm màu sản phẩm",
    product,
  });
});

app.post(
  "/admin/products/color/:productId/add",
  requireLogin,
  upload.array("images", 5),
  (req, res) => {
    const productId = parseInt(req.params.productId);
    const { color } = req.body;
    const product = productService.getProductById(productId);
    if (!product) return res.status(404).send("Không tìm thấy sản phẩm");
    const imageUrls = (req.files || []).map(
      (f) => "/mixishop/images/categories/" + f.filename
    );
    product.colors.push({ color, imageUrls });
    res.redirect(`/admin/products/color/${productId}`);
  }
);

app.post(
  "/admin/products/color/:productId/delete/:color",
  requireLogin,
  (req, res) => {
    const product = productService.getProductById(
      parseInt(req.params.productId)
    );
    if (!product) return res.status(404).send("Không tìm thấy sản phẩm");
    product.colors = product.colors.filter((c) => c.color !== req.params.color);
    res.redirect(`/admin/products/color/${req.params.productId}`);
  }
);

app.get("/admin/order-pending", requireLogin, (_req, res) => {
  res.render("admin/order_pending", {
    title: "Danh sách đơn hàng chờ phê duyệt",
  });
});

app.get(["/", "/home"], (req, res) => {
  const productPage = productService.getAllProducts(1, null, 0, 100000000);
  res.render("home", {
    title: "Trang chủ",
    products: productPage.content,
    ...getRenderData(req),
  });
});

app.get("/cart", (req, res) => {
  res.render("cart", { title: "Giỏ hàng", ...getRenderData(req) });
});

app.get("/about", (req, res) =>
  res.render("about", { title: "Giới thiệu", ...getRenderData(req) })
);
app.get("/blog", (req, res) =>
  res.render("blog", { title: "Blog", ...getRenderData(req) })
);
app.get("/contact", (req, res) =>
  res.render("contact", { title: "Liên hệ", ...getRenderData(req) })
);

app.get("/product_detail/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const product = productService.getProductById(productId);
  if (!product) return res.status(404).send("Sản phẩm không tồn tại");

  const relatedProducts = productService.getProductsByCategoryId(
    product.category.id,
    1,
    null,
    0,
    100000000
  ).content;
  let allImages = product.colors.reduce(
    (acc, c) => acc.concat(c.imageUrls),
    []
  );
  while (allImages.length < 3 && allImages.length > 0)
    allImages.push(allImages[0]);

  const reviews = reviewsDB[productId] || [];
  const ratingStats = getRatingStats(productId) || { avg: 0, count: 0 };
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const s = Number(r.stars) || 0;
    if (s >= 1 && s <= 5) dist[s]++;
  }
  const ratingBreakdown = {
    avg: Number(ratingStats.avg) || 0,
    count: Number(ratingStats.count) || reviews.filter((r) => r.stars).length,
    dist,
  };

  const expStats = [];
  const userRated = req.session.user
    ? ratingsDB[productId]?.byUser?.[req.session.user.email] || 0
    : 0;
  const likerId = req.session.user ? req.session.user.email : req.sessionID;

  res.render("product_detail", {
    title: product.name,
    product,
    productSizes: product.sizes,
    allImages,
    products: relatedProducts,
    reviews,
    ratingStats,
    ratingBreakdown,
    expStats,
    userRated,
    likerId,
    message: null,
    error: null,
    ...getRenderData(req),
  });
});

// Comments (guest ok)
app.post("/api/products/:id/comments", (req, res) => {
  const productId = parseInt(req.params.id);
  const { name, message, parentId } = req.body || {};
  const p = productService.getProductById(productId);
  if (!p) return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
  if (!message || message.trim().length < 2)
    return res.status(400).json({ error: "Nội dung quá ngắn" });

  const cmt = {
    id: Date.now(),
    parentId: parentId ? parseInt(parentId) : null,
    user: (name && name.trim()) || req.session.user?.name || "Khách",
    message: message.trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: {},
  };

  if (!reviewsDB[productId]) reviewsDB[productId] = [];
  reviewsDB[productId].push(cmt);

  if (global.io) global.io.emit("new-comment", { productId, comment: cmt });
  return res.json({ ok: true, comment: cmt });
});

app.post("/api/products/:pid/comments/:cid/like", (req, res) => {
  const pid = parseInt(req.params.pid);
  const cid = parseInt(req.params.cid);
  const likerId = req.session.user ? req.session.user.email : req.sessionID;

  const list = reviewsDB[pid] || [];
  const c = list.find((it) => it.id === cid);
  if (!c) return res.status(404).json({ error: "Không tìm thấy bình luận" });

  if (!c.likedBy) c.likedBy = {};
  if (c.likedBy[likerId]) delete c.likedBy[likerId];
  else c.likedBy[likerId] = true;
  c.likes = Object.keys(c.likedBy).length;

  if (global.io)
    global.io.emit("comment-liked", {
      productId: pid,
      commentId: cid,
      likes: c.likes,
    });
  return res.json({ ok: true, likes: c.likes, liked: !!c.likedBy[likerId] });
});

// Ratings (require login in real app; demo cho phép)
app.post("/api/products/:id/ratings", (req, res) => {
  const productId = parseInt(req.params.id);
  const p = productService.getProductById(productId);
  if (!p) return res.status(404).json({ error: "Không tìm thấy sản phẩm" });

  const stars = parseInt(req.body?.stars, 10);
  if (!(stars >= 1 && stars <= 5))
    return res.status(400).json({ error: "Số sao không hợp lệ" });

  const email =
    (req.session.user && req.session.user.email) || `guest-${req.sessionID}`;
  if (!ratingsDB[productId]) ratingsDB[productId] = { byUser: {} };
  ratingsDB[productId].byUser[email] = stars;

  const stats = getRatingStats(productId);
  if (global.io) global.io.emit("rating-updated", { productId, stats });
  return res.json({ ok: true, stats });
});

app.get("/product_detail/:id/check-stock", (req, res) => {
  const productId = parseInt(req.params.id);
  const { color, size } = req.query;
  const stockQuantity = productService.checkStock(productId, color, size);
  res.json(stockQuantity);
});

// Cart APIs
app.post("/add-to-cart", (req, res) => {
  const { productId, size, color, quantity } = req.body;
  const userId = req.session.user ? req.session.user.email : null;
  const success = cartService.addToCart(
    userId,
    productId,
    size,
    color,
    quantity
  );
  const product = productService.getProductById(productId);
  if (!product) return res.status(404).send("Sản phẩm không tồn tại");
  const relatedProducts = productService.getProductsByCategoryId(
    product.category.id,
    1,
    null,
    0,
    100000000
  ).content;
  const allImages = product.colors.reduce(
    (acc, c) => acc.concat(c.imageUrls),
    []
  );
  res.render("product_detail", {
    title: product.name,
    product,
    productSizes: product.sizes,
    allImages,
    products: relatedProducts,
    message: success ? "Thêm vào giỏ hàng thành công!" : null,
    error: !success ? "Không thể thêm vào giỏ hàng!" : null,
    ...getRenderData(req),
  });
});

function itemPrice(cartItem) {
  return cartItem.productColor.product.price;
}
function computeTotalsForUser(userId) {
  const list = cartService.getCartItems(userId);
  const subtotal = list.reduce((s, it) => s + itemPrice(it) * it.quantity, 0);
  return { total: subtotal };
}

app.post("/remove-from-cart", (req, res) => {
  const ok = cartService.removeCartItem(req.body.cartItemId);
  res.send(
    ok ? "Xóa sản phẩm khỏi giỏ hàng thành công!" : "Không thể xóa sản phẩm!"
  );
});

app.post("/cart/update/:id", (req, res) => {
  const cartId = parseInt(req.params.id, 10);
  const qty = parseInt(req.body?.quantity, 10);
  if (!Number.isFinite(qty) || qty < 1)
    return res.json({ ok: false, message: "Số lượng không hợp lệ" });
  const ok = cartService.updateCartItem(cartId, qty);
  if (!ok) return res.json({ ok: false, message: "Không tìm thấy sản phẩm" });

  const userId = req.session.user ? req.session.user.email : null;
  const item = cartService.getCartItems(userId).find((i) => i.id === cartId);
  const lineTotal = item ? itemPrice(item) * item.quantity : 0;
  const totals = computeTotalsForUser(userId);
  return res.json({ ok: true, lineTotal, totals });
});

app.get("/check-login", (req, res) =>
  res.json({ isLoggedIn: !!req.session.user })
);

app.get("/category/alls", (req, res) => {
  const pageNo = parseInt(req.query.pageNo) || 1;
  const sort = req.query.sort || null;
  const color = req.query.color || null;
  const priceRange = req.query.price_range || null;
  const brand = req.query.brand || "";
  const rating = req.query.rating || "";
  const q = req.query.q || "";
  let priceMin = 0,
    priceMax = 100000000;
  if (priceRange) {
    const [min, max] = priceRange.split(",").map(Number);
    priceMin = min;
    priceMax = max;
  }
  const products = color
    ? productService.getProductsByColor(color, pageNo, priceMin, priceMax)
    : productService.getAllProducts(pageNo, sort, priceMin, priceMax);
  res.render("category", {
    title: "Tất cả sản phẩm",
    products,
    sort,
    color,
    price_range: priceRange,
    selectedCategoryId: null,
    selectedCategoryName: "Tất cả sản phẩm",
    brand,
    rating,
    q,
    ...getRenderData(req),
  });
});

app.post("/cart/remove/:id", (req, res) => {
  const ok = cartService.removeCartItem(parseInt(req.params.id, 10));
  if (!ok) return res.json({ ok: false, message: "Không tìm thấy sản phẩm" });
  const userId = req.session.user ? req.session.user.email : null;
  const totals = computeTotalsForUser(userId);
  return res.json({ ok: true, totals });
});

app.get("/category/:id", (req, res) => {
  const categoryId = parseInt(req.params.id);
  const pageNo = parseInt(req.query.pageNo) || 1;
  const sort = req.query.sort || null;
  const color = req.query.color || null;
  const priceRange = req.query.price_range || null;
  let priceMin = 0,
    priceMax = 100000000;
  if (priceRange) {
    const [min, max] = priceRange.split(",").map(Number);
    priceMin = min;
    priceMax = max;
  }
  const products = color
    ? productService.getProductsByColorAndCategoryId(
        color,
        categoryId,
        priceMin,
        priceMax,
        pageNo
      )
    : productService.getProductsByCategoryId(
        categoryId,
        pageNo,
        sort,
        priceMin,
        priceMax
      );
  const categories = categoryService.getAllActiveCategories();
  const selectedCategoryName =
    categories.find((c) => c.id === categoryId)?.name || "Chưa chọn danh mục";
  res.render("category", {
    title: `Danh mục ${selectedCategoryName}`,
    products,
    sort,
    color,
    price_range: priceRange,
    selectedCategoryId: categoryId,
    selectedCategoryName,
    ...getRenderData(req),
  });
});

app.get("/add-to-cart/:id", (req, res) => {
  console.log(`Thêm sản phẩm ${req.params.id} vào giỏ hàng`);
  res.redirect("/cart");
});

app.get("/login-register", (req, res) => {
  res.render("login_register", {
    title: "Đăng nhập & Đăng ký",
    error: null,
    success: null,
    ...getRenderData(req),
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.email === username && u.password === password
  );
  if (user) {
    req.session.user = user;
    return res.redirect("/my-account");
  }
  res.render("login_register", {
    title: "Đăng nhập & Đăng ký",
    error: "Email hoặc mật khẩu không đúng!",
    success: null,
    ...getRenderData(req),
  });
});

app.post("/register", (req, res) => {
  const {
    register_name,
    register_email,
    register_phone,
    register_address,
    register_password,
    register_confirmPassword,
  } = req.body;
  if (register_password !== register_confirmPassword) {
    return res.render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: "Mật khẩu xác nhận không khớp!",
      success: null,
      ...getRenderData(req),
    });
  }
  if (users.find((u) => u.email === register_email)) {
    return res.render("login_register", {
      title: "Đăng nhập & Đăng ký",
      error: "Email đã được sử dụng!",
      success: null,
      ...getRenderData(req),
    });
  }
  users.push({
    email: register_email,
    password: register_password,
    name: register_name,
    phone: register_phone,
    address: register_address,
  });
  res.render("login_register", {
    title: "Đăng nhập & Đăng ký",
    error: null,
    success: "Đăng ký thành công! Vui lòng đăng nhập.",
    ...getRenderData(req),
  });
});

app.get("/forgot-password", (req, res) =>
  res.render("forgot_password", {
    title: "Khôi phục mật khẩu",
    ...getRenderData(req),
  })
);
app.get("/shop-cart", (req, res) =>
  res.render("shop_cart", { title: "Giỏ hàng", ...getRenderData(req) })
);

app.get("/shop-cart/checkout", (req, res) =>
  res.render("shop_checkout", { title: "Thanh toán", ...getRenderData(req) })
);
app.post("/shop-cart/submit", (req, res) => {
  const userId = req.session.user ? req.session.user.email : null;
  if (!userId) return res.redirect("/login-register");
  const carts = cartService.getCartItems(userId);
  if (carts.length === 0)
    return res.render("shop_checkout", {
      title: "Thanh toán",
      error: "Giỏ hàng trống, không thể đặt hàng!",
      success: null,
      ...getRenderData(req),
    });
  const order = orderService.createOrderFromCart(userId);
  if (!order)
    return res.render("shop_checkout", {
      title: "Thanh toán",
      error: "Không thể tạo đơn hàng!",
      success: null,
      ...getRenderData(req),
    });
  res.render("shop_order_complete", {
    title: "Hoàn tất đơn hàng",
    order,
    ...getRenderData(req),
  });
});

app.get("/my-account", requireLogin, (req, res) =>
  res.render("account_dashboard", {
    title: "Tổng quan tài khoản",
    ...getRenderData(req),
  })
);
app.get("/account-edit", requireLogin, (req, res) =>
  res.render("account_edit", {
    title: "Quản lý tài khoản",
    error: null,
    success: null,
    ...getRenderData(req),
  })
);

app.post("/change-password", requireLogin, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = users.find((u) => u.email === req.session.user.email);
  if (!user || currentPassword !== user.password)
    return res.render("account_edit", {
      title: "Quản lý tài khoản",
      error: "Mật khẩu hiện tại không đúng!",
      success: null,
      ...getRenderData(req),
    });
  if (newPassword !== confirmPassword)
    return res.render("account_edit", {
      title: "Quản lý tài khoản",
      error: "Mật khẩu mới và xác nhận không khớp!",
      success: null,
      ...getRenderData(req),
    });
  user.password = newPassword;
  res.render("account_edit", {
    title: "Quản lý tài khoản",
    error: null,
    success: "Thay đổi mật khẩu thành công!",
    ...getRenderData(req),
  });
});

app.get("/account-orders", requireLogin, (req, res) => {
  const userId = req.session.user?.email;
  const orders = orderService.getOrdersByUserId(userId);
  res.render("account_orders", {
    title: "Đơn hàng",
    orders,
    ...getRenderData(req),
  });
});

app.get("/orders/:id/details", requireLogin, (req, res) => {
  const userId = req.session.user?.email;
  const order = orderService.getOrderById(req.params.id, userId);
  res.render("order_detail", {
    title: "Chi tiết đơn hàng",
    order,
    ...getRenderData(req),
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login-register"));
});

module.exports = app;
