// src/routes/page.routes.js
const express = require("express");
const ctrl = require("../controllers/page.controller");

const router = express.Router();

// test/health
router.get("/", ctrl.health);

// header data
router.get("/api/page/categories", ctrl.categories);
router.get("/api/page/minicart", ctrl.minicart);

// home/category/search
router.get("/api/page/home", ctrl.home);
router.get("/api/page/category/alls", ctrl.categoryAll);
router.get("/api/page/category/:id", ctrl.categoryById);
router.get("/api/page/search", ctrl.search);

// --- Account pages JSON ---
router.get("/api/page/account/profile",    ctrl.accountProfile);
router.get("/api/page/account/addresses",  ctrl.accountAddresses);
router.get("/api/page/account/orders",     ctrl.accountOrders);
router.get("/api/page/account/orders/filter", ctrl.accountOrdersFilter);
router.get("/api/page/orders/:id/details", ctrl.orderDetails);
router.get("/api/page/account/vouchers",   ctrl.accountVouchers);
router.get("/api/page/account/points",     ctrl.accountPoints);

// product detail
router.get("/api/page/product/:id", ctrl.productDetail);

module.exports = router;
