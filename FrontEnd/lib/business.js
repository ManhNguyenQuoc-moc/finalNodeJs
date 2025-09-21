// lib/business.js
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const DiscountCode = require("../models/DiscountCode");
const User = require("../models/User");

// Tính điểm loyalty earn = 10% tổng tiền (làm tròn xuống)
function calcEarnPoints(total) {
  return Math.floor(total * 0.10);
}

// Áp mã giảm giá: trả về {discountValue, codeUsed}
async function applyDiscount(code, subtotal, session) {
  if (!code) return { discountValue: 0, codeUsed: null };
  const doc = await DiscountCode.findOne({ code: code.toUpperCase() }).session(session);
  if (!doc) return { discountValue: 0, codeUsed: null };
  if (doc.usage_limit > 0 && doc.usage_count >= doc.usage_limit) return { discountValue: 0, codeUsed: null };
  // Ví dụ đơn giản: giảm cố định 5% (tuỳ đề có thể yêu cầu % hay cố định)
  const discountValue = Math.round(subtotal * 0.05);
  // Không tăng usage ở đây; tăng sau khi đơn đặt thành công
  return { discountValue, codeUsed: doc.code };
}

// Tạo order từ cart: trừ tồn kho an toàn bằng transaction
async function checkoutFromCart({ userId, usePoints = 0, discountCode = null }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cart = await Cart.findOne({ user_id: userId }).session(session);
    if (!cart || cart.items.length === 0) throw new Error("Cart is empty");

    // Kiểm tra & trừ kho cho từng item
    for (const it of cart.items) {
      const res = await Product.updateOne(
        { _id: it.product_id, "variants.sku": it.variant_sku, "variants.stock_quantity": { $gte: it.quantity } },
        { $inc: { "variants.$.stock_quantity": -it.quantity } },
        { session }
      );
      if (res.matchedCount === 0) throw new Error("Out of stock for SKU " + it.variant_sku);
    }

    // Tính subtotal
    const subtotal = cart.items.reduce((s, it) => s + it.price_at_time * it.quantity, 0);

    // Áp mã giảm giá (theo đề: mã hợp lệ phải hiển thị ngay; limit ≤ 10)
    const { discountValue, codeUsed } = await applyDiscount(discountCode, subtotal, session);

    // Dùng loyalty points (theo đề: dùng được ở đơn kế tiếp)
    const user = await User.findById(userId).session(session);
    const pointsToUse = Math.min(usePoints || 0, user?.loyalty_points || 0);
    const afterDiscount = Math.max(subtotal - discountValue - pointsToUse, 0);

    // Tính điểm earn 10% sau khi trừ discount + points (tuỳ cách hiểu đề, có thể tính trên subtotal trước discount)
    const pointsEarned = calcEarnPoints(afterDiscount);

    // Tạo order (snapshot)
    const order = await Order.create([{
      user_id: userId,
      order_items: cart.items.map(it => ({
        product_id: it.product_id,
        name_snapshot: it.name_snapshot,
        variant_sku: it.variant_sku,
        unit_price: it.price_at_time,
        quantity: it.quantity
      })),
      discount_code: codeUsed,
      discount_value: discountValue,
      loyalty_points_earned: pointsEarned,
      loyalty_points_spent: pointsToUse,
      total_amount: afterDiscount,
      status: "paid",
      status_history: [{ status: "paid", timestamp: new Date() }]
    }], { session });

    // Tăng usage discount nếu có
    if (codeUsed) {
      await DiscountCode.updateOne(
        { code: codeUsed },
        { $inc: { usage_count: 1 } },
        { session }
      );
    }

    // Cập nhật loyalty user
    if (user) {
      await User.updateOne(
        { _id: userId },
        { $inc: { loyalty_points: pointsEarned - pointsToUse } },
        { session }
      );
    }

    // Xoá cart
    await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });

    await session.commitTransaction();
    session.endSession();
    return order[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = { checkoutFromCart };
