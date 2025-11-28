// services/dashboard.service.js
const dayjs = require('dayjs');

// Gọi tới các repo
const userRepository = require('../repositories/userRepository');
const orderRepository = require('../repositories/orderRepository');
// nếu cần product/category thì thêm:
const productRepository = require('../repositories/productRepository');
const categoryRepository = require('../repositories/CategoryRepository');

/* =======================================
 * Helper: khoảng thời gian mặc định
 * =======================================
 */
function getCurrentMonthRange() {
  const now = dayjs();
  const start = now.startOf('month').format('YYYY-MM-DD');
  const end = now.endOf('month').format('YYYY-MM-DD');
  return { startDate: start, endDate: end };
}

/**
 * Helper: resolve khoảng thời gian dựa trên params từ controller
 * granularity: 'year' | 'quarter' | 'month' | 'week' | 'custom'
 */
function resolveDateRangeFromParams(params = {}) {
  const granularity = params.granularity || 'month';

  // custom: đã truyền sẵn startDate, endDate
  if (granularity === 'custom' && params.startDate && params.endDate) {
    return {
      granularity,
      startDate: params.startDate,
      endDate: params.endDate
    };
  }

  const now = dayjs();
  const year = params.year || now.year();

  if (granularity === 'year') {
    const startDate = dayjs(`${year}-01-01`).startOf('year').format('YYYY-MM-DD');
    const endDate = dayjs(`${year}-12-31`).endOf('year').format('YYYY-MM-DD');
    return { granularity, startDate, endDate, year };
  }

  if (granularity === 'quarter') {
    const q = params.quarter || 1; // 1-4
    const quarterStartMonth = (q - 1) * 3 + 1; // 1,4,7,10
    const startDate = dayjs(`${year}-${quarterStartMonth}-01`)
      .startOf('month')
      .format('YYYY-MM-DD');
    const endDate = dayjs(startDate).add(3, 'month').subtract(1, 'day').format('YYYY-MM-DD');
    return { granularity, startDate, endDate, year, quarter: q };
  }

  if (granularity === 'month') {
    const month = params.month || now.month() + 1; // dayjs month 0-11
    const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      .startOf('month')
      .format('YYYY-MM-DD');
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
    return { granularity, startDate, endDate, year, month };
  }

  if (granularity === 'week') {
    // Tuần theo ISO (1-52/53). Ở đây mình đơn giản hóa:
    const week = params.week || now.week?.() || 1; // nếu có plugin weekOfYear thì dùng, không thì anh tự xử lý
    // Anh có thể custom cách tính tuần cho chuẩn với DB
    return { granularity, week, year }; // start/end tuần có thể để DB/groupby handle
  }

  // fallback: tháng hiện tại
  const { startDate, endDate } = getCurrentMonthRange();
  return { granularity: 'month', startDate, endDate, year: now.year(), month: now.month() + 1 };
}

/* =======================================
 * Helper: Tính doanh thu / lợi nhuận
 * =======================================
 */

/**
 * Tính doanh thu của 1 đơn hàng
 * - Ưu tiên dùng order.totalAmount nếu có
 * - Nếu không có, tính từ danh sách items
 */
function calculateOrderRevenue(order) {
  if (typeof order.totalAmount === 'number') {
    return order.totalAmount;
  }

  // Giả định order.items = [{ price, quantity }, ...]
  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );
  }

  return 0;
}

/**
 * Tính chi phí (COGS) của 1 đơn hàng
 * - Giả định item.costPrice là giá vốn
 */
function calculateOrderCost(order) {
  if (typeof order.totalCost === 'number') {
    return order.totalCost;
  }

  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) => sum + (item.costPrice || 0) * (item.quantity || 0),
      0
    );
  }

  return 0;
}

/**
 * Lợi nhuận = Doanh thu - Chi phí
 */
function calculateOrderProfit(order) {
  const revenue = calculateOrderRevenue(order);
  const cost = calculateOrderCost(order);
  return revenue - cost;
}

