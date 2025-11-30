// Backend/src/services/order.service.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Cần chạy: npm install bcryptjs
const {
  Order,
  User,
  Address,
  ProductVariant,
  Cart,
  DiscountCode,
} = require("../models");
const sendEmail = require("../utils/email"); // File cấu hình nodemailer của bạn
const {
  getOrderConfirmEmailHtml,
} = require("../utils/emailCofirmOrderTemplate"); // File template vừa tạo ở trên

class OrderService {
  async placeOrder({
    userId,
    customerInfo, // { name, email, phone }
    shippingAddress, // { city, district, ward, detail }
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
        // Kiểm tra email khách có trong hệ thống chưa
        let user = await User.findOne({ email: customerInfo.email }).session(
          session
        );

        if (!user) {
          // Tạo tài khoản mới cho khách
          isNewAccount = true;
          tempPassword = Math.random().toString(36).slice(-8); // Mật khẩu ngẫu nhiên
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

      // --- 2. XỬ LÝ ĐỊA CHỈ (ADDRESS) ---
      const fullAddressString = `${shippingAddress.detail}, ${shippingAddress.ward}, ${shippingAddress.district}, ${shippingAddress.city}`;

      // [LOGIC MỚI] Kiểm tra xem địa chỉ này đã tồn tại chưa
      let addressNode = await Address.findOne({
        user: finalUserId,
        city: shippingAddress.city,
        district: shippingAddress.district,
        ward: shippingAddress.ward,
        detail: shippingAddress.detail,
      }).session(session);

      if (addressNode) {
        // NẾU ĐÃ CÓ: Cập nhật lại là mặc định (để lần sau ưu tiên lấy nó)
        // (Optional: Nếu muốn reset các cái khác không phải mặc định thì cần logic phức tạp hơn,
        // nhưng ở đây ta chỉ cần đảm bảo cái này được đánh dấu true)
        addressNode.is_default = true;
        await addressNode.save({ session });
      } else {
        // NẾU CHƯA CÓ: Tạo mới
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

      // Lưu ý: Lúc này biến addressNode chứa địa chỉ (cũ hoặc mới), ta dùng ID của nó
      const addressId = addressNode._id;

      // --- 3. XỬ LÝ KHO & TÍNH TIỀN ---
      let totalAmount = 0;
      const orderItems = [];

      for (const item of cartItems) {
        // Lấy Variant từ DB để check giá và kho
        const variant = await ProductVariant.findOne({
          sku: item.variant_sku,
        }).session(session);

        if (!variant)
          throw new Error(`Sản phẩm mã ${item.variant_sku} không tồn tại.`);
        if (variant.stock_quantity < item.quantity) {
          throw new Error(`Sản phẩm ${item.name_snapshot} đã hết hàng.`);
        }

        // Trừ tồn kho
        variant.stock_quantity -= item.quantity;
        await variant.save({ session });

        const price = variant.price;
        totalAmount += price * item.quantity;

        orderItems.push({
          product_variant_sku: item.variant_sku,
          quantity: item.quantity,
          price_at_purchase: price,
          // Lưu snapshot tên để hiển thị email/lịch sử cho đẹp
          product_name_snapshot: item.name_snapshot,
          variant_snapshot: `${item.color_name_snapshot || ""} / ${
            item.size_name_snapshot || ""
          }`,
        });
      }

      // --- 4. MÃ GIẢM GIÁ ---
      let finalAmount = totalAmount;
      let discountId = null;
      if (discountCode) {
        const codeRecord = await DiscountCode.findOne({
          code: discountCode,
          is_active: true,
        }).session(session);
        if (codeRecord && codeRecord.usage_count < codeRecord.usage_limit) {
          finalAmount -= codeRecord.discount_value;
          if (finalAmount < 0) finalAmount = 0;

          codeRecord.usage_count += 1;
          await codeRecord.save({ session });
          discountId = codeRecord._id;
        }
      }

      // --- 5. TẠO ORDER ---
      const newOrder = new Order({
        user: finalUserId,
        address: addressId,
        discount_code: discountId,
        items: orderItems,
        total_amount: totalAmount,
        final_amount: finalAmount,
        current_status: "pending",
        status_history: [{ status: "pending", timestamp: new Date() }],
        loyalty_points_earned: Math.floor(finalAmount / 100000), // 100k = 1 điểm
      });

      await newOrder.save({ session });

      // --- 6. CẬP NHẬT ĐIỂM CHO USER ---
      await User.findByIdAndUpdate(finalUserId, {
        $inc: { loyalty_points: newOrder.loyalty_points_earned },
      }).session(session);

      // --- 7. XÓA GIỎ HÀNG ---
      if (cartId) {
        await Cart.findByIdAndDelete(cartId).session(session);
      } else {
        // Fallback: Nếu không có cartId thì tìm theo user_id (như cũ)
        await Cart.findOneAndUpdate(
          { user_id: finalUserId },
          { items: [] }
        ).session(session);
      }

      // === COMMIT TRANSACTION ===
      await session.commitTransaction();
      session.endSession();

      // --- 8. GỬI EMAIL (Sau khi commit thành công) ---
      try {
        const emailSubject = `Xác nhận đơn hàng #${newOrder._id} - MixiShop`;

        // Lấy HTML từ file template
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
        console.log(`Email xác nhận đã gửi tới: ${customerInfo.email}`);
      } catch (emailError) {
        console.error(
          "Gửi email thất bại (nhưng đơn hàng đã thành công):",
          emailError
        );
      }

      return newOrder;
    } catch (error) {
      // Nếu có lỗi -> Rollback toàn bộ
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new OrderService();
