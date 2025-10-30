const sizeService = require("../services/SizeService");

class sizeController {
    async create(req, res) {
        try {
            const brand = await sizeService.createSize(req.body);
            res.status(201).json(brand);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAll(req, res) {
        try {
            const brands = await sizeService.getAllSizes();
            res.json(brands);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req, res) {
        try {
            const brand = await sizeService.getSizeById(req.params.id);
            res.json(brand);
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            const brand = await sizeService.updateSize(req.params.id, req.body);
            res.json(brand);
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }

    async delete(req, res) {
        try {
            await sizeService.delete(req.params.id);
            res.json({ message: "Brand deleted successfully" });
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }
}

module.exports = new sizeController();
