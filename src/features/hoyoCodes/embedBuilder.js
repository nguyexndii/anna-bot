// src/features/hoyoCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { GAME_CONFIG } = require("./hoyoScraper");
const { EMOJIS } = require("../../config/ids");
const { getGameEmoji } = require("../../utils/emojiHelper");

const GAME_EMBED_META = {
  genshin: {
    color: "#E6A23C",
    prefix: "gi",
    emojiId: EMOJIS.GENSHIN_LOGO || "1559502726985949184",
    emojiName: "Genshin_Impact",
    currencyEmojiName: "gi_primo",
    defaultCurrencyEmoji: `<:primogems20:${EMOJIS.GENSHIN_PRIMO || "1559502712343896205"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.GENSHIN_LOGO || "1559502726985949184"}.png`,
  },
  hsr: {
    color: "#9C27B0",
    prefix: "hsr",
    emojiId: EMOJIS.HSR_LOGO || "1559502723148415096",
    emojiName: "Honkai_Star_Rail_App",
    currencyEmojiName: "hsr_jade",
    defaultCurrencyEmoji: `<:stellarjade:${EMOJIS.HSR_JADE || "1559502715564982292"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.HSR_LOGO || "1559502723148415096"}.png`,
  },
  zzz: {
    color: "#FF9800",
    prefix: "zzz",
    emojiId: EMOJIS.ZZZ_LOGO || "1559502720879173633",
    emojiName: "Zenless_Zone_Zero_App_Icon",
    currencyEmojiName: "zzz_poly",
    defaultCurrencyEmoji: `<:Item_Polychrome:${EMOJIS.ZZZ_POLY || "1559502718584750121"}>`,
    iconUrl: `https://cdn.discordapp.com/emojis/${EMOJIS.ZZZ_LOGO || "1559502720879173633"}.png`,
  },
};

/**
 * Định dạng phần thưởng kèm icon tiền tệ và vật phẩm đặc trưng
 */
function formatRewards(rewardsText, client, gameKey = "genshin") {
  if (!rewardsText) return "Chưa có thông tin phần thưởng";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const p = meta.prefix;

  const primo = getGameEmoji(client, "gi_primo", meta.defaultCurrencyEmoji);
  const jade = getGameEmoji(client, "hsr_jade", meta.defaultCurrencyEmoji);
  const poly = getGameEmoji(client, "zzz_poly", meta.defaultCurrencyEmoji);
  const mora = getGameEmoji(client, "gi_mora", "🪙");
  const credit = getGameEmoji(client, "hsr_credit", "🪙");
  const denny = getGameEmoji(client, "zzz_denny", "🪙");
  const fate = getGameEmoji(client, `${p}_intertwined` || `${p}_special_pass`, "🎫");

  const cleaned = rewardsText
    .replace(/^•\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .replace(/(Primogem|Nguyên Thạch)/gi, `${primo} Primogem`)
    .replace(/(Stellar Jade|Ngọc Ánh Sao)/gi, `${jade} Stellar Jade`)
    .replace(/(Polychrome|Phim Màu)/gi, `${poly} Polychrome`)
    .replace(/(Mora)/gi, `${mora} Mora`)
    .replace(/(Credits?|Điểm Tín Dụng)/gi, `${credit} Credits`)
    .replace(/(Denny)/gi, `${denny} Denny`);
}

/**
 * Tạo Discord Embed và Button cho mã code thường (Gọn gàng, không banner to)
 * @param {Object} codeObj
 * @param {import("discord.js").Client} [client]
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createRegularCodeMessage(codeObj, client) {
  const gameKey = codeObj.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;
  const p = meta.prefix;

  const formattedRewards = formatRewards(codeObj.rewardsText, client, gameKey);
  const gameEmojiStr = `<:${meta.emojiName}:${meta.emojiId}>`;
  const giftIcon = getGameEmoji(client, `${p}_gift`, "🎁");
  const bellIcon = getGameEmoji(client, `${p}_bell`, "📢");
  const timeIcon = getGameEmoji(client, `${p}_calendar`, "⏳");

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${bellIcon} Mã code mới cho ${config.name}!`)
    .setColor(meta.color)
    .setThumbnail(meta.iconUrl)
    .setDescription(
      `**${codeObj.code}**\n` +
      `[Nhấn để nhận](${codeObj.redeemUrl})\n` +
      `└ ${giftIcon} ${formattedRewards}\n\n` +
      `• Máy chủ: ${codeObj.server || "Tất cả"} | ${timeIcon} Trạng thái: ${codeObj.duration || "Còn hiệu lực"}`
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
 * @param {import("discord.js").Client} [client]
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createLivestreamCodeMessage(streamData, client) {
  const gameKey = streamData.game || "genshin";
  const meta = GAME_EMBED_META[gameKey] || GAME_EMBED_META.genshin;
  const config = GAME_CONFIG[gameKey] || GAME_CONFIG.genshin;
  const p = meta.prefix;

  const codes = streamData.codes || [streamData];
  const version = streamData.version || "Mới";
  const gameEmojiStr = `<:${meta.emojiName}:${meta.emojiId}>`;
  const giftIcon = getGameEmoji(client, `${p}_gift`, "🎁");
  const bellIcon = getGameEmoji(client, `${p}_bell`, "📢");

  // Xây dựng danh sách code
  let codesText = "";
  codes.forEach((c, index) => {
    const rewards = formatRewards(c.rewardsText, client, gameKey);
    codesText += `${giftIcon} **Code ${index + 1}:** \`${c.code}\`\nPhần thưởng: ${rewards}\nHạn dùng: ${c.duration || "Còn hiệu lực"}\n\n`;
  });

  const primaryRedeemUrl = codes[0]?.redeemUrl || config.redeemBaseUrl;

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${bellIcon} Code Livestream ${config.name}`)
    .setColor("#FFD700")
    .setThumbnail(meta.iconUrl)
    .setDescription(
      `Phiên bản ${version} - Tìm thấy ${codes.length} code!\n\n` +
      `${codesText.trim()}\n\n` +
      `Nhận code tại đây:\n` +
      `[Nhấn để nhận quà ngay](${primaryRedeemUrl})\n\n` +
      `▶️ **Official Livestream:**\n` +
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
 * @param {import("discord.js").Client} [client]
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createHoyoCodeMessage(data, client) {
  if (data.isLivestream || Array.isArray(data.codes)) {
    return createLivestreamCodeMessage(data, client);
  }
  return createRegularCodeMessage(data, client);
}

module.exports = {
  createHoyoCodeMessage,
  createRegularCodeMessage,
  createLivestreamCodeMessage,
  GAME_EMBED_META,
};
