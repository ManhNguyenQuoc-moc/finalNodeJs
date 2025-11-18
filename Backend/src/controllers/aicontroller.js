
const aiService = require("../services/aiService");

// exports.chatbotSuggestProducts = async (req, res) => {
//   const { message } = req.body;
//   res.json(await aiService.chatbotSuggestProducts(message));
// };

exports.analyzeSentiment = async (req, res) => {
  const { text } = req.body;
  res.json(await aiService.analyzeSentiment(text));
};

exports.searchByImage = async (req, res) => {
  const image = req.file.buffer;
  res.json(await aiService.searchProductsByImage(image));
};
