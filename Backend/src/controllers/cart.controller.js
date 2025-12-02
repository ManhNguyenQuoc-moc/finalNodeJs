const {
  getOrCreateCart,
  addItemToCart,
  findVariant,
} = require("../services/cart.service");
const { Order, DiscountCode, Cart, User } = require("../models");

exports.addToCartForm = async (req, res) => {
  try {
    console.log("===== ADD TO CART - BODY =====");
    console.log(req.body);

    const { variant_sku, product_id, size_id, color_id, quantity } =
      req.body || {};

    console.log("===== FIND VARIANT INPUT =====");
    console.log({ variant_sku, product_id, size_id, color_id });

    const variant = await findVariant({
      variant_sku,
      product_id,
      size_id,
      color_id,
    });

    console.log("===== FOUND VARIANT =====");
    console.log(variant);

    if (!variant) throw new Error("Variant not found");

    const cart = await getOrCreateCart(req);

    console.log("===== USING CART =====");
    console.log(cart);

    await addItemToCart({ cart, variant, qty: quantity });

    const cartCount = cart.items.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    );
    const total = cart.items.reduce(
      (sum, it) =>
        sum + Number(it.quantity || 0) * Number(it.price_at_time || 0),
      0
    );

    return res.status(200).json({
      ok: true,
      cartCount,
      total,
      formattedTotal: new Intl.NumberFormat("vi-VN").format(total) + " ₫",
      carts: cart.items,
    });
  } catch (e) {
    console.log("===== ADD TO CART ERROR =====");
    console.log(e);

    return res.status(400).json({
      ok: false,
      message: e.message || "Add to cart failed",
    });
  }
};

exports.addToCartJson = async (req, res) => {
  try {
    const { variant_sku, product_id, size_id, color_id, quantity } =
      req.body || {};
    const variant = await findVariant({
      variant_sku,
      product_id,
      size_id,
      color_id,
    });
    if (!variant) throw new Error("Variant not found");

    const cart = await getOrCreateCart(req);
    await addItemToCart({ cart, variant, qty: quantity });

    const cartCount = cart.items.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0
    );
    const total = cart.items.reduce(
      (sum, it) =>
        sum + Number(it.quantity || 0) * Number(it.price_at_time || 0),
      0
    );

    return res.status(200).json({
      ok: true,
      cartCount,
      total,
      formattedTotal: new Intl.NumberFormat("vi-VN").format(total) + " ₫",
      carts: cart.items,
    });
  } catch (e) {
    return res
      .status(400)
      .json({ ok: false, message: e.message || "Add to cart failed" });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    const qty = Math.max(1, Number(req.body.quantity || 1));
    const where = req.currentUser
      ? { user_id: req.currentUser._id }
      : { session_id: req.cookies.sid };
    const cart = await Cart.findOne(where);
    if (!cart || !cart.items[idx]) return res.status(404).json({ ok: false });
    cart.items[idx].quantity = qty;
    await cart.save();
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    const where = req.currentUser
      ? { user_id: req.currentUser._id }
      : { session_id: req.cookies.sid };
    const cart = await Cart.findOne(where);
    if (!cart || !cart.items[idx]) return res.status(404).json({ ok: false });
    cart.items.splice(idx, 1);
    await cart.save();
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false });
  }
};

exports.submitCheckout = async (req, res) => {
  try {
    if (!req.currentUser)
      return res.status(401).json({ ok: false, message: "Need login" });

    const cart = await Cart.findOne({ user_id: req.currentUser._id });
    if (!cart || !cart.items.length)
      return res.status(400).json({ ok: false, message: "Cart empty" });

    const total = cart.items.reduce(
      (s, it) => s + it.price_at_time * it.quantity,
      0
    );

    const order = await Order.create({
      user: req.currentUser._id,
      items: cart.items.map((it) => ({
        product_variant_sku: it.variant_sku,
        quantity: it.quantity,
        price_at_purchase: it.price_at_time,
      })),
      total_amount: total,
      final_amount: total,
      loyalty_points_used: 0,
      loyalty_points_earned: Math.floor(total / 100000),
      current_status: "pending",
      status_history: [{ status: "pending", timestamp: new Date() }],
    });

    cart.items = [];
    await cart.save();

    return res.status(200).json({ ok: true, order_id: order._id });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const cart = await getOrCreateCart(req);

    if (!code) {
      // Nếu code rỗng -> Hủy mã giảm giá
      cart.applied_coupon = null;
      await cart.save();
      return res.json({
        ok: true,
        message: "Đã hủy mã giảm giá",
        discountAmount: 0,
        finalTotal: total,
        formattedFinalTotal:
          new Intl.NumberFormat("vi-VN").format(total) + " ₫",
      });
    }

    // 1. Kiểm tra mã có hợp lệ không
    const discount = await DiscountCode.findOne({
      code: code.toUpperCase(),
      is_active: true,
    });
    if (!discount) {
      return res
        .status(404)
        .json({ ok: false, message: "Mã giảm giá không tồn tại" });
    }
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      return res
        .status(400)
        .json({ ok: false, message: "Mã đã hết lượt sử dụng" });
    }

    // 2. Lưu mã vào Giỏ hàng
    cart.applied_coupon = discount.code;
    await cart.save();

    // 3. Tính toán lại giá để trả về cho Frontend hiển thị ngay
    const total = cart.items.reduce(
      (sum, it) => sum + it.price_at_time * it.quantity,
      0
    );
    const discountAmount = Math.floor((total * discount.discount_value) / 100);
    const finalTotal = total - discountAmount;

    return res.json({
      ok: true,
      message: `Áp dụng mã ${discount.code} thành công!`,
      discountAmount,
      finalTotal,
      formattedFinalTotal:
        new Intl.NumberFormat("vi-VN").format(finalTotal) + " ₫",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

exports.togglePoints = async (req, res) => {
  try {
    const { usePoints } = req.body; // boolean: true/false
    const cart = await getOrCreateCart(req);
    const userId = req.currentUser ? req.currentUser._id : null;

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: "Vui lòng đăng nhập để dùng điểm" });
    }

    if (!usePoints) {
      // Tắt dùng điểm
      cart.used_points = 0;
      await cart.save();
      return res.json({ ok: true, message: "Đã bỏ dùng điểm", usedPoints: 0 });
    }

    // Bật dùng điểm -> Tính toán xem được dùng bao nhiêu
    const user = await User.findById(userId);
    const userPoints = user.loyalty_points || 0;

    if (userPoints <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "Bạn không có điểm thưởng" });
    }

    // Lưu ý: Số điểm thực tế sẽ được tính lại ở hàm minicart/placeOrder dựa trên tổng tiền
    // Ở đây tạm lưu số điểm tối đa user có, sau này logic tính tiền sẽ cap (cắt) lại nếu vượt quá giá trị đơn
    cart.used_points = userPoints;
    await cart.save();

    return res.json({
      ok: true,
      message: `Đã áp dụng ${userPoints} điểm`,
      usedPoints: userPoints,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
};
