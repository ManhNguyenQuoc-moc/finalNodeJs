const express = require("express");
const router = express.Router();
const { upload } = require("../config/multer");
const productController = require("../controllers/productController");
const colorController = require("../controllers/colorController");
const sizeController = require("../controllers/sizeController");
const { requireAuthOptional } = require("../middleware/authMiddleware");
const reviewController = require("../controllers/reviewController");
// ===== Product (tạo / danh sách) =====
router.post("/", upload.any(), productController.createProduct);
router.get("/", productController.getAllProducts);
router.post(
  "/:id/reviews",
  requireAuthOptional,
  reviewController.createReview
);
// ===== Color (đặt TRƯỚC /:id) =====
router.get("/color", colorController.getAll);
router.get("/color/:id", colorController.getById);
router.post("/color", colorController.create);
router.put("/color/:id", colorController.update);
router.delete("/color/:id", colorController.delete);

// ===== Size (đặt TRƯỚC /:id) =====
router.get("/size", sizeController.getAll);
router.get("/size/:id", sizeController.getById);
router.post("/size", sizeController.create);
router.put("/size/:id", sizeController.update);
router.delete("/size/:id", sizeController.delete);

// ===== Variants (đặt TRƯỚC /:id) =====
router.put("/variants/:id", upload.any(), productController.addVariant);
router.get("/variants", productController.getAllVariants);
// 1 biến thể
router.get("/variants/:id", productController.getVariantById);
router.put("/variants/:id/stock", productController.updateVariantStock);
// ===== Cuối cùng mới là /:id (bắt-mọi) =====
router.get("/:id", productController.getProductbyID);
router.put("/:id", upload.any(), productController.updateProduct);
// router.delete("/:id", productController.deleteProduct);

module.exports = router;
