const mongoose = require("mongoose");
const productVariantRepo = require("../repositories/VariantRepository");
const productImportRepo = require("../repositories/productImportRepository");

async function createImport({ productVariantId, quantity, import_price, note }) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // 1. Kiểm tra variant có tồn tại không
        const variant = await productVariantRepo.findById(productVariantId, session);
        if (!variant) {
            throw new Error("ProductVariant not found");
        }

        // 2. Tạo record nhập hàng
        const importRecord = await productImportRepo.create(
            {
                productVariant: productVariantId,
                quantity,
                import_price,
                note,
            },
            session
        );

        // 3. Cập nhật tồn kho cho variant
        const updatedVariant = await productVariantRepo.increaseStock(
            productVariantId,
            quantity,
            session
        );

        await session.commitTransaction();
        session.endSession();

        // có thể trả về cả record nhập & variant mới
        return {
            import: importRecord,
            productVariant: updatedVariant,
        };
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }

}
async function getAllImports() {
    return productImportRepo.findAll();
}

// ➕ LẤY THEO ID
async function getImportById(id) {
    const imp = await productImportRepo.findById(id);
    if (!imp) {
        throw new Error("Import record not found");
    }
    return imp;
}

// ➕ UPDATE IMPORT + CẬP NHẬT TỒN KHO (nếu quantity thay đổi)
async function updateImport(id, { quantity, import_price, note, import_date }) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const oldImport = await productImportRepo.findById(id, session);
        if (!oldImport) throw new Error("Import record not found");

        const updateData = {};
        if (import_price !== undefined) updateData.import_price = import_price;
        if (note !== undefined) updateData.note = note;
        if (import_date !== undefined) updateData.import_date = import_date;

        let deltaQty = 0;
        if (quantity !== undefined) {
            // chênh lệch số lượng mới - cũ
            deltaQty = quantity - oldImport.quantity;
            updateData.quantity = quantity;
        }

        const updatedImport = await productImportRepo.update(id, updateData, session);

        // Nếu có thay đổi quantity thì chỉnh tồn kho
        if (deltaQty !== 0) {
            await productVariantRepo.increaseStock(
                oldImport.productVariant._id || oldImport.productVariant,
                deltaQty,
                session
            );
        }

        await session.commitTransaction();
        session.endSession();

        return updatedImport;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}

async function deleteImport(id) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const oldImport = await productImportRepo.findById(id, session);
        if (!oldImport) throw new Error("Import record not found");

        // Xóa record import
        await productImportRepo.delete(id, session);

        // Trừ tồn kho lại
        await productVariantRepo.increaseStock(
            oldImport.productVariant._id || oldImport.productVariant,
            -oldImport.quantity,
            session
        );

        await session.commitTransaction();
        session.endSession();

        return true;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}

module.exports = {
    createImport,
    getAllImports,
    getImportById,
    updateImport,
    deleteImport,
};
