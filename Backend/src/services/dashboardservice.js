// services/dashboard.service.js
const dayjs = require('dayjs');

// Gọi tới các repo
const userRepository = require('../repositories/userRepository');
const orderRepository = require('../repositories/orderRepository');
// nếu cần product/category thì thêm:
const productRepository = require('../repositories/productRepository');
const categoryRepository = require('../repositories/CategoryRepository');

function getCurrentMonthRange() {
  const now = dayjs();
  const start = now.startOf('month').format('YYYY-MM-DD');
  const end = now.endOf('month').format('YYYY-MM-DD');
  return { startDate: start, endDate: end };
}

// ========== SIMPLE DASHBOARD ==========
exports.getSimpleDashboard = async () => {
  const { startDate, endDate } = getCurrentMonthRange();

  // 1. Tổng số user
  const totalUsers = await userRepository.getTotalUsers();

  // 2. Số user mới trong tháng hiện tại
  const newUsers = await userRepository.getNewUsersInRange(startDate, endDate);

  // 3. Tổng số đơn hàng trong tháng hiện tại
  const totalOrders = await orderRepository.countOrdersInRange(startDate, endDate);

  // 4. Tổng doanh thu trong tháng
  const totalRevenue = await orderRepository.sumRevenueInRange(startDate, endDate);

  // 5. Sản phẩm bán chạy
  const bestSellingProducts = await orderRepository.getBestSellingProducts(
    startDate,
    endDate,
    5 // limit
  );

  return {
    timeRange: {
      type: 'current_month',
      startDate,
      endDate
    },
    totalUsers,
    newUsers,
    totalOrders,
    totalRevenue,
    bestSellingProducts
  };
};

// ========== ADVANCED DASHBOARD – SUMMARY ==========
exports.getAdvancedSummary = async (params) => {
  const { granularity } = params;

  if (granularity === 'month') {
    const year = params.year || dayjs().year();

    // Lấy dữ liệu group theo tháng từ repo
    const rows = await orderRepository.getMonthlySummary(year);
    // rows dạng: [{ month: 1, ordersCount, totalRevenue, totalProfit }, ...]

    const data = rows.map((row) => {
      const m = String(row.month).padStart(2, '0');
      return {
        timeKey: `${year}-${m}`,
        label: `${dayjs(`${year}-${m}-01`).format('MMM YYYY')}`,
        ordersCount: row.ordersCount,
        totalRevenue: row.totalRevenue,
        totalProfit: row.totalProfit
      };
    });

    return {
      granularity: 'month',
      year,
      data
    };
  }

  if (granularity === 'year') {
    const rows = await orderRepository.getYearlySummary(); // group by year
    const data = rows.map((row) => ({
      timeKey: `${row.year}`,
      label: `${row.year}`,
      ordersCount: row.ordersCount,
      totalRevenue: row.totalRevenue,
      totalProfit: row.totalProfit
    }));
    return {
      granularity: 'year',
      data
    };
  }

  if (granularity === 'quarter') {
    const year = params.year || dayjs().year();
    const rows = await orderRepository.getQuarterlySummary(year);
    // rows: [{ quarter:1, ordersCount, totalRevenue, totalProfit }, ...]
    const data = rows.map((row) => ({
      timeKey: `${year}-Q${row.quarter}`,
      label: `Q${row.quarter} ${year}`,
      ordersCount: row.ordersCount,
      totalRevenue: row.totalRevenue,
      totalProfit: row.totalProfit
    }));
    return {
      granularity: 'quarter',
      year,
      data
    };
  }

  if (granularity === 'week') {
    const year = params.year || dayjs().year();
    const rows = await orderRepository.getWeeklySummary(year);
    // rows: [{ week: 1, ordersCount, totalRevenue, totalProfit }, ...]
    const data = rows.map((row) => ({
      timeKey: `${year}-W${row.week}`,
      label: `Week ${row.week} ${year}`,
      ordersCount: row.ordersCount,
      totalRevenue: row.totalRevenue,
      totalProfit: row.totalProfit
    }));
    return {
      granularity: 'week',
      year,
      data
    };
  }

  if (granularity === 'custom') {
    const { startDate, endDate } = params;
    const rows = await orderRepository.getCustomRangeSummary(startDate, endDate);
    // rows có thể là group theo ngày / tuần tuỳ bạn định nghĩa
    const data = rows.map((row) => ({
      timeKey: row.timeKey,
      label: row.label,
      ordersCount: row.ordersCount,
      totalRevenue: row.totalRevenue,
      totalProfit: row.totalProfit
    }));
    return {
      granularity: 'custom',
      startDate,
      endDate,
      data
    };
  }

  // fallback
  return {
    granularity,
    data: []
  };
};

// ========== ADVANCED DASHBOARD – PRODUCT COMPARISON ==========
exports.getProductComparison = async (params) => {
  const { granularity } = params;

  if (granularity === 'quarter') {
    const year = params.year || dayjs().year();

    // Lấy dữ liệu group theo quarter + loại sản phẩm từ repo
    const rows = await orderRepository.getProductComparisonByQuarter(year);
    // rows: [{ quarter, typeId, typeName, quantitySold, revenue, profit, ordersCount }, ...]

    // Gom data theo quarter
    const map = new Map();
    for (const row of rows) {
      const key = row.quarter;
      if (!map.has(key)) {
        map.set(key, {
          timeKey: `${year}-Q${row.quarter}`,
          label: `Q${row.quarter} ${year}`,
          ordersCount: row.ordersCount || 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalProductsSold: 0,
          productTypes: []
        });
      }
      const obj = map.get(key);
      obj.totalRevenue += row.revenue;
      obj.totalProfit += row.profit;
      obj.totalProductsSold += row.quantitySold;
      obj.productTypes.push({
        typeId: row.typeId,
        typeName: row.typeName,
        quantitySold: row.quantitySold,
        revenue: row.revenue,
        profit: row.profit
      });
    }

    return {
      granularity: 'quarter',
      year,
      data: Array.from(map.values())
    };
  }

  // Bạn có thể làm tương tự cho year / month / week / custom...
  return {
    granularity,
    data: []
  };
};
