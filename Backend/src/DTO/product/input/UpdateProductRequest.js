// DTO/product/input/UpdateProductRequest.js
const { UpdateVariantRequest } = require("./UpdateVariantRequest");

class UpdateProductRequest {
  constructor(body, files = []) {
    this.name = body.name;
    this.slug = body.slug;
    this.brand = body.brand;
    this.category = body.category;
    this.short_description = body.short_description;
    this.long_description = body.long_description;
    this.productStatus = {
      statusName: body.statusName || "New",
    };
    // Nhận imagesToDelete dạng mảng / chuỗi JSON
    let rawDel = body.imagesToDelete ?? body['imagesToDelete[]'] ?? null;
    if (typeof rawDel === 'string') {
      try { rawDel = JSON.parse(rawDel); } catch { rawDel = [rawDel]; }
    }
    this.imagesToDelete = Array.isArray(rawDel) ? rawDel : [];

    // Ảnh product mới
    this.newProductImages = (files || []).filter(f => f.fieldname === "productImages");

    // Variants (parse JSON text)
    let rawVariants = [];
    try {
      if (body.variants) {
        rawVariants = JSON.parse(body.variants);
        if (!Array.isArray(rawVariants)) rawVariants = [];
      }
    } catch (e) {
      console.error("Parse variants failed:", e, "raw:", body.variants);
      rawVariants = [];
    }

    this.variants = rawVariants.map((v, idx) => {
      const vf = (files || []).filter(f => f.fieldname === `variantImagesMap[${idx}]`);
      return new UpdateVariantRequest(v, vf);
    });

    // Debug hữu ích (xóa nếu không cần)
    console.log("DTO variants summary:",
      this.variants.map((x, i) => ({ i, id: x.id, newImages: x.newImages?.length || 0, del: x.imagesToDelete?.length || 0 }))
    );
  }
}
module.exports = { UpdateProductRequest };
