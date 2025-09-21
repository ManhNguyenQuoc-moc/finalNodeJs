// utils/token.js
const jwt = require("jsonwebtoken");

const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null; // hoặc throw error tùy cách bạn muốn xử lý
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
