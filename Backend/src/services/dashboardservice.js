// services/dashboard.service.js
const dayjs = require("dayjs");

const userRepository = require("../repositories/userRepository");
const orderRepository = require("../repositories/orderRepository");
const productImportRepo = require("../repositories/productImportRepository");
const variantRepository = require("../repositories/VariantRepository");

// Nếu cần product/category thì thêm:
const productRepository = require("../repositories/productRepository");
const categoryRepository = require("../repositories/CategoryRepository");

const ProductVariant = require("../models/ProductVariant");
const ProductImport = require("../models/ProductImport");

/* =======================================
 * Helpers chung
 * =======================================
 */

async function getVariantBySku(sku) {
  return await ProductVariant.findOne({ sku }).lean();
}

function getCurrentMonthRange() {
  const now = dayjs();
  const start = now.startOf("month").format("YYYY-MM-DD");
  const end = now.endOf("month").format("YYYY-MM-DD");
  return { startDate: start, endDate: end };
}

/**
 * ISO week helper dùng chung (thay cho nhiều getWeekInfo rời rạc)
 * @param {Date} date
 * @returns {{year:number, week:number}}
 */
function getISOWeekInfo(date) {
  // ISO week (Thứ 2 là ngày đầu tuần)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7; // 1..7, T2=1
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week: weekNo };
}

/**
 * Helper: resolve khoảng thời gian dựa trên params từ controller
 * granularity: 'year' | 'quarter' | 'month' | 'week' | 'custom'
 *
 * Quan trọng:
 * - 'month'  : range = cả tháng
 * - 'week'   : range = cả tháng nhưng group theo tuần (ISO week)
 * - nếu có startDate/endDate thì ưu tiên dùng range đó
 */
function resolveDateRangeFromParams(params = {}) {
  const granularity = params.granularity || "month";
  const now = dayjs();

  // ===== CASE 1: ĐÃ CHỌN RANGE NGÀY (ƯU TIÊN CAO NHẤT) =====
  if (params.startDate && params.endDate) {
    const start = dayjs(params.startDate);
    const end = dayjs(params.endDate);

    return {
      granularity,
      startDate: start.startOf("day").format("YYYY-MM-DD"),
      endDate: end.endOf("day").format("YYYY-MM-DD"),
      year: params.year,
      quarter: params.quarter,
      month: params.month,
      week: params.week,
    };
  }

  // ===== CASE 2: KHÔNG CÓ RANGE -> MẶC ĐỊNH THEO GRANULARITY =====
  const year = params.year || now.year();

  // Năm
  if (granularity === "year") {
    const startDate = dayjs(`${year}-01-01`).startOf("year");
    const endDate = dayjs(`${year}-12-31`).endOf("year");
    return {
      granularity,
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      year,
    };
  }

  // Quý (3 tháng / quý)
  if (granularity === "quarter") {
    const q = params.quarter || (Math.floor(now.month() / 3) + 1); // 1-4
    const quarterStartMonth = (q - 1) * 3 + 1; // 1,4,7,10

    const startDate = dayjs(
      `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`
    ).startOf("month");
    const endDate = startDate.add(3, "month").subtract(1, "day");

    return {
      granularity,
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      year,
      quarter: q,
    };
  }

  // Tháng
  if (granularity === "month") {
    const month = params.month || now.month() + 1; // 1-12
    const startDate = dayjs(
      `${year}-${String(month).padStart(2, "0")}-01`
    ).startOf("month");
    const endDate = startDate.endOf("month");

    return {
      granularity,
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      year,
      month,
    };
  }

  // Tuần (CHI TIẾT THEO TUẦN TRONG 1 THÁNG)
  // -> range = cả tháng (giống month), sau đó FE/BE group theo ISO week
  if (granularity === "week") {
    const month = params.month || now.month() + 1; // 1-12
    const startDate = dayjs(
      `${year}-${String(month).padStart(2, "0")}-01`
    ).startOf("month");
    const endDate = startDate.endOf("month");

    return {
      granularity,
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      year,
      month,
    };
  }

  // Ngày (hoặc các giá trị khác rơi vào đây)
  {
    const base = params.startDate ? dayjs(params.startDate) : now;
    const startDate = base.startOf("day");
    const endDate = base.endOf("day");

    return {
      granularity: "day",
      startDate: startDate.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      year: base.year(),
      month: base.month() + 1,
    };
  }
}

