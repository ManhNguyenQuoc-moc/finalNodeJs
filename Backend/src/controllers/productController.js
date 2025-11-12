

const productService = require("../services/productService");
const { AddProductRequest } = require("../DTO/product/input/AddProductRequest");
const { UpdateProductRequest } = require("../DTO/product/input/UpdateProductRequest");
exports.createProduct = async (req, res) => {
  try {
    const dto = new AddProductRequest(req.body, req.files);
    const result = await productService.createProduct(dto);
    res.status(201).json(result);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getProductbyID = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await productService.getProductById(id);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getProducts = async (req, res) => {
  try {
    // Nếu không có query thì để filter = {}
    const filter = Object.keys(req.query).length ? { ...req.query } : {};

    // Options có thể thêm phân trang, sort...
    const options = {};

    const result = await productService.getProducts(filter, options);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
// -------------------- UPDATE PRODUCT --------------------
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Multer đã chạy ở router, nên ở đây chỉ đọc:
    const dto = new UpdateProductRequest(req.body, req.files || []);

    const { response, postCommit } = await productService.updateProduct(productId, dto);
    // 1) Trả về NGAY cho nhanh
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: response,
    });
    // 2) Xoá ảnh cũ sau khi DB ok — chạy nền, không chặn request
    if (typeof postCommit === "function") {
      Promise.resolve(postCommit()).catch(err => {
        console.error("postCommit failed:", err);
      });
    }
  } catch (error) {
    // Nếu service trả kèm onRollback để dọn upload khi lỗi
    if (typeof error?.onRollback === "function") {
      try { await error.onRollback(); } catch (e) { console.error("onRollback failed:", e); }
    }
    console.error("Update product failed:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Update product failed",
    });
  }
};

exports.addVariant = async (req, res) => {
  try {
    const productId = req.params.id;

    // req.files từ multer.any() là array => lọc file variant images
    const dto = new ProductVariantInputDTO(req.body, req.files || []);

    console.log("Adding variant to product:", productId);
    console.log("Variant DTO:", dto);

    const variant = await productService.addVariant(productId, dto);

    res.status(200).json({
      success: true,
      data: variant,
    });
  } catch (err) {
    console.error("Error adding variant:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.getAllProducts = async (req, res) => {
  try {
    const result = await productService.getAllProducts(); // result = { items, total }

    res.status(200).json({
      success: true,
      count: result.length || 0,
      data: result || [],
    });
  } catch (err) {
    console.error("Fail get all products:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// -------------------- LẤY SẢN PHẨM THEO ID --------------------
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await productService.getProductById(id);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Fail get product by ID:", err);
    const code = /not found/i.test(err.message) ? 404 : 500;
    return res.status(code).json({
      success: false,
      message: err.message,
    });
  }
};


