require("dotenv").config();
const express = require("express");
const passport = require("passport");
require("./config/passport");
require("express-async-errors");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db.js");
const authRoutes = require("./routes/auth.js");
const routes = require("./routes/routes.js");
const errorMiddleware = require("./middleware/errorMiddleware.js");
const app = express();
// cấu hình dữ liệu API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
//gọi tới api
app.use("/api", routes);
//gọi tới middleware
app.use(errorMiddleware);

//connect DB
connectDB();
// test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

app.use("/api/auth", authRoutes);
//app.use("/api/users", require("./routes/users"));

module.exports = app;
