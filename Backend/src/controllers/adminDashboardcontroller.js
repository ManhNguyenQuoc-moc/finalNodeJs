// controllers/adminDashboard.controller.js
const dashboardService = require("../services/dashboardService");

/* ================================
   Helper: parse time-based params
================================= */
function parseTimeParams(query) {
  return {
    granularity: query.granularity || "month", // default: theo tháng
    year: query.year ? parseInt(query.year, 10) : undefined,
    quarter: query.quarter ? parseInt(query.quarter, 10) : undefined,
    month: query.month ? parseInt(query.month, 10) : undefined,
    week: query.week ? parseInt(query.week, 10) : undefined,
    startDate: query.startDate,
    endDate: query.endDate,
  };
}

// (hiện tại chưa dùng, nhưng giữ lại nếu sau này cần)
function parseRange(req) {
  const { startDate, endDate, granularity } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  return {
    startDate: startDate || today,
    endDate: endDate || today,
    granularity: granularity || "month",
  };
}

function handleError(res, label, error) {
  console.error(`Error ${label}:`, error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? String(error) : undefined,
  });
}

/* ================================
   Helper: normalize Advanced Summary
   -> fill đủ bucket theo granularity
================================= */

function safeParseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

// rows: [{ timeKey, ordersCount, totalRevenue, totalProfit, ... }]
function buildMonthlyBuckets(year, rows) {
  const map = new Map();

  rows.forEach((r) => {
    const d = safeParseDate(r.timeKey);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, r);
  });

  const data = [];
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const found = map.get(key);

    data.push({
      timeKey: key,
      label: `${m + 1}/${year}`,
      ordersCount: found?.ordersCount || 0,
      totalRevenue: found?.totalRevenue || 0,
      totalProfit: found?.totalProfit || 0,
    });
  }

  return data;
}

