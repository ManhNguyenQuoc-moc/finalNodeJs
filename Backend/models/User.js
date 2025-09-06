const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    full_name: String,
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    loyalty_points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
