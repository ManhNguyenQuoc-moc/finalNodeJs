const express = require("express");
const multer = require("multer");
const router = express.Router();
const aiController = require("../controllers/aicontroller");

const upload = multer({ storage: multer.memoryStorage() });

// router.post("/chatbot", aiController.chatbotSuggestProducts);
router.post("/sentiment", aiController.analyzeSentiment);
router.post("/search-by-image", upload.single("image"), aiController.searchByImage);

module.exports = router;
