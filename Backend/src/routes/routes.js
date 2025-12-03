const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "API is working" });
});
// Gắn router con vào router tổng
const addressRouter = require("./address.route"); //import
router.use("/address", addressRouter);
const categoryRouter = require("./category"); //import
router.use("/category", categoryRouter);
const productRouter = require("./product"); //import
router.use("/product", productRouter);
const brandRouter = require("./brand"); //import
router.use("/brand", brandRouter);
const discountCodeRouter = require("./discountCodeRouter");
router.use("/discount-code", discountCodeRouter);
const adminDashboard = require("./adminDashboard");
router.use("/admin-dashboard", adminDashboard);
const aiRouter = require("./aiRouter");
router.use("/ai", aiRouter);
const cartRouter = require("./cart.routes"); //import
router.use("/cart", cartRouter);
// const pageRouter = require("./page.routes");
// router.use("/", pageRouter);
const authRouter = require("./auth"); //import
router.use("/auth", authRouter);
// const userRouter = require("./user");//import
// router.use("/user", userRouter);
const orderRouter = require("./order.route"); //import
router.use("/order", orderRouter);
module.exports = router; //export
const userRouter = require("./users"); //import
router.use("/user", userRouter);
const importRoutes = require("./importRoutes");
router.use("/import", importRoutes);
module.exports = router; //export
