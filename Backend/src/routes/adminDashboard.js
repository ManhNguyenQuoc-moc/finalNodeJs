// routes/adminDashboard.routes.js
const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardcontroller');

// Nếu có middleware check quyền admin thì thêm ở đây
// const { verifyAdmin } = require('../middlewares/auth');

// Simple dashboard
router.get(
  '/dashboard/simple',
  // verifyAdmin,
  adminDashboardController.getSimpleDashboard
);

// Advanced summary (orders, revenue, profit)
router.get(
  '/dashboard/advanced/summary',
  // verifyAdmin,
  adminDashboardController.getAdvancedSummary
);

// Advanced product comparison
router.get(
  '/dashboard/advanced/product-comparison',
  // verifyAdmin,
  adminDashboardController.getProductComparison
);

module.exports = router;
