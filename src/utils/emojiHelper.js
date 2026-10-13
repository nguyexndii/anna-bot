// src/utils/emojiHelper.js
const { EMOJIS } = require("../config/ids");

// Bảng ánh xạ ID tĩnh dự phòng
const STATIC_FALLBACK_IDS = {
  // Genshin
  gi_logo: EMOJIS.GENSHIN_LOGO || "1559502726985949184",
  gi_primo: EMOJIS.GENSHIN_PRIMO || "1559502712343896205",
  // HSR
  hsr_logo: EMOJIS.HSR_LOGO || "1559502723148415096",
  hsr_jade: EMOJIS.HSR_JADE || "1559502715564982292",
  // ZZZ
  zzz_logo: EMOJIS.ZZZ_LOGO || "1559502720879173633",
  zzz_poly: EMOJIS.ZZZ_POLY || "1559502718584750121",
  // WuWa
  wuwa_logo: EMOJIS.WUWA_ICON || "1536322393411424286",
  wuwa_astrite: EMOJIS.WUWA_ICON || "1536322393411424286",
  // Endfield
  ef_logo: EMOJIS.ENDFIELD_LOGO || "1559559318309969970",
  ef_oroberyl: EMOJIS.ENDFIELD_OROBERYL || "1559559314652528770",
};

/**
 * Lấy Custom Emoji theo tên, ưu tiên Application Emojis mới tải lên
 * @param {import("discord.js").Client} client
 * @param {string} emojiName Tên emoji (ví dụ: 'gi_primo', 'hsr_jade', 'wuwa_gift'...)
 * @param {string} fallbackEmoji Ký tự emoji dự phòng (ví dụ: '🎁', '💎'...)
 * @returns {string}
 */
function getGameEmoji(client, emojiName, fallbackEmoji = "") {
  if (client) {
    // 1. Tìm trong Application Emojis của Bot
    const appEmoji = client.application?.emojis?.cache?.find((e) => e.name === emojiName);
    if (appEmoji) {
      return `<:${appEmoji.name}:${appEmoji.id}>`;
    }

    // 2. Tìm trong Guild Cache của Client
    const guildEmoji = client.emojis?.cache?.find((e) => e.name === emojiName);
    if (guildEmoji) {
      return `<:${guildEmoji.name}:${guildEmoji.id}>`;
    }
  }

  // 3. Fallback sang ID tĩnh trong config nếu có
  if (STATIC_FALLBACK_IDS[emojiName]) {
    return `<:${emojiName}:${STATIC_FALLBACK_IDS[emojiName]}>`;
  }

  return fallbackEmoji;
}

module.exports = {
  getGameEmoji,
  STATIC_FALLBACK_IDS,
};
