const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const app = express();
const http = require('http');
const { Server } = require('socket.io');

// ============ Reviews & Ratings (in-memory) ============
const reviewsDB = {}; // productId -> [{id,user,message,createdAt}]
const ratingsDB = {}; // productId -> { byUser: { [email]: stars } }

function getRatingStats(productId){
  const byUser = ratingsDB[productId]?.byUser || {};
  const scores = Object.values(byUser);
  const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
  return { avg: +avg.toFixed(2), count: scores.length };
}


// Cấu hình EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Phục vụ file tĩnh (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware để parse form data và JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Cấu hình session
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Cấu hình multer cho upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/mixishop/images/categories/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware kiểm tra đăng nhập
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login-register');
  }
  next();
};

// Giả lập cơ sở dữ liệu người dùng (in-memory)
const users = [
  { email: 'test@example.com', password: 'password', name: 'Test User', phone: '123456789', address: '123 Main St' }
];

// Giả lập cơ sở dữ liệu giỏ hàng (in-memory)
const cartsDB = [];

// Giả lập cơ sở dữ liệu đơn hàng (in-memory)
const ordersDB = [
  {
    id: 2416,
    userId: 'test@example.com',
    orderDate: 'October 1, 2023',
    paymentMethod: 'Credit Card',
    status: 'On hold',
    totalAmount: '$250 for 3 items',
    items: [
      { productName: 'Áo Thun Đen', color: 'Red', size: 'M', quantity: 2, price: '$100', subtotal: '$200' },
      { productName: 'Quần Jeans', color: 'Blue', size: 'L', quantity: 1, price: '$50', subtotal: '$50' }
    ]
  }
];



// Giả lập cơ sở dữ liệu categories (in-memory)
let categoriesDB = [
  { id: 1, name: 'Category 1', imageUrl: '/mixishop/images/cat1.jpg', status: 1 },
  { id: 2, name: 'Category 2', imageUrl: '/mixishop/images/cat2.jpg', status: 1 }
];

// Giả lập các service
const orderService = {
  getOrdersByUserId: (userId) => {
    return ordersDB.filter(order => order.userId === userId);
  },
  getOrderById: (orderId, userId) => {
    return ordersDB.find(order => order.id === parseInt(orderId) && order.userId === userId);
  },
  createOrderFromCart: (userId) => {
    const carts = cartService.getCartItems(userId);
    if (carts.length === 0) return null;
    const totalAmount = carts.reduce((sum, cart) => sum + cart.productColor.product.price * cart.quantity, 0);
    const order = {
      id: ordersDB.length + 1,
      userId,
      orderDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      paymentMethod: 'Credit Card',
      status: 'On hold',
      totalAmount: `$${totalAmount} for ${carts.length} items`,
      items: carts.map(cart => ({
        productName: cart.productColor.product.name,
        color: cart.productColor.color,
        size: cart.productSize.size,
        quantity: cart.quantity,
        price: cart.productColor.product.getFormattedPrice(cart.productColor.product.price),
        subtotal: cart.productColor.product.getFormattedPrice(cart.productColor.product.price * cart.quantity)
      }))
    };
    ordersDB.push(order);
    // Xóa giỏ hàng của user
    cartsDB.splice(0, cartsDB.length, ...cartsDB.filter(cart => cart.userId !== userId));
    return order;
  }
};

const cartService = {
  getCartItems: (userId) => {
    return userId ? cartsDB.filter(cart => cart.userId === userId) : [
      { 
        id: 1, 
        productSize: { product: { id: 1, name: 'Áo Thun Đen', price: 100, getFormattedPrice: (price) => `$${price}` }, size: 'M' }, 
        productColor: { color: 'Red', imageUrls: ['/mixishop/images/product1-1.jpg'], product: { id: 1, name: 'Áo Thun Đen', price: 100, getFormattedPrice: (price) => `$${price}` } }, 
        quantity: 2 
      },
      { 
        id: 2, 
        productSize: { product: { id: 2, name: 'Quần Jeans', price: 50, getFormattedPrice: (price) => `$${price}` }, size: 'L' }, 
        productColor: { color: 'Blue', imageUrls: ['/mixishop/images/product2-1.jpg'], product: { id: 2, name: 'Quần Jeans', price: 50, getFormattedPrice: (price) => `$${price}` } }, 
        quantity: 1 
      }
    ];
  },
  addToCart: (userId, productId, size, color, quantity) => {
    const product = productService.getProductById(productId);
    if (!product) return false;
    const cartItem = {
      id: cartsDB.length + 1,
      userId,
      productSize: { product: { id: product.id, name: product.name, price: product.price, getFormattedPrice: product.getFormattedPrice }, size },
      productColor: { color, imageUrls: product.colors.find(c => c.color === color)?.imageUrls || [], product: { id: product.id, name: product.name, price: product.price, getFormattedPrice: product.getFormattedPrice } },
      quantity: parseInt(quantity)
    };
    cartsDB.push(cartItem);
    return true;
  },
  removeCartItem: (cartId) => {
    const index = cartsDB.findIndex(cart => cart.id === parseInt(cartId));
    if (index === -1) return false;
    cartsDB.splice(index, 1);
    return true;
  },
  updateCartItem: (cartId, quantity) => {
    const cartItem = cartsDB.find(cart => cart.id === parseInt(cartId));
    if (!cartItem) return false;
    cartItem.quantity = parseInt(quantity);
    return true;
  }
};

