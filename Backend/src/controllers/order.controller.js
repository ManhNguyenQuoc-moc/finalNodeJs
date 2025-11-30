// Backend/src/controllers/order.controller.js
const orderService = require("../services/order.service");
const { Cart } = require("../models");

exports.submitCheckout = async (req, res) => {
  try {
    console.log("===== SUBMIT CHECKOUT =====");

    // 1. Lấy dữ liệu từ Frontend
    const {
      name,
      email,
      phone,
      address, // Số nhà, đường
      province,
      district,
      ward, // Tên Tỉnh, Huyện, Xã
      discountCode,
    } = req.body;

    // 2. Xác định giỏ hàng (User Login hoặc Khách vãng lai qua Cookie)
    const cartQuery = req.currentUser
      ? { user_id: req.currentUser._id }
      : { session_id: req.cookies.sid };

    const cart = await Cart.findOne(cartQuery);

    // Validate giỏ hàng
    if (!cart || !cart.items || cart.items.length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "Giỏ hàng của bạn đang trống!" });
    }

    // 3. Gọi Service
    const order = await orderService.placeOrder({
      userId: req.currentUser ? req.currentUser._id : null,
      customerInfo: { name, email, phone },
      shippingAddress: {
        detail: address,
        city: province,
        district: district,
        ward: ward,
      },
      cartItems: cart.items,
      discountCode: discountCode,
      cartId: cart._id,
    });

    // 4. Trả về kết quả
    return res.status(200).json({
      ok: true,
      orderId: order._id,
      message: "Đặt hàng thành công!",
    });
  } catch (error) {
    console.error("Checkout Error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Lỗi hệ thống khi xử lý thanh toán.",
    });
  }
};
