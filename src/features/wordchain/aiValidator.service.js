// src/features/wordchain/aiValidator.service.js
const { GEMINI_API_KEYS, GEMINI_MODEL_URL } = require("../../config/env");

let currentKeyIndex = 0;

/**
 * Get next API key in Round-Robin order
 */
function getNextApiKey() {
  if (!GEMINI_API_KEYS || GEMINI_API_KEYS.length === 0) return "";
  const key = GEMINI_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
}

/**
 * Call Gemini API with Multi-Key Rotation & Automatic Fallback Retry
 * If Key 1 fails (HTTP 429/403), it automatically retries with Key 2, Key 3...
 * @param {string} prompt 
 * @param {number} temperature 
 * @returns {Promise<object|null>}
 */
async function callGeminiApi(prompt, temperature = 0.1) {
  if (!GEMINI_API_KEYS || GEMINI_API_KEYS.length === 0) {
    console.error("❌ Không tìm thấy GEMINI_API_KEYS trong .env");
    return null;
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    },
  };

  const totalKeys = GEMINI_API_KEYS.length;
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const apiKey = getNextApiKey();
    if (!apiKey) continue;

    const url = `${GEMINI_MODEL_URL}${apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      console.warn(`⚠️ Gemini Key [${apiKey.slice(0, 8)}...] trả về HTTP ${response.status}. Đang chuyển Key tiếp theo...`);
    } catch (err) {
      console.error(`❌ Lỗi gọi Gemini với Key [${apiKey.slice(0, 8)}...]:`, err.message);
    }
  }

  return null;
}

/**
 * Ask Gemini 3.1 Flash Lite if a 2-word Vietnamese phrase is valid (Strict verification)
 * @param {string} firstWord 
 * @param {string} secondWord 
 * @returns {Promise<{valid: boolean, explanation: string}>}
 */
async function verifyWordWithAI(firstWord, secondWord) {
  const phrase = `${firstWord.trim()} ${secondWord.trim()}`;
  const prompt = `Bạn là Trọng tài Ngôn ngữ Tiếng Việt nghiêm túc và chuẩn mực cho trò chơi Nối Từ.
Nhiệm vụ: Thẩm định xem cụm 2 từ "${phrase}" (nối từ "${firstWord}" sang "${secondWord}") có phải là một từ hoặc cụm từ tiếng Việt 2 tiếng thực sự có nghĩa rõ ràng, nghiêm túc và được công nhận trong từ điển hoặc đời sống văn minh hay không.

QUY TẮC NGHIÊM NGẠC:
1. TUYỆT ĐỐI KHÔNG duyệt các từ cợt nhả, thô tục, chửi thề, từ nhảm nhí hoặc teencode cố tình ghép chữ vô nghĩa.
2. Cụm từ phải mang ý nghĩa tiếng Việt rõ ràng, đúng ngữ pháp hoặc cụm từ ghép chuẩn được sử dụng rộng rãi.
3. Nếu là ghép 2 từ ngẫu nhiên không tạo thành cụm từ có nghĩa (ví dụ: "xe gà", "bàn bún"), phải trả về "valid": false.

Bắt buộc trả về đúng định dạng JSON:
{
  "valid": true hoặc false,
  "explanation": "Lý do ngắn gọn 1 câu"
}`;

  const data = await callGeminiApi(prompt, 0.1);
  if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    try {
      const resultText = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(resultText);
      console.log(`✨ Trọng tài Thẩm định "${phrase}": valid=${parsed.valid} (${parsed.explanation})`);
      return {
        valid: Boolean(parsed.valid),
        explanation: parsed.explanation || "",
      };
    } catch (e) {
      console.error("❌ Lỗi parse JSON từ Gemini:", e.message);
    }
  }

  return { valid: false, explanation: "Hệ thống không thể thẩm định" };
}

/**
 * Get system hint for next words starting with expectedWord (with double verification)
 * @param {string} expectedWord 
 * @returns {Promise<string[]>} List of 3 suggested words
 */
async function getAIHint(expectedWord) {
  const prompt = `Trong trò chơi Nối Từ tiếng Việt, từ tiếp theo phải BẮT ĐẦU bằng từ "${expectedWord}".
Hãy gợi ý 3 cụm từ 2 tiếng tiếng Việt CHUẨN MỰC, RÕ NGHĨA bắt đầu bằng "${expectedWord}".
Nếu từ "${expectedWord}" là từ vô nghĩa, từ cụt hoặc không thể ghép thành cụm từ có nghĩa, hãy trả về mảng rỗng: {"suggestions": []}

Bắt buộc trả về đúng định dạng JSON:
{
  "suggestions": ["từ 1", "từ 2", "từ 3"]
}`;

  const data = await callGeminiApi(prompt, 0.2);
  if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    try {
      const text = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      const rawSuggestions = parsed.suggestions || [];

      // Double-check hints to make sure every hint is 100% valid before sending
      const verifiedSuggestions = [];
      for (const hint of rawSuggestions) {
        const secondWord = hint.split(/\s+/).pop() || hint;
        const check = await verifyWordWithAI(expectedWord, secondWord);
        if (check.valid) {
          verifiedSuggestions.push(secondWord);
        }
      }
      return verifiedSuggestions;
    } catch (e) {
      console.error("❌ Lỗi parse JSON getAIHint:", e.message);
    }
  }

  return [];
}

module.exports = {
  callGeminiApi,
  verifyWordWithAI,
  getAIHint,
};
