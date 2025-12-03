const mongoose = require("mongoose");
const fillAddressLine = require("../middleware/addressPopulate"); // đường dẫn tuỳ project

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    city: { type: String, required: false },
    district: { type: String, required: false },
    ward: { type: String, required: false },
    detail: { type: String, required: false },
    address_line: { type: String },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Gán middleware
addressSchema.pre("save", fillAddressLine);

module.exports = mongoose.model("Address", addressSchema);