// ============ Dữ liệu sản phẩm dùng chung ============
const productsData = [
  { 
    id: 1, 
    name: "Áo Thun Đen", 
    brand: { name: "Mixi" },
    price: 100, 
    description: "Áo thun cotton thoáng mát.\nPhom regular.\nBo cổ bền.\nIn bền màu.\nPhối đồ đa dụng.",
    productStatus: { statusName: "Bán chạy" },
    sizes: [{ size: "S" }, { size: "M" }, { size: "L" }],
    colors: [
      { color: "Red",   imageUrls: ["/mixishop/images/products/ao2023.png", "/mixishop/images/products/ao2024.png", "/mixishop/images/products/ao20241.png"] },
      { color: "Black", imageUrls: ["/mixishop/images/products/ao3loMixi.png", "/mixishop/images/products/ao20242.png", "/mixishop/images/products/ao20243.png"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Red": { "S": 10, "M": 5, "L": 0 }, "Black": { "S": 8, "M": 3, "L": 2 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 2, 
    name: "Quần Jeans", 
    brand: { name: "DenimCo" },
    price: 200, 
    description: "Jeans nam co giãn nhẹ.\nForm vừa vặn.\nBạc màu nhẹ.\nKhóa kéo kim loại.\nỐng đứng dễ mặc.",
    productStatus: { statusName: "Trending" },
    sizes: [{ size: "M" }, { size: "L" }, { size: "XL" }],
    colors: [
      { color: "Red",   imageUrls: ["/mixishop/images/products/ao2023.png", "/mixishop/images/products/ao2024.png", "/mixishop/images/products/ao20241.png"] },
      { color: "Black", imageUrls: ["/mixishop/images/products/ao3loMixi.png", "/mixishop/images/products/ao20242.png", "/mixishop/images/products/ao20243.png"] }
    ],
    category: { id: 2, name: 'Category 2' },
    stock: { "Blue": { "M": 15, "L": 7, "XL": 4 }, "Black": { "M": 6, "L": 2, "XL": 0 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 3, 
    name: "Áo Khoác", 
    brand: { name: "OuterWear" },
    price: 300, 
    description: "Áo khoác ấm, cản gió.\nVải dệt dày.\nKhóa kéo trơn mượt.\nNhiều túi tiện lợi.\nĐi làm/đi chơi đều hợp.",
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      { color: "Red",   imageUrls: ["/mixishop/images/products/ao2023.png", "/mixishop/images/products/ao2024.png", "/mixishop/images/products/ao20241.png"] },
      { color: "Black", imageUrls: ["/mixishop/images/products/ao3loMixi.png", "/mixishop/images/products/ao20242.png", "/mixishop/images/products/ao20243.png"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Green": { "S": 12, "M": 8 }, "Black": { "S": 4, "M": 3 } },
    getFormattedPrice: (price) => `$${price}`
  }
];

const productService = {
  _data: productsData,

  _paged(list, pageNo, pageSize = 12){
    const totalPages = Math.max(Math.ceil(list.length / pageSize), 1);
    const content = list.slice((pageNo - 1) * pageSize, pageNo * pageSize);
    return { content, number: pageNo - 1, totalPages, hasPrevious: pageNo > 1, hasNext: pageNo < totalPages };
  },

  getAllProducts(pageNo, sort, priceMin, priceMax, pageSize = 12){
    let products = this._data.filter(p => p.price >= priceMin && p.price <= priceMax);

    if (sort === 'a_z')                     products.sort((a,b)=> a.name.localeCompare(b.name));
    else if (sort === 'z_a')                products.sort((a,b)=> b.name.localeCompare(a.name)); // ✅ FIX
    else if (sort === 'price_low_to_high')  products.sort((a,b)=> a.price - b.price);
    else if (sort === 'price_high_to_low')  products.sort((a,b)=> b.price - a.price);

    return this._paged(products, pageNo, pageSize);
  },

  getProductsByCategoryId(categoryId, pageNo, sort, priceMin, priceMax, pageSize = 12){
    let products = this._data.filter(p => p.category.id === categoryId && p.price >= priceMin && p.price <= priceMax);

    if (sort === 'a_z')                     products.sort((a,b)=> a.name.localeCompare(b.name));
    else if (sort === 'z_a')                products.sort((a,b)=> b.name.localeCompare(a.name));
    else if (sort === 'price_low_to_high')  products.sort((a,b)=> a.price - b.price);
    else if (sort === 'price_high_to_low')  products.sort((a,b)=> b.price - a.price);

    return this._paged(products, pageNo, pageSize);
  },

  getProductsByColor(color, pageNo, priceMin, priceMax){
    let products = this._data.filter(p => p.price >= priceMin && p.price <= priceMax && p.colors.some(c=>c.color===color));
    return this._paged(products, pageNo);
  },

  getProductsByColorAndCategoryId(color, categoryId, priceMin, priceMax, pageNo){
    let products = this._data.filter(p => p.category.id===categoryId && p.price >= priceMin && p.price <= priceMax && p.colors.some(c=>c.color===color));
    return this._paged(products, pageNo);
  },

  getProductById(id){
    return this._data.find(p => p.id === parseInt(id)); // ✅ không phụ thuộc phân trang
  },

  checkStock(productId, color, size){
    const p = this.getProductById(productId);
    if (!p || !p.stock[color] || !p.stock[color][size]) return 0;
    return p.stock[color][size];
  },

  searchProducts(keyword, pageNo, sort, priceMin, priceMax, pageSize = 12){
    let products = this._data.filter(p => p.price >= priceMin && p.price <= priceMax);
    if (keyword && keyword.trim()){
      const q = keyword.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        ((p.brand?.name || '').toLowerCase().includes(q))
      );
    }
    if (sort === 'a_z')                     products.sort((a,b)=> a.name.localeCompare(b.name));
    else if (sort === 'z_a')                products.sort((a,b)=> b.name.localeCompare(a.name));
    else if (sort === 'price_low_to_high')  products.sort((a,b)=> a.price - b.price);
    else if (sort === 'price_high_to_low')  products.sort((a,b)=> b.price - a.price);

    const paged = this._paged(products, pageNo, pageSize);
    return { ...paged, totalElements: products.length };
  }
};

const categoryService = {
  getAllCategories: () => categoriesDB,
  getAllActiveCategories: () => categoriesDB.filter(cat => cat.status === 1),
  getCategoryById: (id) => categoriesDB.find(cat => cat.id === parseInt(id)),
  addCategory: (name, imagePath, status) => {
    const newId = categoriesDB.length > 0 ? Math.max(...categoriesDB.map(c => c.id)) + 1 : 1;
    const newCategory = { id: newId, name, imageUrl: imagePath, status: parseInt(status) };
    categoriesDB.push(newCategory);
    return newCategory;
  },
  updateCategory: (id, name, imagePath, status) => {
    const category = categoriesDB.find(cat => cat.id === parseInt(id));
    if (!category) return false;
    category.name = name;
    if (imagePath) category.imageUrl = imagePath;
    category.status = parseInt(status);
    return true;
  }
};

const wishlistService = {
  getWishlistCount: () => 3
};

// Hàm trợ giúp để lấy dữ liệu render
const getRenderData = (req) => {
  const userId = req.session.user ? req.session.user.email : null;
  const user = req.session.user || null;
  const carts = cartService.getCartItems(userId);
  const orders = orderService.getOrdersByUserId(userId);
  const categories = categoryService.getAllActiveCategories();
  const wishlistCount = wishlistService.getWishlistCount();
  const total = carts.reduce((sum, cart) => sum + cart.productColor.product.price * cart.quantity, 0);
  return {
    user,
    carts,
    orders,
    categories,
    wishlistCount,
    total,
    formattedTotal: `$${total}`,
    loggedInUser: !!req.session.user,
    isEmpty: carts.length === 0
  };
};

// Admin Routes
app.get('/admin', requireLogin, (req, res) => {
  res.render('admin/dashboard_admin', { title: 'Trang chủ Admin' });
});

app.get('/admin/categogy', requireLogin, (req, res) => {
  const categories = categoryService.getAllCategories();
  res.render('admin/category', { title: 'Danh sách nhóm sản phẩm', categories });
});

app.get('/admin/categogy/addCategogy', requireLogin, (req, res) => {
  res.render('admin/category_add', { title: 'Thêm nhóm sản phẩm' });
});

app.post('/admin/addCategory', requireLogin, upload.single('image'), (req, res) => {
  const { name, status } = req.body;
  let imagePath = '/mixishop/images/categories/default.jpg'; // Default image
  if (req.file) {
    imagePath = '/mixishop/images/categories/' + req.file.filename;
  }
  categoryService.addCategory(name, imagePath, status);
  res.redirect('/admin/categogy');
});

app.get('/admin/categogy/update/:id', requireLogin, (req, res) => {
  const id = req.params.id;
  const category = categoryService.getCategoryById(id);
  if (!category) {
    return res.status(404).send('Không tìm thấy nhóm sản phẩm');
  }
  res.render('admin/category_edit', { title: 'Chỉnh sửa nhóm sản phẩm', category });
});

app.post('/admin/updateCategory', requireLogin, upload.single('image'), (req, res) => {
  const { id, name, status } = req.body;
  let imagePath = null;
  if (req.file) {
    imagePath = '/mixishop/images/categories/' + req.file.filename;
  }
  const success = categoryService.updateCategory(id, name, imagePath, status);
  if (success) {
    res.redirect('/admin/categogy');
  } else {
    res.status(404).send('Không tìm thấy nhóm sản phẩm để cập nhật');
  }
});

app.get('/admin/products', requireLogin, (req, res) => {
  // giả lập dữ liệu từ DB
  const products = [
    { id: 1, name: 'Áo thun', description: 'Áo cotton 100%', formattedPrice: '150,000đ', statusName: 'Còn hàng' },
    { id: 2, name: 'Quần jean', description: 'Quần jean nam', formattedPrice: '350,000đ', statusName: 'Hết hàng' }
  ];

  const productsData = {
    hasPrevious: false,
    hasNext: true,
    number: 0,          // trang hiện tại (bắt đầu từ 0)
    totalPages: 5
  };

  res.render('admin/products', {
    title: 'Danh sách sản phẩm',
    products,           // <-- Truyền mảng sản phẩm
    productsData        // <-- Truyền thông tin phân trang
  });
});

// Thêm sản phẩm
app.get('/admin/products/addProduct', requireLogin, (req, res) => {
  // giả lập dữ liệu lấy từ DB
  const productStatuses = [
    { id: 1, statusName: 'Còn hàng' },
    { id: 2, statusName: 'Hết hàng' }
  ];

  const categories = [
    { id: 1, name: 'Áo thun' },
    { id: 2, name: 'Quần jean' }
  ];

  res.render('admin/product_add', {
    title: 'Thêm sản phẩm',
    productStatuses,
    categories
  });
});

// Xử lý submit form thêm sản phẩm
app.post('/admin/addProducts', requireLogin, (req, res) => {
  const { name, description, price, statusId, categoryId } = req.body;
  console.log('Dữ liệu sản phẩm mới:', name, description, price, statusId, categoryId);

  // TODO: Lưu vào DB

  res.redirect('/admin/products');
});

// ví dụ service giả lập
const ordersService = {
  getOrders: (pageNo = 1, pageSize = 5) => {
    // dữ liệu giả
    const allOrders = [
      { id: 1, customerName: "Nguyễn Văn A", customerPhone: "0901234567", orderDate: "2025-09-01", paymentMethod: "COD", totalAmount: 150000, notes: "Giao nhanh" },
      { id: 2, customerName: "Trần Thị B", customerPhone: "0912345678", orderDate: "2025-09-02", paymentMethod: "Momo", totalAmount: 250000, notes: "" },
      { id: 3, customerName: "Phạm Văn C", customerPhone: "0923456789", orderDate: "2025-09-03", paymentMethod: "Banking", totalAmount: 300000, notes: "Giao buổi tối" },
      // thêm dữ liệu nữa...
    ];

    const totalPages = Math.ceil(allOrders.length / pageSize);
    const start = (pageNo - 1) * pageSize;
    const end = start + pageSize;

    return {
      content: allOrders.slice(start, end),
      number: pageNo - 1, // để khớp với EJS (0-based)
      totalPages: totalPages,
      hasPrevious: pageNo > 1,
      hasNext: pageNo < totalPages
    };
  }
};

// Route
app.get('/admin/order-list', requireLogin, (req, res) => {
  const pageNo = parseInt(req.query.pageNo) || 1;
  const pageSize = 5; // tuỳ chỉnh
  const orders = ordersService.getOrders(pageNo, pageSize);

  res.render('admin/order_list', {
    title: 'Danh sách đơn hàng',
    orders: orders
  });
});

// Trang danh sách màu theo productId
app.get('/admin/products/color/:productId', requireLogin, (req, res) => {
  const productId = parseInt(req.params.productId);

  // Giả lập dữ liệu sản phẩm
  const product = productService.getProductById(productId);
  if (!product) {
    return res.status(404).send('Không tìm thấy sản phẩm');
  }

  // Giả lập danh sách màu (sẽ gắn theo product)
  const productColors = product.colors.map((c, index) => ({
    id: index + 1,
    color: c.color,
    product: product,
    imageUrls: c.imageUrls
  }));

  res.render('admin/product_color', {
    title: "Màu sắc sản phẩm",
    product: product,
    productColors: productColors
  });
});

// Form thêm màu
app.get('/admin/products/color/:productId/add', requireLogin, (req, res) => {
  const productId = parseInt(req.params.productId);
  const product = productService.getProductById(productId);
  if (!product) {
    return res.status(404).send('Không tìm thấy sản phẩm');
  }
  res.render('admin/product_color_add', {
    title: "Thêm màu sản phẩm",
    product: product
  });
});

// Xử lý thêm màu (upload ảnh)
app.post('/admin/products/color/:productId/add', requireLogin, upload.array('images', 5), (req, res) => {
  const productId = parseInt(req.params.productId);
  const { color } = req.body;
  const product = productService.getProductById(productId);
  if (!product) {
    return res.status(404).send('Không tìm thấy sản phẩm');
  }

  const imageUrls = req.files.map(file => '/mixishop/images/categories/' + file.filename);

  // Thêm vào product.colors (giả lập DB)
  product.colors.push({ color, imageUrls });

  res.redirect(`/admin/products/color/${productId}`);
});

// Xóa màu
app.post('/admin/products/color/:productId/delete/:color', requireLogin, (req, res) => {
  const productId = parseInt(req.params.productId);
  const color = req.params.color;
  const product = productService.getProductById(productId);
  if (!product) {
    return res.status(404).send('Không tìm thấy sản phẩm');
  }

  product.colors = product.colors.filter(c => c.color !== color);
  res.redirect(`/admin/products/color/${productId}`);
});






app.get('/admin/order-pending', requireLogin, (req, res) => {
  res.render('admin/order_pending', { title: 'Danh sách đơn hàng chờ phê duyệt' });
});

// Route Home
app.get('/home', (req, res) => {
  const productPage = productService.getAllProducts(1, null, 0, 100000000);
  res.render('home', {
    title: 'Trang chủ',
    products: productPage.content,
    ...getRenderData(req)
  });
});

// Route Cart
app.get('/cart', (req, res) => {
  res.render('cart', {
    title: 'Giỏ hàng',
    ...getRenderData(req)
  });
});

// Route About
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'Giới thiệu',
    ...getRenderData(req)
  });
});

// Route Blog
app.get('/blog', (req, res) => {
  res.render('blog', {
    title: 'Blog',
    ...getRenderData(req)
  });
});

// Route Contact
app.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Liên hệ',
    ...getRenderData(req)
  });
});

