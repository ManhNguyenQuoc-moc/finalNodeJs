const { getOrCreateCart, addItemToCart, findVariant } = require("../services/cart.service");
const { Order, DiscountCode, Cart } = require("../models");

exports.addToCartForm = async (req, res) => {
  try {
    console.log("===== ADD TO CART - BODY =====");
    console.log(req.body);

    const { variant_sku, product_id, size_id, color_id, quantity } = req.body || {};

    console.log("===== FIND VARIANT INPUT =====");
    console.log({ variant_sku, product_id, size_id, color_id });

    const variant = await findVariant({ variant_sku, product_id, size_id, color_id });

    console.log("===== FOUND VARIANT =====");
    console.log(variant);

    if (!variant) throw new Error("Variant not found");

    const cart = await getOrCreateCart(req);

    console.log("===== USING CART =====");
    console.log(cart);

    await addItemToCart({ cart, variant, qty: quantity });

    const cartCount = cart.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const total = cart.items.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.price_at_time || 0),
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
      message: e.message || "Add to cart failed"
    });
  }
};

exports.addToCartJson = async (req, res) => {
  try {
    const { variant_sku, product_id, size_id, color_id, quantity } = req.body || {};
    const variant = await findVariant({ variant_sku, product_id, size_id, color_id });
    if (!variant) throw new Error("Variant not found");

    const cart = await getOrCreateCart(req);
    await addItemToCart({ cart, variant, qty: quantity });

    const cartCount = cart.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const total = cart.items.reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.price_at_time || 0),
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
    return res.status(400).json({ ok: false, message: e.message || "Add to cart failed" });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const idx = Number(req.params.idx);
    const qty = Math.max(1, Number(req.body.quantity || 1));
    const where = req.currentUser ? { user_id: req.currentUser._id } : { session_id: req.cookies.sid };
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
    const where = req.currentUser ? { user_id: req.currentUser._id } : { session_id: req.cookies.sid };
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
    if (!req.currentUser) return res.status(401).json({ ok: false, message: "Need login" });

    const cart = await Cart.findOne({ user_id: req.currentUser._id });
    if (!cart || !cart.items.length) return res.status(400).json({ ok: false, message: "Cart empty" });

    const total = cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0);

    const order = await Order.create({
      user: req.currentUser._id,
      items: cart.items.map(it => ({
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
