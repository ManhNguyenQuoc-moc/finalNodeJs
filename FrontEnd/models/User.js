const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  address_line: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true },
  phone: { type: String, trim: true },
  is_default: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },                        // nếu đăng nhập truyền thống
  full_name: { type: String, required: true, trim: true },
  roles: { type: [String], default: ["customer"], enum: ["customer","admin"] },
  loyalty_points: { type: Number, default: 0, min: 0 },                   // loyalty 10% (đề bài)
  oauth_provider: { type: String, enum: [null,"google","facebook"], default: null },
  oauth_id: { type: String, default: null },
  addresses: { type: [addressSchema], default: [] }                       // nhiều địa chỉ giao hàng
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
