const getOrderConfirmEmailHtml = ({
  name,
  orderId,
  isNewAccount,
  email,
  tempPassword,
  items,
  finalAmount,
  address,
}) => {
  // 1. Xử lý danh sách sản phẩm thành HTML
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                ${item.product_name_snapshot} <br> 
                <small>${item.variant_snapshot}</small>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
              item.quantity
            }</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                ${item.price_at_purchase.toLocaleString("vi-VN")}₫
            </td>
        </tr>
    `
    )
    .join(""); // Quan trọng: Phải join lại thành chuỗi

  // 2. Xử lý phần thông báo tài khoản mới
  const newAccountHtml = isNewAccount
    ? `
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #d9534f; margin: 20px 0;">
            <p style="margin: 0;"><strong>Thông báo quan trọng:</strong></p>
            <p style="margin: 5px 0;">Chúng tôi đã tạo tài khoản cho bạn để theo dõi đơn hàng.</p>
            <p style="margin: 5px 0;">Email: <strong>${email}</strong></p>
            <p style="margin: 5px 0;">Mật khẩu: <strong>${tempPassword}</strong></p>
            <p style="margin: 5px 0;"><small>(Vui lòng đăng nhập và đổi mật khẩu ngay)</small></p>
        </div>
    `
    : "";

  // 3. Trả về HTML tổng thể
  return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d9534f;">Cảm ơn bạn đã đặt hàng tại MixiShop!</h2>
            <p>Xin chào <strong>${name}</strong>,</p>
            <p>Đơn hàng <strong>#${orderId}</strong> của bạn đã được đặt thành công.</p>
            
            ${newAccountHtml}

            <h3>Chi tiết đơn hàng:</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px; text-align: left;">Sản phẩm</th>
                        <th style="padding: 8px; text-align: left;">SL</th>
                        <th style="padding: 8px; text-align: left;">Giá</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <p style="text-align: right; margin-top: 20px;">
                <strong>Tổng tiền: ${finalAmount.toLocaleString(
                  "vi-VN"
                )}₫</strong>
            </p>
            
            <p>Địa chỉ giao hàng: ${address}</p>
            <hr>
            <p style="font-size: 12px; color: #777;">Đây là email tự động, vui lòng không trả lời.</p>
        </div>
    `;
};

module.exports = { getOrderConfirmEmailHtml };
