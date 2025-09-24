const { AddVariantsRequest } = require("./AddVariantsRequest");

class AddProductRequest {
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

    // productImages: file upload của product
    this.productImages = files.filter(f => f.fieldname === "productImages");

    // variants: parse JSON từ body
    let rawVariants = [];
    try {
      if (body.variants) {
        rawVariants = JSON.parse(body.variants);
        if (!Array.isArray(rawVariants)) rawVariants = [];
      }
    } catch (e) {
      rawVariants = [];
    }

    this.variants = rawVariants.map((variant, index) => {
      const uploadedFiles = files.filter(
        f => f.fieldname === `variantImagesMap[${index}]`
      );
      return new AddVariantsRequest(variant, uploadedFiles);
    });
  }
}

module.exports = { AddProductRequest };
