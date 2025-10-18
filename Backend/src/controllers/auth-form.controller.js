// src/controllers/auth-form.controller.js
const bcrypt = require("bcryptjs");
const { User } = require("../models");

exports.login = async (req, res) => {
  try {
    const email = req.body.username?.trim();
    const password = req.body.password || "";
    const user = await User.findOne({ email }).exec();
    if (!user || !user.password_hash) {
      return res.status(401).json({ ok: false, error: "Email hoặc mật khẩu không đúng!" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Email hoặc mật khẩu không đúng!" });
    res.cookie("uid", user._id.toString(), { httpOnly: true, sameSite: "lax" });
    return res.status(200).json({ ok: true, user: { id: user._id, email: user.email, full_name: user.full_name } });
  } catch {
    return res.status(500).json({ ok: false, error: "Có lỗi khi đăng nhập" });
  }
};

exports.register = async (req, res) => {
  try {
    const name = req.body.register_name?.trim() || "User";
    const email = req.body.register_email?.trim();
    const phone = req.body.register_phone?.trim() || null; // not used but kept
    const address = req.body.register_address?.trim() || null;
    const pw = req.body.register_password || "";
    const confirm = req.body.register_confirmPassword || "";

    if (!email || !pw || pw !== confirm) {
      return res.status(400).json({ ok: false, error: "Thông tin chưa hợp lệ" });
    }
    const existed = await User.findOne({ email }).exec();
    if (existed) return res.status(400).json({ ok: false, error: "Email đã tồn tại" });

    const hash = await bcrypt.hash(pw, 10);
    const u = await User.create({ email, full_name: name, password_hash: hash, role: "customer", is_verified: true });

    if (address) {
      const Address = require("../models/Address");
      await Address.create({ user: u._id, address_line: address, is_default: true });
    }
    return res.status(200).json({ ok: true, message: "Đăng ký thành công" });
  } catch {
    return res.status(500).json({ ok: false, error: "Có lỗi khi đăng ký" });
  }
};

exports.logout = async (_req, res) => {
  res.clearCookie("uid");
  return res.status(200).json({ ok: true });
};
