const mongoose = require("mongoose");
const productImportSchema = new mongoose.Schema(
  {
    productVariant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ProductVariant", 
      required: true 
    },
    quantity: { type: Number, required: true },         // số lượng nhập
    import_price: { type: Number, required: true },     // giá nhập / 1 sp
    import_date: { type: Date, default: Date.now },     // ngày nhập
    note: String,                                       // ghi chú (ncc, lô hàng, ...)
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductImport", productImportSchema);