/**
 * Tính tổng doanh thu/lợi nhuận của 1 list orders
 */
function aggregateRevenueAndProfit(orders) {
  return orders.reduce(
    (agg, order) => {
      const rev = calculateOrderRevenue(order);
      const prof = calculateOrderProfit(order);
      agg.totalRevenue += rev;
      agg.totalProfit += prof;
      return agg;
    },
    { totalRevenue: 0, totalProfit: 0 }
  );
}

/* =======================================
 * ========== SIMPLE DASHBOARD ===========
 * =======================================
 */

/**
 * Gộp toàn bộ dữ liệu Simple Dashboard
 * - nếu không truyền params => mặc định tháng hiện tại
 */
exports.getSimpleDashboard = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  // 1. Tổng số user
  const totalUsers = await userRepository.getTotalUsers();

  // 2. Số user mới trong khoảng thời gian
  const newUsers = await userRepository.getNewUsersInRange(startDate, endDate);

  // 3. Tổng số đơn hàng trong khoảng
  const totalOrders = await orderRepository.countOrdersInRange(startDate, endDate);

  // 4. Tổng doanh thu trong khoảng
  const totalRevenue = await orderRepository.sumRevenueInRange(startDate, endDate);

  // 5. Tổng lợi nhuận trong khoảng (nên có hàm riêng ở repo, tránh loop JS nếu data lớn)
  const totalProfit =
    (await orderRepository.sumProfitInRange?.(startDate, endDate)) ?? 0;

  // 6. Sản phẩm bán chạy
  const bestSellingProducts = await orderRepository.getBestSellingProducts(
    startDate,
    endDate,
    5 // limit
  );

  return {
    timeRange: {
      type: range.granularity || 'current_month',
      startDate,
      endDate
    },
    totalUsers,
    newUsers,
    totalOrders,
    totalRevenue,
    totalProfit,
    bestSellingProducts
  };
};

/**
 * Chỉ trả về các KPI chính (dùng cho card trên đầu)
 */
exports.getSimpleKpis = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const totalUsers = await userRepository.getTotalUsers();
  const newUsers = await userRepository.getNewUsersInRange(startDate, endDate);
  const totalOrders = await orderRepository.countOrdersInRange(startDate, endDate);
  const totalRevenue = await orderRepository.sumRevenueInRange(startDate, endDate);
  const totalProfit =
    (await orderRepository.sumProfitInRange?.(startDate, endDate)) ?? 0;

  // Nếu cần so sánh với kỳ trước (để vẽ % tăng/giảm)
  // ví dụ: kỳ trước = cùng độ dài ngay trước [startDate, endDate]
  const startPrev = dayjs(startDate).subtract(dayjs(endDate).diff(startDate, 'day') + 1, 'day');
  const endPrev = dayjs(startDate).subtract(1, 'day');

  const prevRevenue = await orderRepository.sumRevenueInRange(
    startPrev.format('YYYY-MM-DD'),
    endPrev.format('YYYY-MM-DD')
  );
  const prevProfit =
    (await orderRepository.sumProfitInRange?.(
      startPrev.format('YYYY-MM-DD'),
      endPrev.format('YYYY-MM-DD')
    )) ?? 0;
  const prevOrders = await orderRepository.countOrdersInRange(
    startPrev.format('YYYY-MM-DD'),
    endPrev.format('YYYY-MM-DD')
  );
  const prevNewUsers = await userRepository.getNewUsersInRange(
    startPrev.format('YYYY-MM-DD'),
    endPrev.format('YYYY-MM-DD')
  );

  // helper tính % thay đổi
  const percentChange = (current, prev) => {
    if (!prev) return null; // không đủ dữ liệu
    return (current - prev) / prev; // dạng 0.12 = +12%
  };

  return {
    timeRange: {
      startDate,
      endDate
    },
    kpis: {
      totalUsers,
      newUsers,
      totalOrders,
      totalRevenue,
      totalProfit
    },
    compareToPrevious: {
      users: percentChange(newUsers, prevNewUsers),
      orders: percentChange(totalOrders, prevOrders),
      revenue: percentChange(totalRevenue, prevRevenue),
      profit: percentChange(totalProfit, prevProfit)
    }
  };
};

