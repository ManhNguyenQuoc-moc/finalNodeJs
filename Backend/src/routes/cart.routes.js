// src/routes/cart.routes.js
const express = require("express");
const ctrl = require("../controllers/cart.controller");

const router = express.Router();

router.post(
  "/add-to-cart",
  express.urlencoded({ extended: true }),
  ctrl.addToCartForm
);
router.post("/api/cart/add", ctrl.addToCartJson);
router.post(
  "/update/:idx",
  express.urlencoded({ extended: true }),
  ctrl.updateItem
);
router.post("/cart/remove/:idx", ctrl.removeItem);
router.post(
  "/shop-cart/submit",
  express.urlencoded({ extended: true }),
  ctrl.submitCheckout
);
router.post(
  "/apply-coupon",
  express.urlencoded({ extended: true }),
  ctrl.applyCoupon
);
router.post("/toggle-points", express.json(), ctrl.togglePoints);
module.exports = router;