/* =======================================
 * Helper: Revenue / Profit
 * =======================================
 */

// Doanh thu = tổng tiền đơn hàng
function calculateOrderRevenue(order) {
  if (typeof order.final_amount === "number") {
    return order.final_amount;
  }
  if (typeof order.total_amount === "number") {
    return order.total_amount;
  }

  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) =>
        sum + (item.price_at_purchase || 0) * (item.quantity || 0),
      0
    );
  }

  return 0;
}

// Cost: tính từ lịch sử nhập (ProductImport)
async function calculateOrderCostFromImports(order) {
  let totalCost = 0;

  if (!Array.isArray(order.items)) return 0;

  for (const item of order.items) {
    const sku = item.product_variant_sku;
    const qty = item.quantity || 0;
    if (!sku || !qty) continue;

    const variant = await variantRepository.findBySku(sku);
    if (!variant?._id) continue;

    const avgCost = await productImportRepo.getAverageCostByVariant(
      variant._id
    );
    totalCost += avgCost * qty;
  }

  return totalCost;
}

async function calculateOrderProfitFromImports(order) {
  const revenue = calculateOrderRevenue(order);
  const cost = await calculateOrderCostFromImports(order);
  return revenue - cost;
}

async function aggregateRevenueAndProfitAsync(orders) {
  let totalRevenue = 0;
  let totalProfit = 0;

  for (const order of orders) {
    totalRevenue += calculateOrderRevenue(order);
    totalProfit += await calculateOrderProfitFromImports(order);
  }

  return { totalRevenue, totalProfit };
}

// Chi phí = tổng (giá nhập * số lượng) — dùng cho 1 số chỗ fallback
function calculateOrderCost(order) {
  if (typeof order.totalImportCost === "number") {
    return order.totalImportCost;
  }

  if (Array.isArray(order.items)) {
    return order.items.reduce(
      (sum, item) =>
        sum +
        ((item.import_price ?? item.costPrice ?? 0) * (item.quantity || 0)),
      0
    );
  }

  return 0;
}

function calculateOrderProfit(order) {
  const revenue = calculateOrderRevenue(order);
  const cost = calculateOrderCost(order);
  return revenue - cost;
}

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

  // 2. Số user mới trong khoảng
  const newUsers = await userRepository.getNewUsersInRange(startDate, endDate);

  // 3. Lấy tất cả orders trong khoảng
  const ordersInRange = await orderRepository.getOrdersInRange(
    startDate,
    endDate
  );

  const { totalRevenue, totalProfit } =
    await aggregateRevenueAndProfitAsync(ordersInRange);

  // 4. Tổng số đơn
  const totalOrders = ordersInRange.length;

  // 5. Sản phẩm bán chạy
  const bestSellingProducts = await orderRepository.getBestSellingProducts(
    startDate,
    endDate,
    5
  );

  return {
    timeRange: {
      type: range.granularity || "month",
      startDate,
      endDate,
    },
    totalUsers,
    newUsers,
    totalOrders,
    totalRevenue,
    totalProfit,
    bestSellingProducts,
  };
};

/**
 * Chỉ trả về các KPI chính (dùng cho card trên đầu)
 */
