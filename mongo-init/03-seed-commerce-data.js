(function () {
  const dbShop = db.getSiblingDB("shop");
  const now = new Date();

  // Lấy vài reference nhanh
  const user = dbShop.users.findOne({ email: "alice@example.com" });
  const addr = dbShop.addresses.findOne({ user: user._id });
  const v1   = dbShop.productvariants.findOne({ sku: "AIRZOOM-BLK-M" });
  const v2   = dbShop.productvariants.findOne({ sku: "AIRZOOM-RED-L" });
  const v3   = dbShop.productvariants.findOne({ sku: "TEE-BLK-M" });
  const p1   = dbShop.products.findOne({ _id: v1.product });
  const p2   = dbShop.products.findOne({ _id: v3.product });
  const disc = dbShop.discountcodes.findOne({ code: "WELCOME10" });

  // ====== CART (snapshot fields giống schema của bạn) ======
  dbShop.carts.insertOne({
    user_id: user._id,
    session_id: null,
    items: [
      {
        product_id: p1._id,
        variant_sku: v1.sku,
        name_snapshot: p1.name,
        price_at_time: v1.price,
        quantity: 1,
        color_name_snapshot: dbShop.productcolors.findOne({ _id: v1.color })?.color_name ?? null,
        size_name_snapshot:  dbShop.productsizes.findOne({ _id: v1.size })?.size_name ?? null,
        img_snapshot: null,
        color_id_snapshot: v1.color || null,
        size_id_snapshot: v1.size || null
      }
    ],
    createdAt: now,
    updated_at: now
  });

  // ====== ORDER ======
  const orderId = new ObjectId();
  const total = v1.price * 1 + v3.price * 2;
  const final = total - 10; // giả sử áp mã giảm 10

  dbShop.orders.insertOne({
    _id: orderId,
    user: user._id,
    address: addr._id,
    discount_code: disc._id,
    items: [
      { product_variant_sku: v1.sku, quantity: 1, price_at_purchase: v1.price },
      { product_variant_sku: v3.sku, quantity: 2, price_at_purchase: v3.price },
    ],
    total_amount: total,
    final_amount: final,
    loyalty_points_used: 0,
    loyalty_points_earned: 15,
    current_status: "confirmed",
    status_history: [
      { status: "pending",   timestamp: new Date(now.getTime() - 3600*1000) },
      { status: "confirmed", timestamp: now }
    ],
    createdAt: now, updatedAt: now
  });

  // ====== REVIEWS ======
  dbShop.reviews.insertMany([
    {
      product: p1._id,
      user: user._id,
      comment: "Giày chạy êm, đáng tiền!",
      rating: 5,
      createdAt: now, updatedAt: now
    },
    {
      product: p2._id,
      user: null,
      guest_name: "Guest",
      guest_email: "guest@example.com",
      comment: "Áo vải ổn, form chuẩn.",
      // rating null vì guest -> đúng rule bạn đặt
      createdAt: now, updatedAt: now
    }
  ]);

  // ====== WISHLIST ======
  dbShop.wishlists.insertOne({
    user: user._id,
    product_variant_sku: v2.sku,
    createdAt: now, updatedAt: now
  });

  // ====== DASHBOARD LOGS ======
  dbShop.dashboardlogs.insertOne({
    date: now,
    orders_count: 1,
    revenue: final,
    profit: Math.round(final * 0.25),
    best_selling_products: [
      { product: p1._id, total_sold: 1, revenue: v1.price },
      { product: p2._id, total_sold: 2, revenue: v3.price * 2 },
    ],
    createdAt: now, updatedAt: now
  });

  print("[mongo-init] Seeded commerce objects (cart, order, reviews, wishlist, dashboard logs).");
})();
