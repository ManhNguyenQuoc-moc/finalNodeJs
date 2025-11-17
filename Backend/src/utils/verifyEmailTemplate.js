const verifyEmailTemplate = ({ full_name, verifyLink }) => `
<div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 10px;">
    <h2 style="color: #333;">Xác thực tài khoản E-Shop</h2>

    <p style="font-size: 16px; color: #555;">
      Xin chào <b>${full_name}</b>,
    </p>

    <p style="font-size: 15px; color: #555;">
      Cảm ơn bạn đã đăng ký tài khoản tại <b>E-Shop</b>.  
      Vui lòng nhấn vào nút bên dưới để xác thực email và kích hoạt tài khoản:
    </p>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${verifyLink}"
         style="display:inline-block; padding: 12px 20px; background: #007bff; color: white; border-radius: 6px; text-decoration: none; font-size: 16px;">
        Xác thực tài khoản
      </a>
    </div>

    <p style="font-size: 14px; color: #777;">
      Link có hiệu lực trong <b>10 phút</b>.  
      Nếu bạn không yêu cầu tạo tài khoản, vui lòng bỏ qua email này.
    </p>

    <p style="margin-top: 40px; font-size: 13px; color: #aaa; text-align: center;">
      © E-Shop 2025
    </p>
  </div>
</div>
`;

module.exports = verifyEmailTemplate;
