const authService = require("../services/authService");
const { mergeCartItems } = require("../services/cart.service");
const { Cart } = require("../models");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
async function attachGuestCartToUser(req, userId) {
  const sid = req.cookies?.sid;        // an toàn hơn: có thể undefined
  if (!sid) return;                    // không có sid thì coi như không có guest cart

  // Lấy cả hai cart cùng lúc
  const [guestCart, userCart] = await Promise.all([
    Cart.findOne({ session_id: sid }),
    Cart.findOne({ user_id: userId }),
  ]);

  if (!guestCart) return;              // không có cart guest thì thôi

  if (!userCart) {
    // CASE 1: user chưa có cart -> chuyển luôn guestCart thành cart của user
    guestCart.user_id = userId;
    guestCart.session_id = undefined;  // KHÔNG set null, để mongoose unset field
    await guestCart.save();
  } else {
    // CASE 2: user đã có cart -> merge items từ guest vào userCart
    mergeCartItems(userCart, guestCart); // chỉ thao tác trên object
    await userCart.save();               // lưu cart của user
    await guestCart.deleteOne();         // xoá cart guest sau khi merge
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
      const accessToken = result.accessToken;      // tuỳ bạn trả về từ authService
      const refreshToken = result.refreshToken;    // nếu có

      // 1) merge cart guest -> user
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

      // 2) set cookie UID (phục vụ currentUser, cart...)
      res.cookie("uid", userId, {
        httpOnly: true,
        sameSite: "lax",
        // secure: process.env.NODE_ENV === "production",
      });

      // 3) set accessToken (auth chính)
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        // secure: process.env.NODE_ENV === "production",
      });
      // 4) nếu dùng refreshToken:
      if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
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
      res.clearCookie("uid", {
        httpOnly: true,
        sameSite: "lax",
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
      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=google_no_user`);
      }

      const result = await authService.socialLogin(user);

      const userId = result.user.id || result.user._id;
      const accessToken = result.tokens?.accessToken;
      const refreshToken = result.tokens?.refreshToken;

      await attachGuestCartToUser(req, userId);

      const cookieOptions = {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      };

      res.cookie("uid", userId, cookieOptions);

      if (result.tokens?.accessToken) {
        res.cookie("access_token", result.tokens.accessToken, cookieOptions);
      }
      if (result.tokens?.refreshToken) {
        res.cookie("refresh_token", result.tokens.refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      if (accessToken) {
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }
      if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }

      const role = user.role || result.user.role;
      if (role === "admin") {
        return res.redirect(`${FRONTEND_URL}/admin`);
      }

      return res.redirect(`${FRONTEND_URL}/home`);
    } catch (err) {
      console.error("Google login error:", err);
      return res.redirect(
        `${FRONTEND_URL}/login?error=google_login_failed`
      );
    }
  }

  async facebookLogin(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect("/login?error=facebook_no_user");
      }

      const result = await authService.socialLogin(user);

      const userId = result.user.id || result.user._id;
      const accessToken = result.tokens?.accessToken;
      const refreshToken = result.tokens?.refreshToken;

      // 1) merge cart guest -> user
      await attachGuestCartToUser(req, userId);

      // 2) set cookie giống google/login
      const cookieOptions = {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      };

      res.cookie("uid", userId, cookieOptions);

      if (result.tokens?.accessToken) {
        res.cookie("access_token", result.tokens.accessToken, cookieOptions);
      }
      if (result.tokens?.refreshToken) {
        res.cookie("refresh_token", result.tokens.refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
      });
      if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
        });
      }

      const role = user.role || result.user.role;
      if (role === "admin") {
        return res.redirect("http://localhost:3000/admin");
      }
      return res.redirect("http://localhost:3000/home");
    } catch (err) {
      console.error("Facebook login error:", err);
      return res.redirect("/login?error=facebook_login_failed");
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
