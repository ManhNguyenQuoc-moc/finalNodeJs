const ProductImport = require("../models/ProductImport");

module.exports = {
    async create(data, session = null) {
        // dùng create với session thì nên dùng dạng mảng
        const [created] = await ProductImport.create([data], { session });
        return created;
    },

    async findById(id, session = null) {
        return ProductImport.findById(id)
            .populate("productVariant")
            .session(session);
    },

    async findAll(filter = {}, options = {}) {
        return ProductImport.find(filter, null, options)
            .populate("productVariant")
            .sort({ createdAt: -1 })
            .lean();
    },

    async update(id, data, session = null) {
        return ProductImport.findByIdAndUpdate(id, data, {
            new: true,
            session,
        }).populate("productVariant");
    },

    async delete(id, session = null) {
        return ProductImport.findByIdAndDelete(id).session(session);
    },
    async findByVariant(variantId) {
        return ProductImport.find({ productVariant: variantId }).lean();
    },

    // 🔹 TÍNH GIÁ NHẬP TRUNG BÌNH THEO VARIANT
    async getAverageCostByVariant(variantId) {
        const imports = await ProductImport.find({ productVariant: variantId }).lean();
        if (!imports.length) return 0;

        let totalQty = 0;
        let totalCost = 0;
        for (const imp of imports) {
            totalQty += imp.quantity;
            totalCost += imp.quantity * imp.import_price;
        }

        return totalQty > 0 ? totalCost / totalQty : 0;
    },
}