exports.getSimpleKpis = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  // === KỲ HIỆN TẠI ===
  const totalUsers = await userRepository.getTotalUsers();
  const newUsers = await userRepository.getNewUsersInRange(startDate, endDate);

  const currentOrders = await orderRepository.getOrdersInRange(
    startDate,
    endDate
  );
  const { totalRevenue, totalProfit } =
    await aggregateRevenueAndProfitAsync(currentOrders);
  const totalOrders = currentOrders.length;

  // === KỲ TRƯỚC (cùng độ dài khoảng thời gian) ===
  const dStart = dayjs(startDate);
  const dEnd = dayjs(endDate);
  const diffDays = dEnd.diff(dStart, "day") + 1;

  const startPrev = dStart.subtract(diffDays, "day");
  const endPrev = dStart.subtract(1, "day");

  const prevStartStr = startPrev.format("YYYY-MM-DD");
  const prevEndStr = endPrev.format("YYYY-MM-DD");

  const prevOrders = await orderRepository.getOrdersInRange(
    prevStartStr,
    prevEndStr
  );
  const prevAgg = await aggregateRevenueAndProfitAsync(prevOrders);

  const prevRevenue = prevAgg.totalRevenue;
  const prevProfit = prevAgg.totalProfit;
  const prevOrdersCount = prevOrders.length;
  const prevNewUsers = await userRepository.getNewUsersInRange(
    prevStartStr,
    prevEndStr
  );

  const percentChange = (current, prev) => {
    if (!prev) return null;
    return (current - prev) / prev; // 0.12 = +12%
  };

  return {
    timeRange: {
      startDate,
      endDate,
    },
    kpis: {
      totalUsers,
      newUsers,
      totalOrders,
      totalRevenue,
      totalProfit,
    },
    compareToPrevious: {
      users: percentChange(newUsers, prevNewUsers),
      orders: percentChange(totalOrders, prevOrdersCount),
      revenue: percentChange(totalRevenue, prevRevenue),
      profit: percentChange(totalProfit, prevProfit),
    },
  };
};

/**
 * Biểu đồ Doanh thu & Lợi nhuận theo thời gian
 * FE truyền granularity = 'day' | 'week' | 'month' | 'year'
 */
exports.getRevenueAndProfitOverTime = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate, granularity } = range;

  const orders = await orderRepository.getOrdersInRange(startDate, endDate);

  function getBucketKeyAndLabel(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    switch (granularity) {
      case "year": {
        const key = `${y}`;
        return { key, label: key };
      }

      case "quarter": {
        const quarter = Math.floor(date.getMonth() / 3) + 1; // 1-4
        const key = `${y}-Q${quarter}`;
        const label = `Q${quarter}/${y}`;
        return { key, label };
      }

      case "month": {
        const key = `${y}-${m}`;
        const label = `${m}/${y}`;
        return { key, label };
      }

      case "week": {
        const { year: wy, week } = getISOWeekInfo(date);
        const key = `${wy}-W${String(week).padStart(2, "0")}`;
        const label = `Tuần ${week}/${wy}`;
        return { key, label };
      }

      // mặc định: theo ngày
      default: {
        const key = `${y}-${m}-${d}`;
        const label = `${d}/${m}`;
        return { key, label };
      }
    }
  }

  const buckets = new Map();

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    const { key, label } = getBucketKeyAndLabel(createdAt);

    if (!buckets.has(key)) {
      buckets.set(key, { label, revenue: 0, profit: 0 });
    }
    const bucket = buckets.get(key);

    const revenue = calculateOrderRevenue(order);
    const profit = await calculateOrderProfitFromImports(order);

    bucket.revenue += revenue;
    bucket.profit += profit;
  }

  const data = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  return {
    granularity,
    startDate,
    endDate,
    data,
  };
};

/**
 * Biểu đồ Số đơn hàng theo thời gian
 */
exports.getOrdersCountOverTime = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate, granularity } = range;

  const rows = await orderRepository.getOrdersCountOverTime({
    startDate,
    endDate,
    granularity,
  });

  return {
    granularity,
    startDate,
    endDate,
    data: rows, // rows: [{ label, ordersCount }]
  };
};

/**
 * Top sản phẩm bán chạy
 */
exports.getTopSellingProducts = async (params = {}, limit = 10) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const rows = await orderRepository.getBestSellingProducts(
    startDate,
    endDate,
    limit
  );

  // Chuẩn hoá cho FE
  return rows.map((p) => ({
    name: p.productName || p.productVariantSku || "Sản phẩm",
    total_sold: p.totalQuantitySold || 0,
    totalRevenue: p.totalRevenue || 0,
  }));
};

/* =======================================
 * ====== ADVANCED DASHBOARD – SUMMARY ===
 * =======================================
 */

