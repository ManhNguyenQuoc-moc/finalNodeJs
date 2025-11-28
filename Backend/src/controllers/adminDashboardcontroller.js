// controllers/adminDashboard.controller.js

const dashboardService = require('../services/dashboardService');

/* ================================
   Helper: parse time-based params
================================= */
function parseTimeParams(query) {
  return {
    granularity: query.granularity || 'month', // default month cho dashboard
    year: query.year ? parseInt(query.year, 10) : undefined,
    quarter: query.quarter ? parseInt(query.quarter, 10) : undefined,
    month: query.month ? parseInt(query.month, 10) : undefined,
    week: query.week ? parseInt(query.week, 10) : undefined,
    startDate: query.startDate,
    endDate: query.endDate
  };
}

/* ================================
   SIMPLE DASHBOARD CONTROLLERS
================================= */

// Gộp toàn bộ dữ liệu Simple Dashboard
exports.getSimpleDashboard = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getSimpleDashboard(params);
    res.json(data);
  } catch (error) {
    console.error('Error getSimpleDashboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// KPI: Người dùng – Đơn hàng – Doanh thu – Lợi nhuận
exports.getSimpleKpis = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getSimpleKpis(params);
    res.json(data);
  } catch (error) {
    console.error('Error getSimpleKpis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Biểu đồ doanh thu + lợi nhuận
exports.getRevenueAndProfitOverTime = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getRevenueAndProfitOverTime(params);
    res.json(data);
  } catch (error) {
    console.error('Error getRevenueAndProfitOverTime:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Biểu đồ số lượng đơn theo thời gian
exports.getOrdersCountOverTime = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getOrdersCountOverTime(params);
    res.json(data);
  } catch (error) {
    console.error('Error getOrdersCountOverTime:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Sản phẩm bán chạy
exports.getTopSellingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const params = parseTimeParams(req.query);

    const data = await dashboardService.getTopSellingProducts(params, limit);
    res.json(data);
  } catch (error) {
    console.error('Error getTopSellingProducts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


/* ================================
   ADVANCED DASHBOARD CONTROLLERS
================================= */

exports.getAdvancedSummary = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getAdvancedSummary(params);
    res.json(data);
  } catch (error) {
    console.error('Error getAdvancedSummary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Tổng quan khách hàng nâng cao
exports.getAdvancedCustomerOverview = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getAdvancedCustomerOverview(params);
    res.json(data);
  } catch (error) {
    console.error('Error getAdvancedCustomerOverview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Tổng quan đơn hàng nâng cao
exports.getAdvancedOrderOverview = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getAdvancedOrderOverview(params);
    res.json(data);
  } catch (error) {
    console.error('Error getAdvancedOrderOverview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// So sánh sản phẩm nâng cao
exports.getProductComparison = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getProductComparison(params);
    res.json(data);
  } catch (error) {
    console.error('Error getProductComparison:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
