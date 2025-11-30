// src/middleware/currentUser.js
const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function currentUser(req, res, next) {
  const cookies = req.cookies || {};
  const accessToken = cookies.accessToken;
  const uidCookie = cookies.uid;

  let userId = null;

  // 1) Ưu tiên đọc từ accessToken
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
      userId = payload.userId || payload.id || payload._id;
    } catch (err) {
      console.warn("[currentUser] invalid accessToken:", err.message);
    }
  }

  // 2) Nếu chưa có mà vẫn còn uid -> fallback
  if (!userId && uidCookie) {
    userId = uidCookie;
  }

  if (!userId) {
    req.currentUser = null;
    return next();
  }

  try {
    const user = await User.findById(userId).lean();
    req.currentUser = user || null;
  } catch (err) {
    console.error("[currentUser] findById error:", err);
    req.currentUser = null;
  }

  return next();
}

module.exports = currentUser;
