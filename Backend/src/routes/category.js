const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/CategoryController");

router.post("/", categoryController.create);
router.get("/", categoryController.getAll);
router.get("/categories/:id", categoryController.getById);
router.put("/categories/:id", categoryController.update);
router.delete("/categories/:id", categoryController.delete);
module.exports = router;
