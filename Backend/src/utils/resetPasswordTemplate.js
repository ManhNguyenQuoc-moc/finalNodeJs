const resetPasswordTemplate = ({ full_name, resetLink }) => `
<div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 10px;">
    <h2 style="color: #333;">Đặt lại mật khẩu - E-Shop</h2>

    <p style="font-size: 16px; color: #555;">
      Xin chào <b>${full_name}</b>,
    </p>

    <p style="font-size: 15px; color: #555;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <b>E-Shop</b>.
      Nếu đây là yêu cầu của bạn, vui lòng nhấn nút bên dưới để đặt lại mật khẩu:
    </p>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${resetLink}"
         style="display:inline-block; padding: 12px 20px; background: #28a745; color: white; border-radius: 6px; text-decoration: none; font-size: 16px;">
        Đặt lại mật khẩu
      </a>
    </div>

    <p style="font-size: 14px; color: #777;">
      Link có hiệu lực trong <b>30 phút</b>.  
      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
    </p>

    <p style="margin-top: 40px; font-size: 13px; color: #aaa; text-align: center;">
      © E-Shop 2025
    </p>
  </div>
</div>
`;

module.exports = resetPasswordTemplate;