/**
 * Biểu đồ Doanh thu & Lợi nhuận theo thời gian
 * FE truyền granularity = 'day' | 'week' | 'month'...
 */
exports.getRevenueAndProfitOverTime = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate, granularity } = range;

  // Giả định repo có hàm group theo time bucket
  // rows: [{ timeKey: '2025-01', label: 'T1', revenue, profit }, ...]
  const rows = await orderRepository.getRevenueAndProfitOverTime({
    startDate,
    endDate,
    granularity
  });

  const data = rows.map((row) => ({
    timeKey: row.timeKey,
    label: row.label,
    revenue: row.revenue,
    profit: row.profit
  }));

  return {
    granularity,
    startDate,
    endDate,
    data
  };
};

/**
 * Biểu đồ Số đơn hàng theo thời gian
 */
exports.getOrdersCountOverTime = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate, granularity } = range;

  // Giả định repo có hàm:
  // getOrdersCountOverTime({startDate, endDate, granularity})
  // rows: [{ timeKey, label, ordersCount }, ...]
  const rows = await orderRepository.getOrdersCountOverTime({
    startDate,
    endDate,
    granularity
  });

  const data = rows.map((row) => ({
    timeKey: row.timeKey,
    label: row.label,
    ordersCount: row.ordersCount
  }));

  return {
    granularity,
    startDate,
    endDate,
    data
  };
};

/**
 * Top sản phẩm bán chạy
 */
exports.getTopSellingProducts = async (params = {}, limit = 10) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const items = await orderRepository.getBestSellingProducts(startDate, endDate, limit);

  return {
    startDate,
    endDate,
    limit,
    items
  };
};

/* =======================================
 * ====== ADVANCED DASHBOARD – SUMMARY ===
 * =======================================
 */

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

/* =======================================
 * === ADVANCED DASHBOARD – CUSTOMERS ====
 * =======================================
 */

exports.getAdvancedCustomerOverview = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  // Giả định repo có:
  // - getCustomerSegments(startDate, endDate)
  // - getCustomerLTVStats(startDate, endDate)
  // - getNewVsReturningCustomers(startDate, endDate)
  const segments = await userRepository.getCustomerSegments(startDate, endDate);
  const ltvStats = await userRepository.getCustomerLTVStats(startDate, endDate);
  const newVsReturning = await userRepository.getNewVsReturningCustomers(startDate, endDate);

  return {
    startDate,
    endDate,
    segments,
    ltvStats,
    newVsReturning
  };
};

/* =======================================
 * === ADVANCED DASHBOARD – ORDERS =======
 * =======================================
 */

exports.getAdvancedOrderOverview = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  // Giả định repo có:
  // - getOrderStatusDistribution(startDate, endDate)
  // - getOrderChannelDistribution(startDate, endDate)
  // - getOrderAverageValue(startDate, endDate)
  const statusDistribution = await orderRepository.getOrderStatusDistribution(startDate, endDate);
  const channelDistribution = await orderRepository.getOrderChannelDistribution(startDate, endDate);
  const avgOrderValue = await orderRepository.getOrderAverageValue(startDate, endDate);

  return {
    startDate,
    endDate,
    statusDistribution,
    channelDistribution,
    avgOrderValue
  };
};

/* =======================================
 * === ADVANCED DASHBOARD – PRODUCT COMP ==
 * =======================================
 */

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

  // TODO: anh có thể bổ sung xử lý cho 'month', 'year', 'custom' tương tự
  return {
    granularity,
    data: []
  };
};
