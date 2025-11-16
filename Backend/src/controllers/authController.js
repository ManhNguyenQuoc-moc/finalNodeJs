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
      const { email, full_name, address_line } = req.body;
      const result = await authService.register(email, full_name, address_line);
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
      res.cookie("uid", userId, { httpOnly: true, sameSite: "lax" });
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
        await authService.logout(userId);  // xoá refresh_token trong DB
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
}

module.exports = new authController();