// Route Product Detail
app.get('/product_detail/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = productService.getProductById(productId);
  if (!product) return res.status(404).send('Sản phẩm không tồn tại');

  const relatedProducts = productService.getProductsByCategoryId(
    product.category.id, 1, null, 0, 100000000
  ).content;

  // Ảnh
  let allImages = product.colors.reduce((acc, c) => acc.concat(c.imageUrls), []);
  while (allImages.length < 3 && allImages.length > 0) allImages.push(allImages[0]);

  // Đánh giá / bình luận
  const reviews = reviewsDB[productId] || [];
  const ratingStats = getRatingStats(productId) || { avg: 0, count: 0 };

  // -> build phân bố sao cho UI (5,4,3,2,1)
  const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  for (const r of reviews) {
    const s = Number(r.stars) || 0;
    if (s >= 1 && s <= 5) dist[s]++;
  }
  const ratingBreakdown = {
    avg: Number(ratingStats.avg) || 0,
    count: Number(ratingStats.count) || reviews.filter(r => r.stars).length,
    dist
  };

  // Nếu có thống kê trải nghiệm thì truyền, không thì để mảng rỗng
  const expStats = []; // [{name:'Hiệu năng', avg:4.8, count:ratingBreakdown.count}, ...]

  const userRated = req.session.user
    ? (ratingsDB[productId]?.byUser?.[req.session.user.email] || 0)
    : 0;
  const likerId = req.session.user ? req.session.user.email : req.sessionID;

  res.render('product_detail', {
    title: product.name,
    product,
    productSizes: product.sizes,
    allImages,
    products: relatedProducts,
    reviews,
    ratingStats,          // vẫn truyền nếu JS phía client dùng
    ratingBreakdown,      // 👈 thêm biến mà EJS cần
    expStats,             // 👈 có/không đều an toàn
    userRated,
    likerId,
    message: null,
    error: null,
    ...getRenderData(req)
  });
});


