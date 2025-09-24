// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình storage để lưu file vào uploads/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // lưu file vào /uploads
  },
  filename: function (req, file, cb) {
    // Đặt tên file: timestamp-originalName
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

module.exports = { upload };
