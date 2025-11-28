// routes/adminDashboard.routes.js
const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardcontroller');

// Nếu có middleware check quyền admin thì thêm ở đây
// const { verifyAdmin } = require('../middlewares/auth');
// Tổng hợp nhanh (có thể gộp tất cả dữ liệu simple vào 1 call)
router.get(
  '/dashboard/simple',
  // verifyAdmin,
  adminDashboardController.getSimpleDashboard
);

// Chỉ lấy KPI tổng quan (cards: người dùng, đơn hàng, doanh thu, lợi nhuận)
router.get(
  '/dashboard/simple/kpis',
  // verifyAdmin,
  adminDashboardController.getSimpleKpis
);

// Biểu đồ Doanh thu & Lợi nhuận theo thời gian
router.get(
  '/dashboard/simple/revenue-profit',
  // verifyAdmin,
  adminDashboardController.getRevenueAndProfitOverTime
);

// Biểu đồ Số đơn hàng theo thời gian
router.get(
  '/dashboard/simple/orders-count',
  // verifyAdmin,
  adminDashboardController.getOrdersCountOverTime
);

// Bảng Sản phẩm bán chạy (Top N)
router.get(
  '/dashboard/simple/top-products',
  // verifyAdmin,
  adminDashboardController.getTopSellingProducts
);
// Tóm tắt nâng cao (orders, revenue, profit, …)
router.get(
  '/dashboard/advanced/summary',
  // verifyAdmin,
  adminDashboardController.getAdvancedSummary
);
// Tổng quan khách hàng (phân khúc, tần suất mua, v.v.)
router.get(
  '/dashboard/advanced/customers',
  // verifyAdmin,
  adminDashboardController.getAdvancedCustomerOverview
);
// Tổng quan đơn hàng (theo trạng thái, kênh bán, v.v.)
router.get(
  '/dashboard/advanced/orders',
  // verifyAdmin,
  adminDashboardController.getAdvancedOrderOverview
);
// So sánh sản phẩm nâng cao
router.get(
  '/dashboard/advanced/product-comparison',
  // verifyAdmin,
  adminDashboardController.getProductComparison
);
module.exports = router;