// tuần: chia 1 tháng thành 4 block gần bằng nhau
function buildWeeklyBuckets(year, monthIndex, rows) {
  // monthIndex: 0-11
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const bucketSize = Math.ceil(daysInMonth / 4);

  // map date -> row
  const map = new Map();
  rows.forEach((r) => {
    const d = safeParseDate(r.timeKey);
    if (!d) return;
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    map.set(key, r);
  });

  const data = [];

  for (let w = 0; w < 4; w++) {
    const startDay = w * bucketSize + 1;
    const endDay = Math.min((w + 1) * bucketSize, daysInMonth);
    if (startDay > daysInMonth) break;

    let ordersCount = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    for (let d = startDay; d <= endDay; d++) {
      const dateObj = new Date(year, monthIndex, d);
      const key = dateObj.toISOString().slice(0, 10);
      const row = map.get(key);
      if (row) {
        ordersCount += row.ordersCount || 0;
        totalRevenue += row.totalRevenue || 0;
        totalProfit += row.totalProfit || 0;
      }
    }

    data.push({
      timeKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}-W${w + 1}`,
      label: `Tuần ${w + 1}`,
      ordersCount,
      totalRevenue,
      totalProfit,
    });
  }

  return data;
}

function buildYearlyBuckets(startYear, endYear, rows) {
  const map = new Map();
  rows.forEach((r) => {
    const d = safeParseDate(r.timeKey);
    if (!d) return;
    const year = String(d.getFullYear());
    map.set(year, r);
  });

  const data = [];
  for (let y = startYear; y <= endYear; y++) {
    const key = String(y);
    const found = map.get(key);

    data.push({
      timeKey: key,
      label: key,
      ordersCount: found?.ordersCount || 0,
      totalRevenue: found?.totalRevenue || 0,
      totalProfit: found?.totalProfit || 0,
    });
  }

  return data;
}

function normalizeAdvancedSummary(params, raw) {
  const granularity = params.granularity || raw?.granularity || "month";

  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : [];

  if (!rows.length) {
    return {
      granularity,
      data: [],
    };
  }

  const now = new Date();

  if (granularity === "month") {
    // Ưu tiên: params.year -> startDate -> timeKey -> năm hiện tại
    const year =
      params.year ||
      (safeParseDate(params.startDate)?.getFullYear()) ||
      (safeParseDate(rows[0].timeKey)?.getFullYear()) ||
      now.getFullYear();

    return {
      granularity: "month",
      data: buildMonthlyBuckets(year, rows),
    };
  }

  if (granularity === "week") {
    // Lấy base date từ params hoặc data
    let base =
      (params.year && params.month
        ? new Date(params.year, params.month - 1, 1)
        : null) ||
      safeParseDate(params.startDate) ||
      safeParseDate(rows[0].timeKey) ||
      now;

    const year = base.getFullYear();
    const monthIndex = base.getMonth(); // 0-11

    return {
      granularity: "week",
      data: buildWeeklyBuckets(year, monthIndex, rows),
    };
  }

  if (granularity === "year") {
    // endYear ưu tiên: params.year -> endDate -> row cuối -> năm hiện tại
    const endYear =
      params.year ||
      (safeParseDate(params.endDate)?.getFullYear()) ||
      (safeParseDate(rows[rows.length - 1].timeKey)?.getFullYear()) ||
      now.getFullYear();

    const startYear = endYear - 3; // 4 năm: startYear..endYear

    return {
      granularity: "year",
      data: buildYearlyBuckets(startYear, endYear, rows),
    };
  }

  // Các kiểu khác (quarter,...) tạm thời trả nguyên service
  return {
    granularity,
    data: rows,
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

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, "getSimpleDashboard", error);
  }
};

// KPI: Người dùng – Đơn hàng – Doanh thu – Lợi nhuận
exports.getSimpleKpis = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getSimpleKpis(params);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, "getSimpleKpis", error);
  }
};

// Biểu đồ doanh thu + lợi nhuận theo thời gian
exports.getRevenueAndProfitOverTime = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const result = await dashboardService.getRevenueAndProfitOverTime(params);

    // FE mong: { data: [{ label, revenue, profit }, ...] }
    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    return handleError(res, "getRevenueAndProfitOverTime", error);
  }
};

// Biểu đồ số lượng đơn theo thời gian
exports.getOrdersCountOverTime = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const result = await dashboardService.getOrdersCountOverTime(params);

    const series = Array.isArray(result)
      ? result
      : Array.isArray(result?.data)
        ? result.data
        : [];

    return res.json({
      success: true,
      data: series, // [{ label, ordersCount }]
    });
  } catch (error) {
    return handleError(res, "getOrdersCountOverTime", error);
  }
};

// Sản phẩm bán chạy (Top products)
exports.getTopSellingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const params = parseTimeParams(req.query);

    const result = await dashboardService.getTopSellingProducts(params, limit);

    // Service có thể trả:
    // 1) mảng items
    // 2) { items: [...], startDate, endDate, limit }
    const items = Array.isArray(result)
      ? result
      : Array.isArray(result?.items)
        ? result.items
        : [];

    return res.json({
      success: true,
      items, // FE đọc trực tiếp tpResp.items
    });
  } catch (error) {
    return handleError(res, "getTopSellingProducts", error);
  }
};

/* ================================
   ADVANCED DASHBOARD CONTROLLERS
================================= */

exports.getAdvancedSummary = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const raw = await dashboardService.getAdvancedSummary(params);

    const normalized = normalizeAdvancedSummary(params, raw);

    return res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    return handleError(res, "getAdvancedSummary", error);
  }
};

// Tổng quan khách hàng nâng cao
exports.getAdvancedCustomerOverview = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getAdvancedCustomerOverview(params);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, "getAdvancedCustomerOverview", error);
  }
};

// Tổng quan đơn hàng nâng cao
exports.getAdvancedOrderOverview = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getAdvancedOrderOverview(params);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, "getAdvancedOrderOverview", error);
  }
};

// So sánh sản phẩm nâng cao
exports.getProductComparison = async (req, res) => {
  try {
    const params = parseTimeParams(req.query);
    const data = await dashboardService.getProductComparison(params);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, "getProductComparison", error);
  }
};
