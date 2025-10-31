// Chạy bằng mongosh trong entrypoint
(function () {
  const dbName = "shop";
  const dbShop = db.getSiblingDB(dbName);

  // Tạo collection (optional) + index quan trọng, khớp với schema bạn dùng
  dbShop.createCollection("users");
  dbShop.createCollection("addresses");
  dbShop.createCollection("brands");
  dbShop.createCollection("categories");
  dbShop.createCollection("discountcodes");
  dbShop.createCollection("productcolors");
  dbShop.createCollection("productsizes");
  dbShop.createCollection("products");
  dbShop.createCollection("productvariants");
  dbShop.createCollection("carts");
  dbShop.createCollection("orders");
  dbShop.createCollection("reviews");
  dbShop.createCollection("wishlists");
  dbShop.createCollection("dashboardlogs");

  // Index theo schema
  dbShop.discountcodes.createIndex({ code: 1 }, { unique: true });
  dbShop.productvariants.createIndex({ sku: 1 }, { unique: true });
  dbShop.carts.createIndex({ user_id: 1 }, { unique: true, sparse: true });
  dbShop.carts.createIndex({ session_id: 1 }, { unique: true, sparse: true });

  print(`[mongo-init] Database '${dbName}' & collections ready.`);
})();
