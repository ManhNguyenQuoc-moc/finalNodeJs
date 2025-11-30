const mongoose = require("mongoose");
const fillAddressLine = require("../middleware/addressPopulate"); // đường dẫn tuỳ project

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
    detail: { type: String, required: true },
    address_line: { type: String },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Gán middleware
addressSchema.pre("save", fillAddressLine);

module.exports = mongoose.model("Address", addressSchema);
