// src/features/hoyoCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { GAME_CONFIG } = require("./hoyoScraper");
const { EMOJIS } = require("../../config/ids");

const GAME_EMBED_META = {
  genshin: {
    color: "#E6A23C",
    emojiId: EMOJIS.GENSHIN_LOGO || "1559502726985949184",
    emojiName: "Genshin_Impact",
    currencyEmoji: `<:primogems20:${EMOJIS.GENSHIN_PRIMO || "1559502712343896205"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.GENSHIN_LOGO || "1559502726985949184"}.png`,
  },
  hsr: {
    color: "#9C27B0",
    emojiId: EMOJIS.HSR_LOGO || "1559502723148415096",
    emojiName: "Honkai_Star_Rail_App",
    currencyEmoji: `<:stellarjade:${EMOJIS.HSR_JADE || "1559502715564982292"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.HSR_LOGO || "1559502723148415096"}.png`,
  },
  zzz: {
    color: "#FF9800",
    emojiId: EMOJIS.ZZZ_LOGO || "1559502720879173633",
    emojiName: "Zenless_Zone_Zero_App_Icon",
    currencyEmoji: `<:Item_Polychrome:${EMOJIS.ZZZ_POLY || "1559502718584750121"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.ZZZ_LOGO || "1559502720879173633"}.png`,
  },
};

/**
 * Định dạng phần thưởng kèm icon tiền tệ đặc trưng
 */
function formatRewards(rewardsText, currencyEmoji) {
  if (!rewardsText) return "Chưa có thông tin phần thưởng";
  const cleaned = rewardsText
    .replace(/^•\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .replace(/(Primogem|Nguyên Thạch)/gi, `${currencyEmoji} Primogem`)
    .replace(/(Stellar Jade|Ngọc Ánh Sao)/gi, `${currencyEmoji} Stellar Jade`)
    .replace(/(Polychrome|Phim Màu)/gi, `${currencyEmoji} Polychrome`);
}

/**
 * Tạo Discord Embed và Button cho mã code thường (Gọn gàng, không banner to)
 * @param {Object} codeObj
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createRegularCodeMessage(codeObj) {
  const gameKey = codeObj.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;

  const formattedRewards = formatRewards(codeObj.rewardsText, meta.currencyEmoji);
  const gameEmojiStr = `<:${meta.emojiName}:${meta.emojiId}>`;

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} Mã code mới cho ${config.name}!`)
    .setColor(meta.color)
    .setThumbnail(meta.iconUrl)
    .setDescription(
      `**${codeObj.code}**\n` +
      `[Nhấn để nhận](${codeObj.redeemUrl})\n` +
      `└ ${formattedRewards}\n\n` +
      `• Máy chủ: ${codeObj.server || "Tất cả"} | Trạng thái: ${codeObj.duration || "Còn hiệu lực"}`
    )
    .setFooter({
      text: `${config.name} • Giftcode Alert`,
      iconURL: meta.iconUrl,
    })
    .setTimestamp();

  // Nút bấm nhận quà nhanh kèm icon game
  const components = [];
  if (codeObj.redeemUrl) {
    const redeemBtn = new ButtonBuilder()
      .setLabel(`Nhận ${codeObj.code}`)
      .setStyle(ButtonStyle.Link)
      .setURL(codeObj.redeemUrl)
      .setEmoji(meta.emojiId);

    const row = new ActionRowBuilder().addComponents(redeemBtn);
    components.push(row);
  }

  return { embed, components };
}

/**
 * Tạo Discord Embed và Buttons cho Code Livestream Special Program (Kèm ảnh banner và link stream)
 * @param {Object} streamData
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createLivestreamCodeMessage(streamData) {
  const gameKey = streamData.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;

  const codes = streamData.codes || [streamData];
  const version = streamData.version || "Mới";
  const gameEmojiStr = `<:${meta.emojiName}:${meta.emojiId}>`;

  // Xây dựng danh sách code
  let codesText = "";
  codes.forEach((c, index) => {
    const rewards = formatRewards(c.rewardsText, meta.currencyEmoji);
    codesText += `Code ${index + 1}\n${c.code}\nPhần thưởng: ${rewards}\nHết hạn: ${c.duration || "Còn hiệu lực"}\n\n`;
  });

  const primaryRedeemUrl = codes[0]?.redeemUrl || config.redeemBaseUrl;

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} Code livestream ${config.name}`)
    .setColor("#FFD700")
    .setThumbnail(meta.iconUrl)
    .setDescription(
      `Phiên bản ${version} - Tìm thấy ${codes.length} code!\n\n` +
      `${codesText.trim()}\n\n` +
      `Nhận code tại đây\n` +
      `[Nhấn để nhận](${primaryRedeemUrl})\n\n` +
      `▶️ Official Livestream\n` +
      `🇬🇧 English: [Watch](${config.streamEn})\n` +
      `🇯🇵 日本語: [Watch](${config.streamJp})`
    )
    .setFooter({
      text: `${config.name} • Special Program Livestream`,
      iconURL: meta.iconUrl,
    })
    .setTimestamp();

  // Gắn banner Special Program nếu có
  if (streamData.bannerUrl || config.banner) {
    embed.setImage(streamData.bannerUrl || config.banner);
  }

  // Danh sách nút bấm (Mỗi code 1 button)
  const components = [];
  let currentRow = new ActionRowBuilder();

  codes.forEach((c, index) => {
    if (c.redeemUrl) {
      const label = codes.length === 1 ? `Nhận ${c.code}` : `Code ${index + 1}: ${c.code}`;
      const btn = new ButtonBuilder()
        .setLabel(label)
        .setStyle(ButtonStyle.Link)
        .setURL(c.redeemUrl)
        .setEmoji(meta.emojiId);

      if (currentRow.components.length >= 5) {
        components.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(btn);
    }
  });

  if (currentRow.components.length > 0) {
    components.push(currentRow);
  }

  return { embed, components };
}

/**
 * Điều phối tạo tin nhắn Giftcode HoYoverse tự động
 * @param {Object} data
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createHoyoCodeMessage(data) {
  if (data.isLivestream || Array.isArray(data.codes)) {
    return createLivestreamCodeMessage(data);
  }
  return createRegularCodeMessage(data);
}

module.exports = {
  createHoyoCodeMessage,
  createRegularCodeMessage,
  createLivestreamCodeMessage,
  GAME_EMBED_META,
};
