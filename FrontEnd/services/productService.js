const productsDB = [
  { 
    id: 1, 
    name: "Áo Thun Đen", 
    price: 100, 
    description: "Áo thun chất liệu cotton, thoải mái và phong cách.",
    short_description: "Áo thun đen basic cotton",   // ✅ thêm
    avgRating: 4.5,                                  // ✅ thêm
    reviewCount: 23,                                 // ✅ thêm
    productStatus: { statusName: "Bán chạy" },
    sizes: [{ size: "S" }, { size: "M" }, { size: "L" }],
    colors: [
      { color: "Red", imageUrls: ["/mixishop/images/product1-1.jpg", "/mixishop/images/product1-2.jpg"] },
      { color: "Black", imageUrls: ["/mixishop/images/product1-3.jpg"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Red": { "S": 10, "M": 5, "L": 0 }, "Black": { "S": 8, "M": 3, "L": 2 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 2, 
    name: "Quần Jeans", 
    price: 200, 
    description: "Quần jeans thời trang, phù hợp mọi dịp.",
    short_description: "Quần jeans xanh co giãn nhẹ",   // ✅ thêm
    avgRating: 4.0,                                     // ✅ thêm
    reviewCount: 15,                                    // ✅ thêm
    productStatus: { statusName: "Trending" },
    sizes: [{ size: "M" }, { size: "L" }, { size: "XL" }],
    colors: [
      { color: "Blue", imageUrls: ["/mixishop/images/product2-1.jpg"] },
      { color: "Black", imageUrls: ["/mixishop/images/product2-2.jpg"] }
    ],
    category: { id: 2, name: 'Category 2' },
    stock: { "Blue": { "M": 15, "L": 7, "XL": 4 }, "Black": { "M": 6, "L": 2, "XL": 0 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 3, 
    name: "Áo Khoác", 
    price: 300, 
    description: "Áo khoác ấm áp, thiết kế hiện đại.",
    short_description: "Áo khoác hoodie ấm áp",        // ✅ thêm
    avgRating: 5.0,                                    // ✅ thêm
    reviewCount: 8,                                    // ✅ thêm
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      { color: "Green", imageUrls: ["/mixishop/images/product3-1.jpg"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Green": { "S": 12, "M": 8 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 4, 
    name: "Áo Khoác", 
    price: 300, 
    description: "Áo khoác ấm áp, thiết kế hiện đại.",
    short_description: "Áo khoác hoodie ấm áp",        // ✅ thêm
    avgRating: 5.0,                                    // ✅ thêm
    reviewCount: 8,                                    // ✅ thêm
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      { color: "Green", imageUrls: ["/mixishop/images/product3-1.jpg"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Green": { "S": 12, "M": 8 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 5, 
    name: "Áo Khoác", 
    price: 300, 
    description: "Áo khoác ấm áp, thiết kế hiện đại.",
    short_description: "Áo khoác hoodie ấm áp",        // ✅ thêm
    avgRating: 5.0,                                    // ✅ thêm
    reviewCount: 8,                                    // ✅ thêm
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      { color: "Green", imageUrls: ["/mixishop/images/product3-1.jpg"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Green": { "S": 12, "M": 8 } },
    getFormattedPrice: (price) => `$${price}`
  },
  { 
    id: 6, 
    name: "Áo Khoác", 
    price: 300, 
    description: "Áo khoác ấm áp, thiết kế hiện đại.",
    short_description: "Áo khoác hoodie ấm áp",        // ✅ thêm
    avgRating: 5.0,                                    // ✅ thêm
    reviewCount: 8,                                    // ✅ thêm
    productStatus: { statusName: "New" },
    sizes: [{ size: "S" }, { size: "M" }],
    colors: [
      { color: "Green", imageUrls: ["/mixishop/images/product3-1.jpg"] }
    ],
    category: { id: 1, name: 'Category 1' },
    stock: { "Green": { "S": 12, "M": 8 } },
    getFormattedPrice: (price) => `$${price}`
  },
];

exports.getAllProducts = (pageNo, sort, priceMin, priceMax) => {
  let products = productsDB.filter(p => p.price >= priceMin && p.price <= priceMax);
  return {
    content: products,
    number: pageNo - 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false
  };
};

exports.getProductById = (id) => productsDB.find(p => p.id === parseInt(id));
