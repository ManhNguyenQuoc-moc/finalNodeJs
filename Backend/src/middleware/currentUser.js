// middleware/currentUser.js
const { User } = require("../models"); // hoặc require("../models/User") tùy bạn

module.exports = async function currentUser(req, res, next) {
  try {
    const uid = req.cookies?.uid;
    if (!uid) return next(); // chưa đăng nhập

    const user = await User.findById(uid).lean();
    if (user) {
      req.currentUser = user;
    }

    next();
  } catch (err) {
    console.error("currentUser middleware error:", err);
    next();
  }
};
