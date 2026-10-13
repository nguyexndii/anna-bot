// src/features/gachaUpdates/aiSummarizer.js
const axios = require("axios");
const { GEMINI_API_KEYS } = require("../../config/env");

/**
 * Danh sách model xếp theo thứ bậc từ mạnh nhất đến tiết kiệm:
 * - Bậc 1 (Flash cao cấp, 20 RPD/key x 4 keys = 80 RPD):
 *   1. gemini-3.8-flash (Mạnh nhất, thông minh nhất)
 *   2. gemini-3-flash-preview (Phản hồi cực nhanh ~2.8s)
 *   3. gemini-3.5-flash
 * - Bậc 2 (Flash Lite cứu cánh, 500 RPD/key x 4 keys = 2000 RPD):
 *   4. gemini-3.5-flash-lite (Tiết kiệm, hạn ngạch 500 RPD)
 *   5. gemini-3.1-flash-lite (Rất ổn định, không bị lỗi)
 */
const HIERARCHICAL_MODELS = [
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
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
Nhiệm vụ của bạn là đọc nội dung bài viết cập nhật dưới đây của tựa game "${gameName}" và tóm tắt thành một bài đăng Discord ĐẦY ĐỦ, CHI TIẾT, HẤP DẪN (dung lượng khoảng 1200 - 1800 ký tự). TUYỆT ĐỐI không viết vắn tắt hay cụt lủn. Phải viết trọn vẹn tất cả 6 mục sau:

QUY TẮC BẮT BUỘC:
1. KHÔNG viết các câu chào hỏi mở đầu (như "Chào mừng các bạn", "Tuyệt vời...", "Biên tập viên xin chào..."). Đi thẳng vào nội dung chính.
2. KHÔNG chèn hashtag ở cuối bài (như #Genshin #HSR).
3. Sử dụng đúng thuật ngữ tiếng Việt chính thức của game:
   - Genshin: Nguyên Thạch, Mối Duyên Vương Vấn/Tương Ngộ, Thánh Di Vật, Ma Thần, Nhựa Nguyên Bản.
   - HSR: Ngọc Ánh Sao, Vé Tinh Cầu Đặc Biệt, Nón Ánh Sáng, Khai Phá, Bước Nhảy.
   - ZZZ: Phim Màu (Polychrome), Băng Ghi Hình Mã Hóa, W-Engine, Người Đại Diện, Lỗ Hổng Hollow, Proxy.
   - WuWa: Astrite, Thủy Triều Rạng Rỡ/Đúc Rèn, Resonator, Echo, Waveplate, Rover.
   - Endfield: Oroberyl, T-Credits, Operator, Hệ thống công nghiệp AIC, Blueprint, SKPORT.
4. Bố cục bài viết bắt buộc phải có đầy đủ 6 mục sau (dùng Markdown in đậm và gạch đầu dòng chi tiết):
   - **Phiên bản & Thời gian:** Tên bản cập nhật, thời gian bảo trì hoặc thời gian ra mắt.
   - **Banner Nhân vật & Vũ khí mới:** Nêu rõ tên nhân vật mới (số sao, hệ/vai trò) và vũ khí trấn.
   - **Cốt truyện & Bản đồ/Khu vực mới:** Tóm tắt chi tiết nhiệm vụ chính tuyến và vùng đất mới mở.
   - **Sự kiện nổi bật & Quà tặng:** Các sự kiện chính và tổng tài nguyên/vé nhận được.
   - **Cải tiến tính năng (QoL nổi bật):** Giải thích rõ tính năng mới giúp ích gì cho người chơi.
   - **Đền bù bảo trì:** Lượng tài nguyên/vé đền bù được gửi qua hòm thư trong game.

TIÊU ĐỀ: ${title}
NỘI DUNG GỐC:
${(rawContent || "").slice(0, 15000)}
`;

  // Thử lần lượt từ model mạnh nhất đến nhẹ hơn
  for (const model of HIERARCHICAL_MODELS) {
    for (let keyAttempt = 0; keyAttempt < GEMINI_API_KEYS.length; keyAttempt++) {
      const apiKey = getNextApiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4000,
            },
          },
          { timeout: 35000 }
        );

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText && resultText.trim().length > 300) {
          console.log(`[GachaUpdates] ✨ Tóm tắt thành công bài [${gameKey}] bằng model: ${model} (${resultText.trim().length} ký tự)`);
          return resultText.trim();
        }
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        console.warn(`[GachaUpdates] Thử model ${model} (Key #${(currentKeyIndex - 1) % GEMINI_API_KEYS.length}) gặp lỗi ${status || msg}`);

        // Nếu model bị 503 (máy chủ Google quá tải) hoặc 404 (không tồn tại), đổi ngay sang model khác
        if (status === 503 || status === 404) {
          break;
        }
        // Nếu lỗi 429 (hết quota key đó), tiếp tục vòng lặp để thử key kế tiếp của model này
      }
    }
  }

  // Fallback an toàn (chỉ dùng khi toàn bộ model và 4 key đều không phản hồi)
  return `### Chi tiết bản cập nhật mới cho ${gameName}\n\n• **Phiên bản & Thời gian:** Bản cập nhật mới nhất đã chính thức ra mắt.\n• **Nội dung chính:** ${title}\n• **Hướng dẫn:** Xem toàn bộ bài viết chi tiết và hướng dẫn sự kiện tại liên kết bên dưới.`;
}

module.exports = {
  summarizeGameUpdate,
  HIERARCHICAL_MODELS,
};
