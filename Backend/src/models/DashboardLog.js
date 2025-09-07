const mongoose = require("mongoose");

const bestSellingProductSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    total_sold: Number,
    revenue: Number,
  },
  { _id: false }
);

const dashboardLogSchema = new mongoose.Schema(
  {
    date: Date,
    orders_count: Number,
    revenue: Number,
    profit: Number,
    best_selling_products: [bestSellingProductSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("DashboardLog", dashboardLogSchema);
