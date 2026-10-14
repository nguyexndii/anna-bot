// src/features/gachaUpdates/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { EMOJIS } = require("../../config/ids");

// Cấu hình hiển thị theo từng game
const GAME_FORUM_CONFIG = {
  hsr: {
    name: "Honkai: Star Rail",
    color: "#A855F7",
    tagId: "1559613997467045979",
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.HSR_LOGO || "1559502723148415096"}.png`,
    prefix: "[HSR]",
    defaultCurrencyEmoji: `<:stellarjade:${EMOJIS.HSR_JADE || "1559502715564982292"}>`,
    emojiPrefix: "hsr",
  },
  genshin: {
    name: "Genshin Impact",
    color: "#4AA8FF",
    tagId: "1559613791329591306",
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.GENSHIN_LOGO || "1559502726985949184"}.png`,
    prefix: "[Genshin]",
    defaultCurrencyEmoji: `<:primogems20:${EMOJIS.GENSHIN_PRIMO || "1559502712343896205"}>`,
    emojiPrefix: "gi",
  },
  zzz: {
    name: "Zenless Zone Zero",
    color: "#FF6B00",
    tagId: "1559614020372267029",
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.ZZZ_LOGO || "1559502720879173633"}.png`,
    prefix: "[ZZZ]",
    defaultCurrencyEmoji: `<:Item_Polychrome:${EMOJIS.ZZZ_POLY || "1559502718584750121"}>`,
    emojiPrefix: "zzz",
  },
  wuwa: {
    name: "Wuthering Waves",
    color: "#FFD700",
    tagId: "1559614044069961768",
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.WUWA_ICON || "1536322393411424286"}.png`,
    prefix: "[WuWa]",
    defaultCurrencyEmoji: `<:wuwa:${EMOJIS.WUWA_ICON || "1536322393411424286"}>`,
    emojiPrefix: "wuwa",
  },
  endfield: {
    name: "Arknights: Endfield",
    color: "#FFB800",
    tagId: "1559614082644967484",
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.ENDFIELD_LOGO || "1559559318309969970"}.png`,
    prefix: "[Endfield]",
    defaultCurrencyEmoji: `<:oroberyl:${EMOJIS.ENDFIELD_OROBERYL || "1559559314652528770"}>`,
    emojiPrefix: "ef",
  },
};

const { getGameEmoji } = require("../../utils/emojiHelper");

/**
 * Gắn các emoji chuẩn quen thuộc và tiền tệ đặc trưng của từng game vào bài viết tóm tắt
 */
function applyGameThemeEmojis(client, gameKey, text) {
  let formatted = text
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Phiên bản & Thời gian/gi, `\n📅 **Phiên bản & Thời gian`)
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Banner Nhân vật(?: & Vũ khí mới)?/gi, `\n🎯 **Banner Nhân vật & Vũ khí mới`)
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Cốt truyện & (?:Bản đồ|Khu vực)(?:\/Khu vực)?(?: mới)?/gi, `\n🗺️ **Cốt truyện & Bản đồ/Khu vực mới`)
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Sự kiện nổi bật(?: & Quà tặng)?/gi, `\n🎁 **Sự kiện nổi bật & Quà tặng`)
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Cải tiến tính năng(?:\s*\(QoL nổi bật\))?/gi, `\n⚙️ **Cải tiến tính năng (QoL nổi bật)`)
    .replace(/(?:^|\n)(?:•\s*)?(?:[^\w\s\n*]|<:[^>]+>)?\s*\*?\*?Đền bù bảo trì/gi, `\n✉️ **Đền bù bảo trì`);

  // Thay thế tiền tệ theo đúng từng game riêng biệt, tuyệt đối không lộn xộn giữa các game
  if (gameKey === "genshin") {
    formatted = formatted.replace(/(Primogem|Nguyên Thạch)/gi, `${getGameEmoji(client, 'gi_primo')} Nguyên Thạch`);
  } else if (gameKey === "hsr") {
    formatted = formatted.replace(/(Stellar Jade|Ngọc Ánh Sao)/gi, `${getGameEmoji(client, 'hsr_jade')} Ngọc Ánh Sao`);
  } else if (gameKey === "zzz") {
    formatted = formatted.replace(/(Polychrome|Phim Màu)/gi, `${getGameEmoji(client, 'zzz_poly')} Phim Màu`);
  } else if (gameKey === "wuwa") {
    formatted = formatted.replace(/(Astrite)/gi, `${getGameEmoji(client, 'wuwa_astrite')} Astrite`);
  } else if (gameKey === "endfield") {
    formatted = formatted.replace(/(Oroberyl)/gi, `${getGameEmoji(client, 'ef_oroberyl')} Oroberyl`);
  }

  return formatted.trim();
}

/**
 * Xây dựng payload để tạo bài đăng trong kênh Forum
 */
function buildForumPostPayload(client, updateData, summaryText) {
  const config = GAME_FORUM_CONFIG[updateData.game] || GAME_FORUM_CONFIG.genshin;
  const themedDesc = applyGameThemeEmojis(client, updateData.game, summaryText);

  // Tạo tiêu đề Thread ngắn gọn (tối đa 95 ký tự)
  let threadName = `${config.prefix} ${updateData.title}`.replace(/\s+/g, " ").trim();
  if (threadName.length > 95) {
    threadName = threadName.slice(0, 92) + "...";
  }

  const embed = new EmbedBuilder()
    .setTitle(updateData.title)
    .setColor(config.color)
    .setThumbnail(config.iconUrl)
    .setDescription(themedDesc)
    .setImage(updateData.bannerUrl)
    .setFooter({
      text: `${config.name} • Update Highlights & Patch Summary`,
      iconURL: config.iconUrl,
    })
    .setTimestamp(updateData.publishedAt || new Date());

  const components = [];
  if (updateData.postUrl) {
    const linkBtn = new ButtonBuilder()
      .setLabel(updateData.btnText || "Xem bài gốc")
      .setStyle(ButtonStyle.Link)
      .setURL(updateData.postUrl);

    components.push(new ActionRowBuilder().addComponents(linkBtn));
  }

  return {
    threadName,
    appliedTags: config.tagId ? [config.tagId] : [],
    message: {
      embeds: [embed],
      components,
      flags: [MessageFlags.SuppressNotifications], // Silent post (không ting ting)
    },
  };
}

module.exports = {
  buildForumPostPayload,
  GAME_FORUM_CONFIG,
};
