require("dotenv").config();

// Kênh Staff dùng tạm để gom tất cả thông báo tự động (tránh spam kênh chính khi test local)
const STAFF_CHANNEL = process.env.STAFF_CHANNEL_ID || "1447095306079698984";

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  MONGO_URI: process.env.MONGO_URI,
  STAFF_CHANNEL_ID: STAFF_CHANNEL,

  // Kênh Nối Từ
  WORDCHAIN_CHANNEL_ID: process.env.WORDCHAIN_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Sắp Xếp Từ
  WORDSCRAMBLE_CHANNEL_ID: process.env.WORDSCRAMBLE_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Nội Quy
  RULES_CHANNEL_ID: process.env.RULES_CHANNEL_ID || STAFF_CHANNEL,

  // Kênh Săn Code Wuthering Waves
  WUWA_CODES_CHANNEL_ID: process.env.WUWA_CODES_CHANNEL_ID || STAFF_CHANNEL,
  WUWA_ROLE_ID: process.env.WUWA_ROLE_ID || null,

  WEBHOOK_WORDCHAIN_ID: process.env.WEBHOOK_WORDCHAIN_ID,
  WEBHOOK_WORDCHAIN_TOKEN: process.env.WEBHOOK_WORDCHAIN_TOKEN,
  WEBHOOK_WORDSCRAMBLE_ID: process.env.WEBHOOK_WORDSCRAMBLE_ID,
  WEBHOOK_WORDSCRAMBLE_TOKEN: process.env.WEBHOOK_WORDSCRAMBLE_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || "http://localhost:5173/",

  // Security & Owner Config
  JWT_SECRET: process.env.JWT_SECRET || "anna_bot_secret_jwt_key_2026_super_secure",
  OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID || "1028387082987114516"
};