// Bình luận: KHÔNG cần login
app.post('/api/products/:id/comments', (req, res) => {
  const productId = parseInt(req.params.id);
  const { name, message, parentId } = req.body || {};

  const p = productService.getProductById(productId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  if (!message || message.trim().length < 2) return res.status(400).json({ error: 'Nội dung quá ngắn' });

  const cmt = {
    id: Date.now(),
    parentId: parentId ? parseInt(parentId) : null,   // 👈 HỖ TRỢ TRẢ LỜI
    user: (name && name.trim()) || (req.session.user?.name || 'Khách'),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: {} // { likerId: true }
  };

  if (!reviewsDB[productId]) reviewsDB[productId] = [];
  reviewsDB[productId].push(cmt);

  if (io) io.emit('new-comment', { productId, comment: cmt });
  return res.json({ ok: true, comment: cmt });
});

app.post('/api/products/:pid/comments/:cid/like', (req, res) => {
  const pid = parseInt(req.params.pid);
  const cid = parseInt(req.params.cid);
  const likerId = req.session.user ? req.session.user.email : req.sessionID;

  const list = reviewsDB[pid] || [];
  const c = list.find(it => it.id === cid);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

  if (!c.likedBy) c.likedBy = {};
  if (c.likedBy[likerId]) {
    delete c.likedBy[likerId]; // bỏ tim
  } else {
    c.likedBy[likerId] = true; // thả tim
  }
  c.likes = Object.keys(c.likedBy).length;

  if (io) io.emit('comment-liked', { productId: pid, commentId: cid, likes: c.likes });
  return res.json({ ok: true, likes: c.likes, liked: !!c.likedBy[likerId] });
});


// Đánh giá sao: CẦN login
app.post('/api/products/:id/ratings', (req, res) => {
  const productId = parseInt(req.params.id);
  if (!req.session.user) return res.status(401).json({ error: 'Bạn cần đăng nhập để đánh giá.' });
  const p = productService.getProductById(productId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  const stars = parseInt(req.body?.stars, 10);
  if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'Số sao không hợp lệ' });

  const email = req.session.user.email;
  if (!ratingsDB[productId]) ratingsDB[productId] = { byUser: {} };
  ratingsDB[productId].byUser[email] = stars;

  const stats = getRatingStats(productId);
  if (io) io.emit('rating-updated', { productId, stats });
  return res.json({ ok: true, stats });
});


