// src/features/gachaUpdates/aiSummarizer.js
const axios = require("axios");
const { GEMINI_API_KEYS } = require("../../config/env");

const MODELS = [
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=",
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=",
];

let currentKeyIndex = 0;

/**
 * Xoay vòng lấy API key tiếp theo
 */
function getNextApiKey() {
  if (!GEMINI_API_KEYS || GEMINI_API_KEYS.length === 0) {
    throw new Error("Không tìm thấy GEMINI_API_KEYS trong cấu hình!");
  }
  const key = GEMINI_API_KEYS[currentKeyIndex % GEMINI_API_KEYS.length];
  currentKeyIndex++;
  return key;
}

/**
 * Gọi Gemini tóm tắt bản cập nhật game (Dung lượng 1200 - 1800 ký tự)
 * @param {string} gameKey ('hsr', 'genshin', 'zzz', 'wuwa', 'endfield')
 * @param {string} title Tiêu đề bài viết
 * @param {string} rawContent Nội dung bài viết gốc
 * @returns {Promise<string>}
 */
async function summarizeGameUpdate(gameKey, title, rawContent) {
  const gameNames = {
    hsr: "Honkai: Star Rail",
    genshin: "Genshin Impact",
    zzz: "Zenless Zone Zero",
    wuwa: "Wuthering Waves",
    endfield: "Arknights: Endfield",
  };

  const gameName = gameNames[gameKey] || gameKey;

  const prompt = `Bạn là một biên tập viên tin tức game Gacha chuyên nghiệp.
Nhiệm vụ của bạn là đọc nội dung bài viết cập nhật dưới đây của tựa game "${gameName}" và tóm tắt thành một bài đăng Discord đầy đủ, hấp dẫn, chuẩn xác (dung lượng khoảng 1200 - 1800 ký tự).

QUY TẮC BẮT BUỘC:
1. KHÔNG viết các câu chào hỏi thừa ở đầu (như "Chào mừng các bạn", "Tuyệt vời...", "Biên tập viên đây..."). Vào thẳng nội dung chính.
2. KHÔNG viết các hashtag đuôi bài (như #Genshin #HSR).
3. Sử dụng đúng thuật ngữ tiếng Việt chính thức của game:
   - Genshin: Nguyên Thạch, Mối Duyên Vương Vấn/Tương Ngộ, Thánh Di Vật, Ma Thần, Nhựa Nguyên Bản.
   - HSR: Ngọc Ánh Sao, Vé Tinh Cầu Đặc Biệt, Nón Ánh Sáng, Khai Phá, Bước Nhảy.
   - ZZZ: Phim Màu (Polychrome), Băng Ghi Hình Mã Hóa, W-Engine, Người Đại Diện, Lỗ Hổng Hollow, Proxy.
   - WuWa: Astrite, Thủy Triều Rạng Rỡ/Đúc Rèn, Resonator, Echo, Waveplate, Rover.
   - Endfield: Oroberyl, T-Credits, Operator, Hệ thống công nghiệp AIC, Blueprint, SKPORT.
4. Bố cục bài viết gồm các mục sau (dùng Markdown in đậm và gạch đầu dòng rõ ràng):
   - **Phiên bản & Thời gian:** Tên bản cập nhật, thời gian bảo trì hoặc thời gian ra mắt.
   - **Banner Nhân vật & Vũ khí mới:** Nêu rõ tên nhân vật mới (số sao, hệ/vai trò) và vũ khí trấn.
   - **Cốt truyện & Bản đồ/Khu vực mới:** Tóm tắt nhiệm vụ chính tuyến và vùng đất mới mở.
   - **Sự kiện nổi bật & Quà tặng:** Các sự kiện chính và tổng tài nguyên/vé nhận được.
   - **Cải tiến tính năng (QoL nổi bật):** Giải thích rõ tính năng mới giúp ích gì cho người chơi.
   - **Đền bù bảo trì:** Lượng đá/vé đền bù được gửi qua hòm thư trong game.

TIÊU ĐỀ: ${title}
NỘI DUNG GỐC:
${(rawContent || "").slice(0, 15000)}
`;

  // Thử lần lượt với các key và fallback model
  for (let attempt = 0; attempt < 3; attempt++) {
    const apiKey = getNextApiKey();
    const modelUrl = MODELS[attempt % MODELS.length];

    try {
      const response = await axios.post(
        `${modelUrl}${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingBudget: 0 },
          },
        },
        { timeout: 35000 }
      );

      const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (resultText && resultText.trim().length > 50) {
        return resultText.trim();
      }
    } catch (err) {
      console.warn(`[GachaUpdates] Lần thử ${attempt + 1} tóm tắt (${gameKey}) lỗi: ${err.response?.status || err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Fallback an toàn nếu API quá tải
  return `### Chi tiết bản cập nhật mới cho ${gameName}\n\n• **Tiêu đề:** ${title}\n• **Thông tin:** Nhà phát hành đã chính thức phát hành bản cập nhật mới. Vui lòng nhấn nút bên dưới để xem toàn bộ thông tin chi tiết trên trang chính thức!`;
}

module.exports = {
  summarizeGameUpdate,
};
