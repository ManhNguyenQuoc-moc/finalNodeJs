const express = require("express");
const router = express.Router();
const importController = require("../controllers/importController");

// POST /imports
router.post("/", importController.createImport);
router.get("/", importController.getAllImports);
router.get("/:id", importController.getImportById);
router.put("/:id", importController.updateImport);
router.delete("/:id", importController.deleteImport);
module.exports = router;
