// src/features/hoyoCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { GAME_CONFIG } = require("./hoyoScraper");

const GAME_EMBED_META = {
  genshin: {
    titlePrefix: "🎁 GENSHIN IMPACT — MÃ ĐỔI THƯỞNG",
    color: "#E6A23C",
    footerText: "Genshin Impact • Giftcode Alert",
    emoji: "✨",
  },
  hsr: {
    titlePrefix: "🌌 HONKAI: STAR RAIL — MÃ ĐỔI THƯỞNG",
    color: "#9C27B0",
    footerText: "Honkai: Star Rail • Giftcode Alert",
    emoji: "⭐",
  },
  zzz: {
    titlePrefix: "⚡ ZENLESS ZONE ZERO — MÃ ĐỔI THƯỞNG",
    color: "#FF9800",
    footerText: "Zenless Zone Zero • Giftcode Alert",
    emoji: "🔋",
  },
};

/**
 * Tạo Discord Embed và Button cho 1 mã code HoYoverse
 * @param {Object} codeObj
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createHoyoCodeMessage(codeObj) {
  const gameKey = codeObj.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;

  const embed = new EmbedBuilder()
    .setTitle(meta.titlePrefix)
    .setColor(meta.color)
    .setThumbnail(config.icon)
    .setDescription(
      `### \`${codeObj.code}\`\n\n` +
      `**Phần thưởng:**\n${codeObj.rewardsText || "• Chưa có thông tin phần thưởng"}\n\n` +
      `**Máy chủ:** \`${codeObj.server || "All"}\` | **Thời hạn:** \`${codeObj.duration || "Còn hiệu lực"}\``
    )
    .setFooter({
      text: meta.footerText,
      iconURL: config.icon,
    })
    .setTimestamp();

  // Nút bấm One-click Redeem (mỗi code 1 button link)
  const components = [];
  if (codeObj.redeemUrl) {
    const redeemButton = new ButtonBuilder()
      .setLabel(`Nhập Code ${config.name} Nhanh`)
      .setStyle(ButtonStyle.Link)
      .setURL(codeObj.redeemUrl)
      .setEmoji("🎁");

    const row = new ActionRowBuilder().addComponents(redeemButton);
    components.push(row);
  }

  return { embed, components };
}

module.exports = {
  createHoyoCodeMessage,
  GAME_EMBED_META,
};
