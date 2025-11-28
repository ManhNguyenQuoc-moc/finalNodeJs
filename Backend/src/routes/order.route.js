const express = require("express");
const router = express.Router();
// Import controller bạn đã tạo ở bước trước
const orderController = require("../controllers/order.controller");

// Định nghĩa API
router.post("/checkout/submit", orderController.submitCheckout);

module.exports = router;
