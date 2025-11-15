require("dotenv").config();
const express = require("express");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const { ensureSession } = require("./middleware/session.js");
require("./config/passport");
require("express-async-errors");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db.js");
const authRoutes = require("./routes/auth.js");
const routes = require("./routes/routes.js");
const errorMiddleware = require("./middleware/errorMiddleware.js");
const currentUser = require("./middleware/currentUser");
const app = express();
// cấu hình dữ liệu API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(ensureSession);
app.use(currentUser);  // tạo sid nếu chưa có   // load currentUser vào req nếu có uid
app.use(passport.initialize());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/api", routes);
app.use(errorMiddleware);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", authRoutes);
const pageRoutes = require('./routes/page.routes');
app.use('/', pageRoutes);
const cart = require('./routes/cart.routes');
app.use('/', cart);
module.exports = app;
