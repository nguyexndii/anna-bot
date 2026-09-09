require("dotenv").config();
const { ADMIN_IDS: DEFAULT_ADMIN_IDS, CHANNELS, ROLES, EMOJIS } = require("./ids");

const STAFF_CHANNEL = process.env.STAFF_CHANNEL_ID || "1447095306079698984";

const ADMIN_IDS = (process.env.ADMIN_IDS || process.env.OWNER_DISCORD_ID || "875358286487097395,1028387082987114516")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const ALLOWED_GUILD_IDS = (process.env.ALLOWED_GUILD_IDS || "1389834422773219338,1542241154014249102")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/* =========================================================================
 * CẤU HÌNH KÊNH: CHÍNH THỨC (PROD) VS DÙNG ĐỂ TEST (TEST MODE)
 * ========================================================================= */
const PROD_CHANNELS = {
  WORDCHAIN: "1450065511231520778",      // Kênh Nối Từ chính
  WORDSCRAMBLE: "1535705241620717720",   // Kênh Sắp Xếp Từ chính
  WUWA_CODES: "1528768068581457930",     // Kênh Săn Code WuWa chính
  RULES: "1450073214620405903",          // Kênh Luật chơi chính
};

const TEST_CHANNELS = {
  WORDCHAIN: "1547083697688285255",      // Kênh Nối Từ test
  WORDSCRAMBLE: "1547083889124573184",   // Kênh Sắp Xếp Từ test
  WUWA_CODES: "1547084091868844142",     // Kênh Săn Code WuWa test
  RULES: "1547083697688285255",          // Kênh Luật chơi khi test
};

// Chế độ TEST (Mặc định false để chạy kênh chính khi deploy Render; chỉ bật true khi cần test)
const IS_TEST_MODE = process.env.IS_TEST_MODE === "true";

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  APPLICATION_ID: process.env.APPLICATION_ID,
  MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
  STAFF_CHANNEL_ID: STAFF_CHANNEL,

  // Test mode flag & Channel configs
  IS_TEST_MODE,
  PROD_CHANNELS,
  TEST_CHANNELS,

  // Admin & IDs
  ADMIN_IDS,
  ADMIN_ID: ADMIN_IDS[0] || "875358286487097395",
  OWNER_IDS: ADMIN_IDS,
  ALLOWED_GUILD_IDS,

  // Active Channel IDs (Tự động chuyển đổi giữa Test và Production)
  WORDCHAIN_CHANNEL_ID: IS_TEST_MODE ? TEST_CHANNELS.WORDCHAIN : PROD_CHANNELS.WORDCHAIN,
  WORDSCRAMBLE_CHANNEL_ID: IS_TEST_MODE ? TEST_CHANNELS.WORDSCRAMBLE : PROD_CHANNELS.WORDSCRAMBLE,
  RULES_CHANNEL_ID: IS_TEST_MODE ? TEST_CHANNELS.RULES : PROD_CHANNELS.RULES,
  WUWA_CODES_CHANNEL_ID: IS_TEST_MODE ? TEST_CHANNELS.WUWA_CODES : PROD_CHANNELS.WUWA_CODES,
  WUWA_ROLE_ID: process.env.WUWA_ROLE_ID || (ROLES && ROLES.WUWA_ROLE) || null,
  WUWA_EMOJI_ID: (EMOJIS && EMOJIS.WUWA_ICON) || "1536322393411424286",

  // Gemini config (Model: gemini-3.1-flash-lite)
  GEMINI_API_KEYS: (process.env.GEMINI_API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean),
  GEMINI_MODEL_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=",

  // Webhooks
  WEBHOOK_WORDCHAIN: process.env.WEBHOOK_WORDCHAIN,
  WEBHOOK_WORDSCRAMBLE: process.env.WEBHOOK_WORDSCRAMBLE,
  WEBHOOK_WUWA_CODES: process.env.WEBHOOK_WUWA_CODES,
  WEBHOOKS: {
    HAPPY: process.env.WEBHOOK_HAPPY,
    PLAYFUL: process.env.WEBHOOK_PLAYFUL,
    THINKING: process.env.WEBHOOK_THINKING,
    ANGRY: process.env.WEBHOOK_ANGRY,
    WORDCHAIN: process.env.WEBHOOK_WORDCHAIN,
    WORDSCRAMBLE: process.env.WEBHOOK_WORDSCRAMBLE,
    WUWA_CODES: process.env.WEBHOOK_WUWA_CODES,
  },
};