function getBucketKeyAndLabelForAdvanced(date, granularity, params = {}) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  switch (granularity) {
    case "year": {
      const yearFilter = params.year ? Number(params.year) : null;
      if (yearFilter && y !== yearFilter) return null;
      const yearUse = yearFilter || y;
      const key = `${yearUse}`;
      return { key, label: `${yearUse}` };
    }

    case "month": {
      const yearFilter = params.year ? Number(params.year) : y;
      if (y !== yearFilter) return null;
      const mm = String(m).padStart(2, "0");
      const key = `${yearFilter}-${mm}`;
      const label = `${mm}/${yearFilter}`;
      return { key, label };
    }

    case "quarter": {
      const yearFilter = params.year ? Number(params.year) : y;
      if (y !== yearFilter) return null;
      const quarter = Math.floor((m - 1) / 3) + 1;
      const key = `${yearFilter}-Q${quarter}`;
      const label = `Q${quarter} ${yearFilter}`;
      return { key, label };
    }

    case "week": {
      const { year: wy, week } = getISOWeekInfo(date);
      const yearFilter = params.year ? Number(params.year) : null;
      if (yearFilter && wy !== yearFilter) return null;

      const key = `${wy}-W${String(week).padStart(2, "0")}`;
      const label = `Tuần ${week}/${wy}`;
      return { key, label };
    }

    // default: theo ngày (dùng cho granularity = 'day')
    default: {
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const key = `${y}-${mm}-${dd}`;
      const label = `${dd}/${mm}/${y}`;
      return { key, label };
    }
  }
}

/**
 * So sánh doanh thu, lợi nhuận & số đơn theo mốc thời gian
 * dùng chung công thức doanh thu / lợi nhuận với Simple Dashboard
 */
exports.getAdvancedSummary = async (params = {}) => {
  const granularity = params.granularity || "year";
  let orders = [];

  const hasExplicitRange = params.startDate && params.endDate;

  if (granularity === "year" && !hasExplicitRange) {
    // như cũ: lấy toàn bộ đơn (hoặc tuỳ bạn)
    if (typeof orderRepository.getAllOrders === "function") {
      orders = await orderRepository.getAllOrders();
    } else {
      const { startDate, endDate } = getCurrentMonthRange();
      orders = await orderRepository.getOrdersInRange(startDate, endDate);
    }
  } else {
    // các trường hợp còn lại dựa trên resolveDateRangeFromParams
    const range = resolveDateRangeFromParams(params);
    const { startDate, endDate } =
      range.startDate && range.endDate ? range : getCurrentMonthRange();
    orders = await orderRepository.getOrdersInRange(startDate, endDate);
  }

  const buckets = new Map();
  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    const info = getBucketKeyAndLabelForAdvanced(createdAt, granularity, params);
    if (!info) continue;

    const { key, label } = info;

    if (!buckets.has(key)) {
      buckets.set(key, {
        timeKey: key,
        label,
        ordersCount: 0,
        totalRevenue: 0,
        totalProfit: 0,
      });
    }
    const bucket = buckets.get(key);

    bucket.ordersCount += 1;

    const revenue = calculateOrderRevenue(order);
    const profit = await calculateOrderProfitFromImports(order);

    bucket.totalRevenue += revenue;
    bucket.totalProfit += profit;
  }

  const data = Array.from(buckets.values()).sort((a, b) =>
    a.timeKey.localeCompare(b.timeKey)
  );

  return { granularity, data };
};

/* =======================================
 * === ADVANCED DASHBOARD – CUSTOMERS ====
 * =======================================
 */

/**
 * Tổng quan khách hàng nâng cao (phiên bản đơn giản)
 * - phân đoạn khách hàng theo tổng chi tiêu
 * - thống kê khách hàng mới / quay lại theo đơn hàng
 */