// Route Check Stock
app.get('/product_detail/:id/check-stock', (req, res) => {
  const productId = parseInt(req.params.id);
  const { color, size } = req.query;
  const stockQuantity = productService.checkStock(productId, color, size);
  res.json(stockQuantity);
});

// Route Add to Cart (POST)
app.post('/add-to-cart', (req, res) => {
  const { productId, size, color, quantity } = req.body;
  const userId = req.session.user ? req.session.user.email : null;
  const success = cartService.addToCart(userId, productId, size, color, quantity);
  const product = productService.getProductById(productId);
  if (!product) {
    return res.status(404).send('Sản phẩm không tồn tại');
  }
  const relatedProducts = productService.getProductsByCategoryId(product.category.id, 1, null, 0, 100000000).content;
  const allImages = product.colors.reduce((acc, color) => acc.concat(color.imageUrls), []);
  res.render('product_detail', {
    title: product.name,
    product,
    productSizes: product.sizes,
    allImages,
    products: relatedProducts,
    message: success ? 'Thêm vào giỏ hàng thành công!' : null,
    error: !success ? 'Không thể thêm vào giỏ hàng!' : null,
    ...getRenderData(req)
  });
});

// Route Search
app.get('/search', (req, res) => {
  const keyword = req.query.keyword || '';
  const pageNo = parseInt(req.query.pageNo) || 1;
  const sort = req.query.sort || null;
  const priceRange = req.query.price_range || null;
  let priceMin = 0;
  let priceMax = 100000000;
  if (priceRange && priceRange !== '') {
    const [min, max] = priceRange.split(',').map(Number);
    priceMin = min;
    priceMax = max;
  }
  const searchResult = productService.searchProducts(keyword, pageNo, sort, priceMin, priceMax);
  res.render('product_search', {
    title: `Kết quả tìm kiếm: ${keyword}`,
    products: searchResult.content,
    quantity: searchResult.totalElements,
    keyword,
    ...getRenderData(req)
  });
});

