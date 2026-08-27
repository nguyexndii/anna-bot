require("dotenv").config();

// Kênh Staff dùng tạm để gom tất cả thông báo tự động (tránh spam kênh chính khi test local)
const STAFF_CHANNEL = process.env.STAFF_CHANNEL_ID || "1447095306079698984";

/* =========================================================================
 * DANH SÁCH KÊNH GỐC (DÙNG ĐỂ KHÔI PHỤC KHI CHẠY CHÍNH THỨC):
 * - Kênh Nội Quy & Nối Từ Gốc: "1450073214620405903"
 * - Kênh Sắp Xếp Từ Gốc:       "1535705241620717720"
 * - Kênh WuWa Code Gốc:        "1447095306079698984"
 * ========================================================================= */

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  MONGO_URI: process.env.MONGO_URI,
  STAFF_CHANNEL_ID: STAFF_CHANNEL,

  // Kênh Nối Từ (Hiện đang trỏ về Staff Channel để test. Khi bật lại đổi thành: "1450073214620405903")
  WORDCHAIN_CHANNEL_ID: process.env.WORDCHAIN_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Sắp Xếp Từ (Hiện đang trỏ về Staff Channel để test. Khi bật lại đổi thành: "1535705241620717720")
  WORDSCRAMBLE_CHANNEL_ID: process.env.WORDSCRAMBLE_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Nội Quy (Hiện đang trỏ về Staff Channel để test. Khi bật lại đổi thành: "1450073214620405903")
  RULES_CHANNEL_ID: process.env.RULES_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Săn Code Wuthering Waves (Mặc định trỏ về Staff Channel)
  WUWA_CODES_CHANNEL_ID: process.env.WUWA_CODES_CHANNEL_ID || STAFF_CHANNEL,
  WUWA_ROLE_ID: process.env.WUWA_ROLE_ID || null,

  WEBHOOK_WORDCHAIN_ID: process.env.WEBHOOK_WORDCHAIN_ID,
  WEBHOOK_WORDCHAIN_TOKEN: process.env.WEBHOOK_WORDCHAIN_TOKEN,
  WEBHOOK_WORDSCRAMBLE_ID: process.env.WEBHOOK_WORDSCRAMBLE_ID,
  WEBHOOK_WORDSCRAMBLE_TOKEN: process.env.WEBHOOK_WORDSCRAMBLE_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || "http://localhost:5173/"
};
