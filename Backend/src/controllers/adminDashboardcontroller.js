// controllers/adminDashboard.controller.js
const dashboardService = require('../services/dashboardservice');

exports.getSimpleDashboard = async (req, res) => {
  try {
    const data = await dashboardService.getSimpleDashboard();
    res.json(data);
  } catch (error) {
    console.error('Error getSimpleDashboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAdvancedSummary = async (req, res) => {
  try {
    const {
      granularity = 'year', // year | quarter | month | week | custom
      year,
      quarter,
      month,
      week,
      startDate,
      endDate
    } = req.query;

    const params = {
      granularity,
      year: year ? parseInt(year, 10) : undefined,
      quarter: quarter ? parseInt(quarter, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      week: week ? parseInt(week, 10) : undefined,
      startDate,
      endDate
    };

    const data = await dashboardService.getAdvancedSummary(params);
    res.json(data);
  } catch (error) {
    console.error('Error getAdvancedSummary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getProductComparison = async (req, res) => {
  try {
    const {
      granularity = 'year',
      year,
      quarter,
      month,
      week,
      startDate,
      endDate
    } = req.query;

    const params = {
      granularity,
      year: year ? parseInt(year, 10) : undefined,
      quarter: quarter ? parseInt(quarter, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      week: week ? parseInt(week, 10) : undefined,
      startDate,
      endDate
    };

    const data = await dashboardService.getProductComparison(params);
    res.json(data);
  } catch (error) {
    console.error('Error getProductComparison:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
