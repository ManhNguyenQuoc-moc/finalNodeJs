const { AddVariantsRequest ,ProductVariantOutputDTO } = require("./AddVariantsRequest");
class AddProductRequest {
  constructor(body, files = [])
  {
    this.name = body.name;
    this.slug = body.slug;
    this.brand = body.brand;
    this.category = body.category;
    this.short_description = body.short_description;
    this.long_description = body.long_description;
    this.productImages = files.filter(f => f.fieldname === "productImages");
    try {
      const rawVariants = JSON.parse(body.variants) || [];
      this.variants = rawVariants.map((variant, index) => {
      const uploadedFiles = files.filter(
          f => f.fieldname === `variantImagesMap[${index}]`
        );
        return new AddVariantsRequest(variant, uploadedFiles);
      });
    } catch (e) {
      this.variants = [];
    }
  }
}
module.exports = {AddProductRequest};