exports.getAdvancedCustomerOverview = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const ordersInRange = await orderRepository.getOrdersInRange(
    startDate,
    endDate
  );

  let ordersBeforeRange = [];
  if (typeof orderRepository.getOrdersBeforeDate === "function") {
    ordersBeforeRange = await orderRepository.getOrdersBeforeDate(startDate);
  }

  const byUser = new Map();
  const oldUserIds = new Set(
    ordersBeforeRange
      .filter((o) => o.user)
      .map((o) => String(o.user))
  );

  for (const order of ordersInRange) {
    if (!order.user) continue;
    const userId = String(order.user);

    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        ordersCount: 0,
        totalRevenue: 0,
      });
    }

    const rec = byUser.get(userId);
    rec.ordersCount += 1;
    rec.totalRevenue += calculateOrderRevenue(order);
  }

  // segments theo tổng chi tiêu
  const segments = {
    low: 0, // < 1M
    mid: 0, // 1M - 5M
    high: 0, // > 5M
  };

  let totalLtv = 0;
  let maxLtv = 0;
  let minLtv = null;

  for (const rec of byUser.values()) {
    const spend = rec.totalRevenue;
    totalLtv += spend;
    if (minLtv === null || spend < minLtv) minLtv = spend;
    if (spend > maxLtv) maxLtv = spend;

    if (spend < 1_000_000) segments.low += 1;
    else if (spend <= 5_000_000) segments.mid += 1;
    else segments.high += 1;
  }

  const customersCount = byUser.size || 1;
  const ltvStats = {
    avg: totalLtv / customersCount,
    min: minLtv || 0,
    max: maxLtv || 0,
  };

  let newCustomers = 0;
  let returningCustomers = 0;

  for (const rec of byUser.values()) {
    const isOld = oldUserIds.has(rec.userId);
    if (isOld) returningCustomers += 1;
    else newCustomers += 1;
  }

  const newVsReturning = {
    new: newCustomers,
    returning: returningCustomers,
  };

  return {
    startDate,
    endDate,
    segments,
    ltvStats,
    newVsReturning,
  };
};

/* =======================================
 * === ADVANCED DASHBOARD – ORDERS =======
 * =======================================
 */

/**
 * Tổng quan đơn hàng nâng cao
 * - phân bổ trạng thái đơn
 * - giá trị đơn trung bình
 */
exports.getAdvancedOrderOverview = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const orders = await orderRepository.getOrdersInRange(startDate, endDate);

  const statusMap = new Map();
  let totalValue = 0;

  for (const order of orders) {
    const status = order.current_status || "unknown";
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
    totalValue += calculateOrderRevenue(order);
  }

  const statusDistribution = Array.from(statusMap.entries()).map(
    ([status, count]) => ({ status, count })
  );

  const avgOrderValue = orders.length ? totalValue / orders.length : 0;

  return {
    startDate,
    endDate,
    statusDistribution,
    channelDistribution: [], // chưa có field kênh bán, để trống
    avgOrderValue,
  };
};

/* =======================================
 * === ADVANCED DASHBOARD – PRODUCT COMP ==
 * =======================================
 */

/**
 * So sánh sản phẩm theo thời gian (phiên bản đơn giản)
 * - yearly: tổng số lượng sản phẩm bán & số SKU khác nhau mỗi năm
 * - distribution: phân bố theo SKU => FE mapping ra "Áo, Quần, Phụ kiện..." nếu muốn
 */
exports.getProductComparison = async (params = {}) => {
  const range = resolveDateRangeFromParams(params);
  const { startDate, endDate } =
    range.startDate && range.endDate ? range : getCurrentMonthRange();

  const orders = await orderRepository.getOrdersInRange(startDate, endDate);

  // 1) Thống kê theo năm
  const yearMap = new Map();

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    const year = createdAt.getFullYear();
    const key = `${year}`;

    if (!yearMap.has(key)) {
      yearMap.set(key, {
        timeKey: key,
        label: `${year}`,
        totalProductsSold: 0,
        distinctSkus: new Set(),
      });
    }

    const bucket = yearMap.get(key);

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const qty = item.quantity || 0;
        const sku = item.product_variant_sku || "UNKNOWN";
        bucket.totalProductsSold += qty;
        bucket.distinctSkus.add(sku);
      }
    }
  }

  const yearly = Array.from(yearMap.values())
    .sort((a, b) => a.timeKey.localeCompare(b.timeKey))
    .map((b) => ({
      timeKey: b.timeKey,
      label: b.label,
      totalProductsSold: b.totalProductsSold,
      totalProductVariants: b.distinctSkus.size,
    }));

  // 2) Phân bố theo SKU
  const distMap = new Map();

  for (const order of orders) {
    if (!Array.isArray(order.items)) continue;
    for (const item of order.items) {
      const sku = item.product_variant_sku || "Khác";
      const qty = item.quantity || 0;
      distMap.set(sku, (distMap.get(sku) || 0) + qty);
    }
  }

  const distribution = Array.from(distMap.entries()).map(
    ([label, quantity]) => ({ label, quantity })
  );

  return {
    granularity: "year",
    startDate,
    endDate,
    yearly,
    distribution,
  };
};
