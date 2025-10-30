const colorService = require("../services/ColorService");

class colorController {
    async create(req, res) {
        try {
            const color = await colorService.createColor(req.body);
            res.status(201).json(color);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAll(req, res) {
        try {
            const colors = await colorService.getAllBColor();
            res.json(colors);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req, res) {
        try {
            const color = await colorService.getColorById(req.params.id);
            res.json(color);
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            const color = await colorService.updateColor(req.params.id, req.body);
            res.json(color);
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }

    async delete(req, res) {
        try {
            await colorService.deleteColor(req.params.id);
            res.json({ message: "Color deleted successfully" });
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }
}

module.exports = new colorController();
