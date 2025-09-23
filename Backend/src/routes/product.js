const express = require("express");
const router = express.Router();
const { upload } = require("../config/multer");
const productController = require("../controllers/productController");

// CRUD routes cho Product
// POST create product  // Tạo sản phẩm
router.post("/", upload.any(), productController.createProduct);
router.get("/", productController.getProducts);          // Lấy danh sách sản phẩm (có filter/pagination)
// router.get("/:id", productController.getProductbyID);          // Lấy chi tiết 1 sản phẩm
// router.put("/:id",upload.any(), productController.updateProduct); 
router.put("/variants/:id",upload.any(), productController.addVariant); // Cập nhật sản phẩm
// router.delete("/:id", productController.deleteProduct);     // Xoá sản phẩm

module.exports = router;
