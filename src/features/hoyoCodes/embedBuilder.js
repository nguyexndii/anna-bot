// src/features/hoyoCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { GAME_CONFIG } = require("./hoyoScraper");
const { EMOJIS } = require("../../config/ids");

const GAME_EMBED_META = {
  genshin: {
    titlePrefix: "🎁 GENSHIN IMPACT — MÃ ĐỔI THƯỞNG",
    color: "#E6A23C",
    footerText: "Genshin Impact • Giftcode Alert",
    logoEmoji: `<:Genshin_Impact:${EMOJIS.GENSHIN_LOGO || "1559502726985949184"}>`,
    currencyEmoji: `<:primogems20:${EMOJIS.GENSHIN_PRIMO || "1559502712343896205"}>`,
  },
  hsr: {
    titlePrefix: "🌌 HONKAI: STAR RAIL — MÃ ĐỔI THƯỞNG",
    color: "#9C27B0",
    footerText: "Honkai: Star Rail • Giftcode Alert",
    logoEmoji: `<:Honkai_Star_Rail_App:${EMOJIS.HSR_LOGO || "1559502723148415096"}>`,
    currencyEmoji: `<:stellarjade:${EMOJIS.HSR_JADE || "1559502715564982292"}>`,
  },
  zzz: {
    titlePrefix: "⚡ ZENLESS ZONE ZERO — MÃ ĐỔI THƯỞNG",
    color: "#FF9800",
    footerText: "Zenless Zone Zero • Giftcode Alert",
    logoEmoji: `<:Zenless_Zone_Zero_App_Icon:${EMOJIS.ZZZ_LOGO || "1559502720879173633"}>`,
    currencyEmoji: `<:Item_Polychrome:${EMOJIS.ZZZ_POLY || "1559502718584750121"}>`,
  },
};

/**
 * Định dạng phần thưởng kèm icon tiền tệ đặc trưng
 */
function formatRewards(rewardsText, currencyEmoji) {
  if (!rewardsText) return `${currencyEmoji} Quà tặng sự kiện`;
  // Nếu có đề cập đến loại tiền tệ chính, chèn thêm icon
  return rewardsText
    .replace(/(Primogem|Nguyên Thạch)/gi, `${currencyEmoji} Primogem`)
    .replace(/(Stellar Jade|Ngọc Ánh Sao)/gi, `${currencyEmoji} Stellar Jade`)
    .replace(/(Polychrome|Phim Màu)/gi, `${currencyEmoji} Polychrome`);
}

/**
 * Tạo Discord Embed và Button cho 1 mã code HoYoverse
 * @param {Object} codeObj
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createHoyoCodeMessage(codeObj) {
  const gameKey = codeObj.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;

  const formattedRewards = formatRewards(codeObj.rewardsText, meta.currencyEmoji);

  const embed = new EmbedBuilder()
    .setTitle(meta.titlePrefix)
    .setColor(meta.color)
    .setThumbnail(config.icon)
    .setDescription(
      `### ${meta.logoEmoji} \`${codeObj.code}\`\n\n` +
      `**Phần thưởng:**\n${formattedRewards}\n\n` +
      `**Máy chủ:** \`${codeObj.server || "All"}\` | **Trạng thái:** \`${codeObj.duration || "Còn hiệu lực"}\`\n\n` +
      `🔗 **Nhận code trực tiếp tại đây:**\n[👉 Nhấn để nhận quà](${codeObj.redeemUrl})\n\n` +
      `▶️ **Official Livestream:**\n🇬🇧 [English Stream](${config.streamEn}) | 🇯🇵 [日本語 Stream](${config.streamJp})`
    )
    .setImage(config.banner)
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

