const express = require("express");
const router = express.Router();
const brandController = require("../controllers/BrandController");

router.post("/", brandController.create);
router.get("/", brandController.getAll);
router.get("/:id", brandController.getById);
router.put("/brands/:id", brandController.update);
router.delete("/brands/:id", brandController.delete);

module.exports = router;
