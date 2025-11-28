const authService = require("../services/authService");
const { mergeCartItems } = require("../services/cart.service");
const { Cart } = require("../models");

async function attachGuestCartToUser(req, userId) {
  const sid = req.cookies.sid;
  if (!sid) return; // không có sid thì không có cart guest

  const guestCart = await Cart.findOne({ session_id: sid });
  if (!guestCart) return;

  let userCart = await Cart.findOne({ user_id: userId });

  if (!userCart) {
    guestCart.user_id = userId;
    guestCart.session_id = null;
    await guestCart.save();
  } else {
    mergeCartItems(userCart, guestCart);
    await userCart.save();
    await guestCart.deleteOne(); // xoá cart guest
  }
}
class authController {
  async register(req, res) {
    try {
      const { email, full_name, address_line, phone } = req.body;
      const result = await authService.register(
        email,
        full_name,
        address_line,
        phone
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { token, address } = req.query; // address được encode từ link email
      const result = await authService.verifyEmail(token, address);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async setPassword(req, res) {
    try {
      const { userId, password } = req.body;
      const result = await authService.setPassword(userId, password);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      const userId = result.user.id || result.user._id;
      await attachGuestCartToUser(req, userId);
      // console.log(
      //   ">>> KẾT QUẢ LOGIN SERVICE:",
      //   JSON.stringify(result, null, 2)
      // );
      const cookieOptions = {
        httpOnly: true, // Bảo mật, JS không đọc được
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày (hoặc chỉnh theo thời gian hết hạn của token)
      };
      res.cookie("uid", userId, cookieOptions);
      // Kiểm tra kỹ xem result.tokens có tồn tại không trước khi gán
      if (result.tokens && result.tokens.accessToken) {
        res.cookie("access_token", result.tokens.accessToken, cookieOptions);
      } else {
        console.error(
          ">>> LỖI: Không tìm thấy accessToken trong kết quả trả về!"
        );
      }

      if (result.tokens && result.tokens.refreshToken) {
        res.cookie("refresh_token", result.tokens.refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      return res.json(result);
    } catch (err) {
      const code = /Invalid email or password/i.test(err.message) ? 401 : 400;
      return res.status(code).json({ message: err.message });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      res.json(result); // trả về access token mới
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async logout(req, res) {
    try {
      const userId = req.currentUser?._id || req.cookies?.uid;

      if (userId) {
        await authService.logout(userId); // xoá refresh_token trong DB
      }

      // Xoá hết cookie dùng để auth
      res.clearCookie("uid", {
        httpOnly: true,
        sameSite: "lax",
        // secure: process.env.NODE_ENV === "production",
      });
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");
      req.currentUser = null;
      res.locals.user = null;
      res.locals.loggedInUser = null;

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      return res.json({ ok: true, message: "Logged out" });
    } catch (err) {
      return res.status(500).json({ ok: false, message: "Logout failed" });
    }
  }

  async googleLogin(req, res) {
    try {
      const user = req.user;

      // Sau khi login bằng Google thành công -> cấp accessToken + refreshToken
      const result = await authService.socialLogin(user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async facebookLogin(req, res) {
    try {
      const user = req.user;
      const result = await authService.socialLogin(user); // giống Google
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.generateResetPasswordToken(email);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
  async changePassword(req, res) {
    try {
      // Ưu tiên currentUser nếu sau này bạn có middleware set, fallback sang cookie uid
      const userId = req.currentUser?._id || req.cookies?.uid;

      if (!userId) {
        return res.status(401).json({ message: "Bạn chưa đăng nhập" });
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ mật khẩu" });
      }

      const result = await authService.changePassword(
        userId,
        oldPassword,
        newPassword
      );

      return res.json(result);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
}

module.exports = new authController();