// Route Shop Cart
app.get('/shop-cart', (req, res) => {
  res.render('shop_cart', {
    title: 'Giỏ hàng',
    ...getRenderData(req)
  });
});

function itemPrice(cartItem) {
  return cartItem.productColor.product.price; // đơn giá
}

function computeTotalsForUser(userId) {
  const list = cartService.getCartItems(userId); // mảng cart của user
  const subtotal = list.reduce((s, it) => s + itemPrice(it) * it.quantity, 0);
  // nếu sau có thuế/ship thì cộng thêm ở đây
  return { total: subtotal };
}


// Route Remove from Cart
app.post('/remove-from-cart', (req, res) => {
  const { cartItemId } = req.body;
  const success = cartService.removeCartItem(cartItemId);
  res.send(success ? 'Xóa sản phẩm khỏi giỏ hàng thành công!' : 'Không thể xóa sản phẩm!');
});

// Route Update Cart Item
app.post('/cart/update/:id', (req, res) => {
  const cartId = parseInt(req.params.id, 10);
  const qty = parseInt(req.body?.quantity, 10);
  if (!Number.isFinite(qty) || qty < 1) {
    return res.json({ ok: false, message: 'Số lượng không hợp lệ' });
  }

  const ok = cartService.updateCartItem(cartId, qty);
  if (!ok) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

  // lấy lại item vừa sửa để tính lineTotal
  const userId = req.session.user ? req.session.user.email : null;
  const item = cartService.getCartItems(userId).find(i => i.id === cartId);
  const lineTotal = item ? itemPrice(item) * item.quantity : 0;

  const totals = computeTotalsForUser(userId);
  return res.json({ ok: true, lineTotal, totals });
});



