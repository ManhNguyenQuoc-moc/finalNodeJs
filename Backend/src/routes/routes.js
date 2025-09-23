const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "API is working" });
});
// Gắn router con vào router tổng
const categoryRouter = require("./category");//import
router.use("/category", categoryRouter);
const productRouter = require("./product");//import
router.use("/product", productRouter);
const brandRouter = require("./brand");//import
router.use("/brand", brandRouter);
module.exports = router;//export

