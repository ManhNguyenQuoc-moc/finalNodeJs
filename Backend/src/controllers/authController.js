const authService = require("../services/authService");

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
      res.cookie('uid', result.user.id, { httpOnly: true, sameSite: 'lax' });
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
      const code = /Invalid email or password/i.test(err.message) ? 401 : 400;
      res.status(code).json({ message: err.message });
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
      const { userId } = req.body; // hoặc lấy từ req.user nếu có middleware
      const result = await authService.logout(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
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
