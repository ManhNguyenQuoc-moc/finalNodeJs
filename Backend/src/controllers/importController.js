const importService = require("../services/importService");

async function createImport(req, res, next) {
    try {
        const { productVariantId, quantity, import_price, note } = req.body;

        // có thể thêm validate đơn giản
        if (!productVariantId || !quantity || !import_price) {
            return res.status(400).json({
                message: "productVariantId, quantity, import_price là bắt buộc",
            });
        }

        const result = await importService.createImport({
            productVariantId,
            quantity: Number(quantity),
            import_price: Number(import_price),
            note,
        });

        return res.status(201).json({
            message: "Nhập hàng thành công",
            data: result,
        });
    } catch (err) {
        // bạn có thể custom error middleware, ở đây đơn giản thôi
        console.error(err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
async function getAllImports(req, res) {
    try {
        const list = await importService.getAllImports();
        return res.json({
            success: true,
            data: list,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}

async function getImportById(req, res) {
    try {
        const imp = await importService.getImportById(req.params.id);
        return res.json({
            success: true,
            data: imp,
        });
    } catch (err) {
        console.error(err);
        return res.status(404).json({
            success: false,
            message: err.message || "Import record not found",
        });
    }
}

async function updateImport(req, res) {
    try {
        const { quantity, import_price, note, import_date } = req.body;

        const updated = await importService.updateImport(req.params.id, {
            quantity: quantity !== undefined ? Number(quantity) : undefined,
            import_price: import_price !== undefined ? Number(import_price) : undefined,
            note,
            import_date,
        });

        return res.json({
            success: true,
            message: "Cập nhật nhập hàng thành công",
            data: updated,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}

async function deleteImport(req, res) {
    try {
        await importService.deleteImport(req.params.id);
        return res.json({
            success: true,
            message: "Xóa phiếu nhập thành công",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}
module.exports = {
    createImport,
    getAllImports,
    getImportById,
    updateImport,
    deleteImport,
};
