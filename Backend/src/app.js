const express = require("express");
require("express-async-errors");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
//import
const routes = require("./routes/routes.js");
const errorMiddleware = require("./middleware/errorMiddleware.js");
const app = express();
// cấu hình dữ liệu API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
//gọi tới api
app.use("/api", routes);
//gọi tới middleware
app.use(errorMiddleware);

module.exports = app;
