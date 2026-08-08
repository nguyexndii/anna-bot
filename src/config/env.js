// src/config/env.js
const { ADMIN_IDS, CHANNELS, ROLES } = require("./ids");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

module.exports = {
  DISCORD_TOKEN,
  APPLICATION_ID,

  // Admin & IDs from ids.js
  ADMIN_IDS,
  ADMIN_ID: ADMIN_IDS[0], // Main admin ID

  // Role IDs
  TEMP_ROLE_ID: ROLES.TEMP_ROLE,
  PERMANENT_ROLE_ID: ROLES.PERMANENT_ROLE,

  // Channel IDs
  GENERAL_CHAT_CHANNEL_ID: CHANNELS.GENERAL_CHAT,
  IMAGE_UPLOAD_CHANNEL_ID: CHANNELS.IMAGE_UPLOAD,
  AI_CHANNELS: CHANNELS.AI_CHAT,
  WORDCHAIN_CHANNEL_ID: CHANNELS.WORDCHAIN,
  RULES_CHANNEL_ID: CHANNELS.RULES,

  // Gemini config (Model: gemini-3.1-flash-lite)
  GEMINI_API_KEYS: (process.env.GEMINI_API_KEYS || "").split(","),
  GEMINI_MODEL_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=",

  // Webhooks
  WEBHOOK_WORDCHAIN: process.env.WEBHOOK_WORDCHAIN,
  WEBHOOKS: {
    HAPPY: process.env.WEBHOOK_HAPPY,
    PLAYFUL: process.env.WEBHOOK_PLAYFUL,
    THINKING: process.env.WEBHOOK_THINKING,
    ANGRY: process.env.WEBHOOK_ANGRY,
    WORDCHAIN: process.env.WEBHOOK_WORDCHAIN,
  },
};
