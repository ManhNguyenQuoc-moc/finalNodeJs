// Backend/src/services/order.service.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  Order,
  User,
  Address,
  ProductVariant,
  Cart,
  DiscountCode,
} = require("../models");
const sendEmail = require("../utils/email");
const {
  getOrderConfirmEmailHtml,
} = require("../utils/emailCofirmOrderTemplate");

class OrderService {
  async placeOrder({
    userId,
    customerInfo,
    shippingAddress,
    cartItems,
    discountCode,
    cartId,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // --- 1. XỬ LÝ USER (GUEST CHECKOUT) ---
      let finalUserId = userId;
      let isNewAccount = false;
      let tempPassword = "";

      if (!finalUserId) {
        let user = await User.findOne({ email: customerInfo.email }).session(
          session
        );
        if (!user) {
          isNewAccount = true;
          tempPassword = Math.random().toString(36).slice(-8);
          const hash = await bcrypt.hash(tempPassword, 10);

          user = new User({
            email: customerInfo.email,
            full_name: customerInfo.name,
            password_hash: hash,
            role: "customer",
            provider: "local",
            is_verified: true,
            phone: customerInfo.phone,
          });
          await user.save({ session });
        }
        finalUserId = user._id;
      }

      // --- 2. XỬ LÝ ĐỊA CHỈ ---
      const fullAddressString = `${shippingAddress.detail}, ${shippingAddress.ward}, ${shippingAddress.district}, ${shippingAddress.city}`;

      await Address.updateMany(
        { user: finalUserId },
        { is_default: false }
      ).session(session);

      let addressNode = await Address.findOne({
        user: finalUserId,
        city: shippingAddress.city,
        district: shippingAddress.district,
        ward: shippingAddress.ward,
        detail: shippingAddress.detail,
      }).session(session);

      if (addressNode) {
        addressNode.is_default = true;
        addressNode.address_line = fullAddressString;
        await addressNode.save({ session });
      } else {
        addressNode = new Address({
          user: finalUserId,
          city: shippingAddress.city,
          district: shippingAddress.district,
          ward: shippingAddress.ward,
          detail: shippingAddress.detail,
          address_line: fullAddressString,
          is_default: true,
        });
        await addressNode.save({ session });
      }
      const addressId = addressNode._id;

      // --- 3. XỬ LÝ KHO & TÍNH TIỀN ---
      let totalAmount = 0;
      const orderItems = [];

      for (const item of cartItems) {
        const variant = await ProductVariant.findOne({
          sku: item.variant_sku,
        }).session(session);
        if (!variant)
          throw new Error(`Sản phẩm ${item.variant_sku} không tồn tại.`);
        if (variant.stock_quantity < item.quantity)
          throw new Error(`Sản phẩm ${item.name_snapshot} đã hết hàng.`);

        variant.stock_quantity -= item.quantity;
        await variant.save({ session });

        const price = variant.price;
        totalAmount += price * item.quantity;

        orderItems.push({
          product_variant_sku: item.variant_sku,
          quantity: item.quantity,
          price_at_purchase: price,
          product_name_snapshot:
            item.name_snapshot || variant.product.name || "Sản phẩm",
          variant_snapshot: `${item.color_name_snapshot || ""} / ${
            item.size_name_snapshot || ""
          }`,
        });
      }

      // --- 4. MÃ GIẢM GIÁ & ĐIỂM THƯỞNG (FIX LỖI CARTDOC) ---
      let finalAmount = totalAmount;
      let discountId = null;
      let appliedCode = null;
      let pointsUsed = 0;

      // Tìm Cart để lấy thông tin mã và điểm
      const cartDoc = await Cart.findById(cartId).session(session);

      if (cartDoc) {
        // A. Xử lý Mã giảm giá
        appliedCode = cartDoc.applied_coupon;
        if (appliedCode) {
          const codeRecord = await DiscountCode.findOne({
            code: appliedCode,
            is_active: true,
          }).session(session);

          if (
            codeRecord &&
            (!codeRecord.usage_limit ||
              codeRecord.usage_count < codeRecord.usage_limit)
          ) {
            const discountVal = Math.floor(
              (totalAmount * codeRecord.discount_value) / 100
            );
            finalAmount = totalAmount - discountVal;
            if (finalAmount < 0) finalAmount = 0;

            codeRecord.usage_count += 1;
            await codeRecord.save({ session });

            discountId = codeRecord._id;
          }
        }

        // B. Xử lý Điểm thưởng (Loyalty Points)
        if (cartDoc.used_points > 0) {
          const user = await User.findById(finalUserId).session(session);
          const currentPoints = user.loyalty_points || 0;

          // Tính lại điểm cần thiết (tránh trường hợp hack request)
          const maxPointsNeeded = Math.ceil(finalAmount / 1000);
          pointsUsed = Math.min(currentPoints, maxPointsNeeded);

          if (pointsUsed > 0) {
            const pointDiscount = pointsUsed * 1000;
            finalAmount -= pointDiscount;
            if (finalAmount < 0) finalAmount = 0;

            // Trừ điểm thật của user
            user.loyalty_points -= pointsUsed;
            await user.save({ session });
          }
        }
      }

      // --- 5. TÍNH ĐIỂM TÍCH LŨY MỚI ---
      const pointsEarned = Math.floor(finalAmount / 10000);

      // --- 6. TẠO ORDER ---
      const newOrder = new Order({
        user: finalUserId,
        address: addressId,
        discount_code: discountId,
        items: orderItems,
        total_amount: totalAmount,
        final_amount: finalAmount,
        current_status: "pending",
        status_history: [{ status: "pending", timestamp: new Date() }],
        loyalty_points_earned: pointsEarned,
        loyalty_points_used: pointsUsed, // Lưu số điểm đã dùng
      });

      await newOrder.save({ session });

      // --- 7. CỘNG ĐIỂM TÍCH LŨY CHO USER ---
      await User.findByIdAndUpdate(finalUserId, {
        $inc: { loyalty_points: pointsEarned },
      }).session(session);

      // --- 8. XÓA GIỎ HÀNG ---
      if (cartId) {
        await Cart.findByIdAndDelete(cartId).session(session);
      } else {
        await Cart.findOneAndDelete({ user_id: finalUserId }).session(session);
      }

      // === COMMIT ===
      await session.commitTransaction();
      session.endSession();

      // --- 9. GỬI EMAIL ---
      try {
        const emailSubject = `Xác nhận đơn hàng #${newOrder._id} - MixiShop`;
        const emailContent = getOrderConfirmEmailHtml({
          name: customerInfo.name,
          orderId: newOrder._id,
          isNewAccount: isNewAccount,
          email: customerInfo.email,
          tempPassword: tempPassword,
          items: orderItems,
          finalAmount: newOrder.final_amount,
          address: fullAddressString,
        });
        await sendEmail(customerInfo.email, emailSubject, emailContent);
      } catch (e) {
        console.error(e);
      }

      return newOrder;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new OrderService();
