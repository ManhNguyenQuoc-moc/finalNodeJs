const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "API is working" });
});
// Gắn router con vào router tổng
const usersRouter = require("./users");//import
router.use("/users", usersRouter);

module.exports = router;//export
