// src/middleware/uploadMiddleware.js
const multer = require("multer");

const storage = multer.memoryStorage(); // file nằm trong memory
const upload = multer({ storage });

module.exports = { upload };
