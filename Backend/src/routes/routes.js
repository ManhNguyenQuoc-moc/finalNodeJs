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
const discountCodeRouter = require("./discountCodeRouter");
router.use("/discount-code", discountCodeRouter);
// const pageRouter = require("./page.routes");
// router.use("/", pageRouter);
// const authRouter = require("./auth");//import
// router.use("/auth", authRouter);
// const userRouter = require("./user");//import
// router.use("/user", userRouter);
module.exports = router;//export