// Route Check-login
app.get('/check-login', (req, res) => {
  res.json({ isLoggedIn: !!req.session.user });
});

// Route Category Alls
app.get('/category/alls', (req, res) => {
  const pageNo = parseInt(req.query.pageNo) || 1;
  const sort = req.query.sort || null;
  const color = req.query.color || null;
  const priceRange = req.query.price_range || null;

  // 👇 bổ sung
  const brand  = req.query.brand  || '';
  const rating = req.query.rating || '';
  const q      = req.query.q      || '';

  let priceMin = 0, priceMax = 100000000;
  if (priceRange && priceRange !== '') {
    const [min, max] = priceRange.split(',').map(Number);
    priceMin = min; priceMax = max;
  }

  const products = color && color !== ''
    ? productService.getProductsByColor(color, pageNo, priceMin, priceMax)
    : productService.getAllProducts(pageNo, sort, priceMin, priceMax);

  res.render('category', {
    title: 'Tất cả sản phẩm',
    products,
    sort, color,
    price_range: priceRange,
    selectedCategoryId: null,
    selectedCategoryName: 'Tất cả sản phẩm',
    // 👇 truyền vào view để EJS dùng được
    brand, rating, q,
    ...getRenderData(req)
  });
});

app.post('/cart/remove/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ok = cartService.removeCartItem(id);
  if (!ok) return res.json({ ok: false, message: 'Không tìm thấy sản phẩm' });

  const userId = req.session.user ? req.session.user.email : null;
  const totals = computeTotalsForUser(userId);
  return res.json({ ok: true, totals });
});




// Route Category
app.get('/category/:id', (req, res) => {
  const categoryId = parseInt(req.params.id);
  const pageNo = parseInt(req.query.pageNo) || 1;
  const sort = req.query.sort || null;
  const color = req.query.color || null;
  const priceRange = req.query.price_range || null;
  let priceMin = 0;
  let priceMax = 100000000;
  if (priceRange && priceRange !== '') {
    const [min, max] = priceRange.split(',').map(Number);
    priceMin = min;
    priceMax = max;
  }
  const products = color && color !== ''
    ? productService.getProductsByColorAndCategoryId(color, categoryId, priceMin, priceMax, pageNo)
    : productService.getProductsByCategoryId(categoryId, pageNo, sort, priceMin, priceMax);
  const categories = categoryService.getAllActiveCategories();
  const selectedCategoryName = categories.find(cat => cat.id === categoryId)?.name || 'Chưa chọn danh mục';
  res.render('category', {
    title: `Danh mục ${selectedCategoryName}`,
    products,
    sort,
    color,
    price_range: priceRange,
    selectedCategoryId: categoryId,
    selectedCategoryName,
    ...getRenderData(req)
  });
});

// Route Add to Cart (GET, mock implementation)
app.get('/add-to-cart/:id', (req, res) => {
  const productId = req.params.id;
  console.log(`Thêm sản phẩm ${productId} vào giỏ hàng`);
  res.redirect('/cart');
});

// Route Login (GET)
app.get('/login-register', (req, res) => {
  res.render('login_register', {
    title: 'Đăng nhập & Đăng ký',
    error: null,
    success: null,
    ...getRenderData(req)
  });
});

// Route Login (POST)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.email === username && u.password === password);
  if (user) {
    req.session.user = user;
    res.redirect('/my-account');
  } else {
    res.render('login_register', {
      title: 'Đăng nhập & Đăng ký',
      error: 'Email hoặc mật khẩu không đúng!',
      success: null,
      ...getRenderData(req)
    });
  }
});

