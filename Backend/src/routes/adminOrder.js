const express = require("express");
const router = express.Router();

const adminOrderController = require("../controllers/adminOrder.controller");
router.get("/", adminOrderController.getList);
router.get("/:id", adminOrderController.getDetail);
router.put("/:id/status", adminOrderController.updateStatus);

module.exports = router;
