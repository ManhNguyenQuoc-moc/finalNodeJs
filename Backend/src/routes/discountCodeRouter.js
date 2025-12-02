// routes/discountCodeRouter.js
const express = require("express");
const controller = require("../controllers/discountCodeController.js");

const router = express.Router();
// GET /api/discount-codes/available
router.get("/available", controller.getAvailable);

// GET /api/discount-codes?code=ABCDE&is_active=true
router.get("/", controller.list);

// GET /api/discount-codes/:id
router.get("/:id", controller.getById);

// POST /api/discount-codes
router.post("/", controller.create);

// PUT /api/discount-codes/:id
router.put("/:id", controller.update);

// DELETE /api/discount-codes/:id
router.delete("/:id", controller.remove);

// POST /api/discount-codes/apply  { code: "ABCDE" }
router.post("/apply/use", controller.apply);

module.exports = router;