// Route Register (POST)
app.post('/register', (req, res) => {
  const { register_name, register_email, register_phone, register_address, register_password, register_confirmPassword } = req.body;
  if (register_password !== register_confirmPassword) {
    return res.render('login_register', {
      title: 'Đăng nhập & Đăng ký',
      error: 'Mật khẩu xác nhận không khớp!',
      success: null,
      ...getRenderData(req)
    });
  }
  if (users.find(u => u.email === register_email)) {
    return res.render('login_register', {
      title: 'Đăng nhập & Đăng ký',
      error: 'Email đã được sử dụng!',
      success: null,
      ...getRenderData(req)
    });
  }
  users.push({
    email: register_email,
    password: register_password,
    name: register_name,
    phone: register_phone,
    address: register_address
  });
  res.render('login_register', {
    title: 'Đăng nhập & Đăng ký',
    error: null,
    success: 'Đăng ký thành công! Vui lòng đăng nhập.',
    ...getRenderData(req)
  });
});

// Route Forgot Password (placeholder)
app.get('/forgot-password', (req, res) => {
  res.render('forgot_password', {
    title: 'Khôi phục mật khẩu',
    ...getRenderData(req)
  });
});

// Route Checkout
app.get('/shop-cart/checkout', (req, res) => {
  res.render('shop_checkout', {
    title: 'Thanh toán',
    ...getRenderData(req)
  });
});

// Route Submit Checkout
app.post('/shop-cart/submit', (req, res) => {
  const userId = req.session.user ? req.session.user.email : null;
  if (!userId) {
    return res.redirect('/login-register');
  }
  const carts = cartService.getCartItems(userId);
  if (carts.length === 0) {
    return res.render('shop_checkout', {
      title: 'Thanh toán',
      error: 'Giỏ hàng trống, không thể đặt hàng!',
      success: null,
      ...getRenderData(req)
    });
  }
  const order = orderService.createOrderFromCart(userId);
  if (!order) {
    return res.render('shop_checkout', {
      title: 'Thanh toán',
      error: 'Không thể tạo đơn hàng!',
      success: null,
      ...getRenderData(req)
    });
  }
  res.render('shop_order_complete', {
    title: 'Hoàn tất đơn hàng',
    order,
    ...getRenderData(req)
  });
});

// Route My Account
app.get('/my-account', requireLogin, (req, res) => {
  res.render('account_dashboard', {
    title: 'Tổng quan tài khoản',
    ...getRenderData(req)
  });
});

// Route Account Edit
app.get('/account-edit', requireLogin, (req, res) => {
  res.render('account_edit', {
    title: 'Quản lý tài khoản',
    error: null,
    success: null,
    ...getRenderData(req)
  });
});

// Route Change Password
app.post('/change-password', requireLogin, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = users.find(u => u.email === req.session.user.email);
  if (currentPassword !== user.password) {
    return res.render('account_edit', {
      title: 'Quản lý tài khoản',
      error: 'Mật khẩu hiện tại không đúng!',
      success: null,
      ...getRenderData(req)
    });
  }
  if (newPassword !== confirmPassword) {
    return res.render('account_edit', {
      title: 'Quản lý tài khoản',
      error: 'Mật khẩu mới và xác nhận mật khẩu không khớp!',
      success: null,
      ...getRenderData(req)
    });
  }
  user.password = newPassword;
  res.render('account_edit', {
    title: 'Quản lý tài khoản',
    error: null,
    success: 'Thay đổi mật khẩu thành công!',
    ...getRenderData(req)
  });
});

// Route Account Orders - FIXED: Pass orders to template
app.get('/account-orders', requireLogin, (req, res) => {
  const userId = req.session.user.email;
  const orders = orderService.getOrdersByUserId(userId);
  res.render('account_orders', {
    title: 'Đơn hàng',
    orders,  // Pass orders array to avoid 'order is not defined'
    ...getRenderData(req)
  });
});

// Route Order Details
app.get('/orders/:id/details', requireLogin, (req, res) => {
  const orderId = req.params.id;
  const userId = req.session.user.email;
  const order = orderService.getOrderById(orderId, userId);
  if (!order) {
    return res.render('order_detail', {
      title: 'Chi tiết đơn hàng',
      order: null,
      ...getRenderData(req)
    });
  }
  res.render('order_detail', {
    title: `Chi tiết đơn hàng #${orderId}`,
    order,
    ...getRenderData(req)
  });
});

// Route Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login-register');
});

// Start Server
// Start Server (kèm Socket.IO)
const server = http.createServer(app);
const io = new Server(server);
global.io = io;

server.listen(3000, () => console.log('✅ Server chạy tại http://localhost:3000'));
