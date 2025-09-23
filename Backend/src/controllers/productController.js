

const productService = require("../services/productService");
const { AddProductRequest } = require("../DTO/product/input/AddProductRequest");
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
    const { id } = req.params; // lấy id từ URL
    const result = await productService.getProductById(id);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getProducts = async (req, res) => {
  try {
    
    const result = await productService.getProducts(req.quẻy);
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

// const { ProductUpdateInputDTO } = require("../DTO/product/input/ProductUpdateInputDTO");

// exports.updateProduct = async (req, res) => {
//   try {
//     const productId = req.params.id;

//     const dto = new ProductUpdateInputDTO(req.body, req.files);

//     console.log("Updating product ID:", productId);
//     console.log("Update data:", dto);

//     const updatedProduct = await productService.updateProduct(productId, dto);

//     res.status(200).json({
//       success: true,
//       data: updatedProduct,
//     });
//   } catch (err) {
//     console.error("Error updating product:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };




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


