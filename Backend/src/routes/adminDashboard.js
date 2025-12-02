// routes/adminDashboard.routes.js
const express = require("express");
const router = express.Router();

const adminDashboardController = require("../controllers/adminDashboardcontroller");
const adminOrderController = require("../controllers/adminOrder.controller");

// Nếu có middleware check quyền admin thì thêm ở đây
// const { verifyAdmin } = require('../middlewares/auth');

/* ==========================================
   SIMPLE DASHBOARD
========================================== */

// Tổng quan simple dashboard (users, orders, revenue, profit,…)
router.get("/dashboard/simple", adminDashboardController.getSimpleDashboard);

// KPI cards: người dùng – đơn hàng – doanh thu – lợi nhuận
router.get("/dashboard/simple/kpis", adminDashboardController.getSimpleKpis);

// Biểu đồ doanh thu + lợi nhuận theo thời gian
router.get(
  "/dashboard/simple/revenue-profit",
  adminDashboardController.getRevenueAndProfitOverTime
);

// Biểu đồ số đơn theo thời gian
router.get(
  "/dashboard/simple/orders-count",
  adminDashboardController.getOrdersCountOverTime
);

// Sản phẩm bán chạy (Top N)
router.get(
  "/dashboard/simple/top-products",
  adminDashboardController.getTopSellingProducts
);

/* ==========================================
   ADVANCED DASHBOARD
========================================== */

// Tổng hợp nâng cao theo month/quarter/year
router.get(
  "/dashboard/advanced/summary",
  adminDashboardController.getAdvancedSummary
);

// Tổng quan khách hàng nâng cao
router.get(
  "/dashboard/advanced/customers",
  adminDashboardController.getAdvancedCustomerOverview
);

// Tổng quan đơn hàng nâng cao
router.get(
  "/dashboard/advanced/orders",
  adminDashboardController.getAdvancedOrderOverview
);

// So sánh sản phẩm theo loại / nhóm
router.get(
  "/dashboard/advanced/product-comparison",
  adminDashboardController.getProductComparison
);

// === QUẢN LÝ ĐƠN HÀNG (API MỚI) ===
router.get("/orders", adminOrderController.getList);
router.get("/orders/:id", adminOrderController.getDetail);
router.put("/orders/:id/status", adminOrderController.updateStatus);

module.exports = router;
