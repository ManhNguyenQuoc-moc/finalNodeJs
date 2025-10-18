// src/app.js
require("dotenv").config();
require("./config/passport");
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const passport = require("passport");

// middlewares
const { ensureSession, loadUser } = require("./middleware/session");
const errorMiddleware = require("./middleware/errorMiddleware");

// routes sẵn có của bạn
const socialAuthRoutes = require("./routes/auth.js");   // /api/auth (mxh)
const v1Routes        = require("./routes/routes.js");  // /api/v1 (router tổng)

// routes mới tách ra
const pageRoutes     = require("./routes/page.routes");
const cartRoutes     = require("./routes/cart.routes");
const authFormRoutes = require("./routes/auth-form.routes");

const app = express();

// base middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

// session + attach user
app.use(ensureSession, loadUser);

// mount các route đã tách
app.use(pageRoutes);                // giữ nguyên mọi URL /api/page/* và GET "/"
app.use(authFormRoutes);            // /login, /register, /logout (form-style)
app.use(cartRoutes);                // add-to-cart, cart update/remove, checkout

// các router đã có sẵn của bạn (để KHÔNG đè /api/page/*)
app.use("/api/auth", socialAuthRoutes);
app.use("/api/v1", v1Routes);

// error handler cuối
app.use(errorMiddleware);

module.exports = app;
