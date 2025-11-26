const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true, // cho phép nhiều document có email=null, nhưng khi có email thì phải unique
      validate: {
        validator: function (v) {
          // Nếu có email thì check đúng định dạng
          return v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} không phải email hợp lệ!`,
      },
    },
    password_hash: { type: String, default: null },
    full_name: String,
    // 🔥 thêm phone
    phone: {
      type: String,
      unique: true,
      sparse: true, // cho phép null, nhưng nếu có thì unique
    },

    // 🔥 thêm gender
    gender: {
      type: String,
      enum: ["male", "female", "other", null],
      default: null,
    },

    // 🔥 thêm birthday
    birthday: {
      type: Date,
      default: null,
    },

    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    loyalty_points: { type: Number, default: 0 },

    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    is_verified: { type: Boolean, default: false },

    googleId: { type: String, default: null },
    facebookId: { type: String, default: null },

    refresh_token: { type: String, default: null },

    is_banned: { type: Boolean, default: false },

    reset_password_token: { type: String, default: null },
    reset_password_expires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
