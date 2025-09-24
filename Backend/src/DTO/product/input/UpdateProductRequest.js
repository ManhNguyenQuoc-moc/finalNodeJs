const { UpdateVariantRequest } = require("./UpdateVariantRequest");

class UpdateProductRequest {
  /**
   * @param {object} body - req.body
   * @param {Array} files - req.files từ multer
   */
  constructor(body, files = []) {
    this.name = body.name;
    this.slug = body.slug;
    this.brand = body.brand;
    this.category = body.category;
    this.short_description = body.short_description;
    this.long_description = body.long_description;

    // Product images mới upload
    this.newProductImages = files.filter(f => f.fieldname === "productImages");

    // Xoá ảnh product cũ
    try {
      this.imagesToDelete = body.imagesToDelete ? JSON.parse(body.imagesToDelete) : [];
    } catch (err) {
      this.imagesToDelete = [];
    }

    // Variants
    let rawVariants = [];
    try {
      if (body.variants) {
        rawVariants = JSON.parse(body.variants);
        if (!Array.isArray(rawVariants)) rawVariants = [];
      }
    } catch (e) {
      rawVariants = [];
    }

    this.variants = rawVariants.map((variant, idx) => {
      // File variant images mới upload
      const uploadedFiles = files.filter(
        f => f.fieldname === `variantImagesMap[${idx}]`
      );
      return new UpdateVariantRequest(variant, uploadedFiles);
    });
  }
}

module.exports = { UpdateProductRequest };
