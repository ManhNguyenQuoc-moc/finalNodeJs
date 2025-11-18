const axios = require("axios");
const productRepository = require("../repositories/productRepository");
const productService = require("./productService");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY:", GEMINI_API_KEY);
const GEMINI_MODEL = "gemini-2.5-flash";
const aiService = require("./aiService");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

class AIService {
    async callGemini(parts, temperature = 0.3) {
        const body = {
            contents: [{ parts }],
            generationConfig: { temperature },
        };

        try {
            const res = await axios.post(GEMINI_URL, body, {
                headers: { "Content-Type": "application/json" },
            });

            console.log("Gemini raw data:", JSON.stringify(res.data, null, 2));

            const candidates = res.data?.candidates || [];
            if (!candidates.length) {
                console.warn("No candidates from Gemini. promptFeedback:", res.data?.promptFeedback);
                return "";
            }

            const contentParts = candidates[0].content?.parts || [];
            const text = contentParts
                .map((p) => p.text || "")
                .join("")
                .trim();

            console.log("Gemini joined text:", text);
            return text;
        } catch (err) {
            console.error("=== GEMINI ERROR ===");
            console.error("Status:", err.response?.status);
            console.error("Data:", err.response?.data);
            throw err;
        }
    }

//     async chatbotSuggestProducts(message) {
//         const products = await productService.getAllProducts(); // hoặc productRepository.findForAISuggestion(50)
//         console.log("Products for suggestion (length):", products.length);

//         const systemPrompt = `
// Bạn là trợ lý AI của một website thương mại điện tử.
// Nhiệm vụ của bạn là đọc câu hỏi của khách hàng và chọn ra những sản phẩm LIÊN QUAN NHẤT từ danh sách sản phẩm đã cho.

// QUY TẮC TRẢ LỜI:
// - Chỉ TRẢ VỀ JSON THUẦN, không thêm mô tả, không thêm câu chữ ngoài JSON.
// - JSON phải đúng dạng:

// {
//   "suggestions": [
//     { "productId": "string", "reason": "string" }
//   ]
// }

// QUY TẮC LỰA CHỌN SẢN PHẨM:
// - Ưu tiên sản phẩm phù hợp nhất với câu hỏi dựa trên:
//   • nhu cầu (gaming, chạy bộ, học tập…)
//   • loại sản phẩm (category)
//   • thương hiệu nếu khách hỏi
//   • màu sắc / giới tính / kiểu dáng nếu phù hợp
//   • khoảng giá khách yêu cầu
// - Chỉ chọn từ danh sách sản phẩm được cung cấp.
// - Không bịa thêm sản phẩm mới.
// - Không trả về nhiều hơn 5 sản phẩm.

// QUY TẮC VỀ "reason":
// - Giải thích NGẮN GỌN (1–2 câu) tại sao sản phẩm phù hợp.
// `;

//         const userPrompt = `
// Câu hỏi của khách: "${message}"

// Danh sách sản phẩm được cung cấp từ hệ thống (không được bịa thêm):
// ${JSON.stringify(products, null, 2)}
// `;

//         const raw = await this.callGemini(
//             [
//                 { text: systemPrompt },
//                 { text: userPrompt },
//             ],
//             0.4
//         );

//         console.log("Raw chatbot response (before parse):", raw);

//         const parsed = extractJsonObject(raw);

//         if (!parsed || !parsed.suggestions) {
//             console.warn("AI returned invalid JSON, fallback to empty suggestions.");
//             return { suggestions: [] };
//         }

//         return parsed;
//     }


    // ======================== 2. SENTIMENT ANALYSIS ========================
    async analyzeSentiment(text) {
        const systemPrompt = `
    Bạn là mô hình phân tích cảm xúc của khách hàng.
    Chỉ trả JSON theo dạng:
    {
      "sentiment": "positive" | "neutral" | "negative",
      "score": -1 đến 1,
      "summary": "string"
    }
    Không viết gì ngoài JSON.
    `;

        const userPrompt = `Review/feedback: "${text}"`;
        console.log("Sentiment analysis user prompt:", userPrompt);

        const raw = await this.callGemini(
            [
                { text: systemPrompt },
                { text: userPrompt },
            ],
            0.2
        );

        const extracted = extractJsonObject(raw);

        if (extracted) return extracted;

        return {
            sentiment: "neutral",
            score: 0,
            summary: "Không phân tích được.",
        };
    }


    // ======================== 3. TÌM SẢN PHẨM BẰNG ẢNH ========================
    async analyzeImage(imageBuffer) {
        const base64 = imageBuffer.toString("base64");

        const requestParts = [
            {
                text: "Hãy mô tả ảnh này, trả về danh sách TAGS dạng JSON:\n\n" +
                    `{"tags": ["tag1", "tag2"]}`
            },
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64,
                },
            },
        ];

        const resultText = await this.callGemini(requestParts, 0.2);

        try {
            return JSON.parse(resultText).tags;
        } catch {
            return [];
        }
    }

    async searchProductsByImage(imageBuffer) {
        const tags = await this.analyzeImage(imageBuffer);
        const products = await productRepository.searchByKeywords(tags);

        return {
            tags,
            products,
        };
    }

}
function extractJsonObject(raw) {
    if (!raw) return null;
    let cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return null;
    }
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON.parse failed, cleaned text:", cleaned);
        return null;
    }
}

module.exports = new AIService();
