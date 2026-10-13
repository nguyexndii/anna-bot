// src/features/endfieldCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ENDFIELD_LOGO_ID, ENDFIELD_OROBERYL_ID } = require("../../config/env");
const { getGameEmoji } = require("../../utils/emojiHelper");

/**
 * Định dạng phần thưởng cho Arknights: Endfield kèm emoji Oroberyl
 * @param {string} rewardsText
 * @param {import("discord.js").Client} [client]
 * @returns {string}
 */
function formatEndfieldRewards(rewardsText, client) {
  if (!rewardsText) return "Chưa có thông tin phần thưởng";
  const gemEmoji = getGameEmoji(client, "ef_oroberyl", `<:endfield_oroberyl:${ENDFIELD_OROBERYL_ID || "1559559314652528770"}>`);
  const tcreditEmoji = getGameEmoji(client, "ef_tcredit", "🪙");

  // Tách dòng và làm sạch
  const lines = rewardsText
    .split(/\r?\n/)
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  const formatted = lines.map((item) => {
    let text = item;
    if (/oroberyl/i.test(text) && !text.includes("<:")) {
      text = `${gemEmoji} ${text}`;
    }
    if (/t-cred/i.test(text) && !text.includes("<:")) {
      text = `${tcreditEmoji} ${text}`;
    }
    return text;
  });

  return formatted.length > 1 ? formatted.join(", ") : formatted[0] || rewardsText;
}

/**
 * Tạo Discord Embed cho mã code Arknights: Endfield thường (Chuẩn 1 chạm sao chép)
 * @param {Object} codeObj
 * @param {import("discord.js").Client} [client]
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createEndfieldCodeEmbed(codeObj, client) {
  const logoId = ENDFIELD_LOGO_ID || "1559559318309969970";
  const gameEmojiStr = `<:endfield_logo:${logoId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${logoId}.png`;

  const giftIcon = getGameEmoji(client, "ef_gift", "🎁");
  const bellIcon = getGameEmoji(client, "ef_bell", "📢");
  const timeIcon = getGameEmoji(client, "ef_calendar", "⏳");

  const rewards = formatEndfieldRewards(codeObj.rewardsText, client);
  const duration = codeObj.duration || "Còn hiệu lực";

  const description =
    `\`${codeObj.code}\`\n\n` +
    `${giftIcon} Phần thưởng: ${rewards}\n` +
    `${timeIcon} Hết hạn: ${duration}\n\n` +
    `*Cách nhập: Mở Menu ➔ Cài đặt ➔ Tài khoản ➔ Đổi mã (Exchange Code)*`;

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${bellIcon} Mã code mới cho Arknights: Endfield!`)
    .setColor("#FFB800")
    .setThumbnail(iconUrl)
    .setDescription(description)
    .setFooter({
      text: "Arknights: Endfield • Giftcode Alert",
      iconURL: iconUrl,
    })
    .setTimestamp();

  return { embed, components: [] };
}

/**
 * Tạo Discord Embed và Buttons cho Code / Thông báo Livestream Special Program của Arknights: Endfield
 * @param {Object} streamData
 * @param {import("discord.js").Client} [client]
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createEndfieldLivestreamMessage(streamData, client) {
  const logoId = ENDFIELD_LOGO_ID || "1559559318309969970";
  const gameEmojiStr = `<:endfield_logo:${logoId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${logoId}.png`;

  const giftIcon = getGameEmoji(client, "ef_gift", "🎁");
  const bellIcon = getGameEmoji(client, "ef_bell", "📢");
  const timeIcon = getGameEmoji(client, "ef_calendar", "📅");

  const codes = streamData.codes || [];
  const version = streamData.version || "Mới";
  const bannerUrl =
    streamData.bannerUrl ||
    "https://c4.wallpaperflare.com/wallpaper/844/563/830/arknights-endfield-game-cg-hd-wallpaper-preview.jpg";

  const streamYoutube = streamData.streamYoutube || "https://www.youtube.com/@ArknightsEndfield";
  const officialPortal = streamData.officialPortal || "https://endfield.gryphline.com/";

  let descriptionText = "";

  if (codes.length > 0) {
    let codesText = "";
    codes.forEach((c, index) => {
      const formatted = formatEndfieldRewards(c.rewardsText, client);
      codesText += `${giftIcon} **Code ${index + 1}:** \`${c.code}\`\nPhần thưởng: ${formatted}\nHết hạn: ${c.duration || "Còn hiệu lực 48h"}\n\n`;
    });

    descriptionText =
      `Phiên bản ${version} - Tìm thấy ${codes.length} code!\n\n` +
      `${codesText.trim()}\n\n` +
      `▶️ **Official Livestream:**\n` +
      `🌐 YouTube: [Xem trên YouTube](${streamYoutube})\n` +
      `🏢 Portal: [Gryphline SKPORT](${officialPortal})`;
  } else {
    descriptionText =
      `Livestream **Phiên bản ${version}** đã được công bố!\n\n` +
      `${timeIcon} **Thời gian phát sóng:** ${streamData.time || "Sắp diễn ra"}\n\n` +
      `▶️ **Official Livestream:**\n` +
      `🌐 YouTube: [Xem trên YouTube](${streamYoutube})\n` +
      `🏢 Portal: [Gryphline Portal](${officialPortal})\n\n` +
      `${giftIcon} **Quà tặng Livestream:**\n` +
      `• Các mã Giftcode giới hạn (Oroberyl & Tài nguyên nâng cấp)\n` +
      `• *Lưu ý: Mã thưởng livestream sẽ hết hạn trong 24h - 48h.*`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${bellIcon} ${codes.length > 0 ? "Code Livestream" : "Thông báo Livestream"} Arknights: Endfield`)
    .setColor("#FFB800")
    .setThumbnail(iconUrl)
    .setDescription(descriptionText)
    .setImage(bannerUrl)
    .setFooter({
      text: "Arknights: Endfield • Special Program Livestream",
      iconURL: iconUrl,
    })
    .setTimestamp();

  const components = [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("YouTube Stream")
      .setStyle(ButtonStyle.Link)
      .setURL(streamYoutube),
    new ButtonBuilder()
      .setLabel("Official Portal")
      .setStyle(ButtonStyle.Link)
      .setURL(officialPortal)
  );
  components.push(row);

  return { embed, components };
}

module.exports = {
  createEndfieldCodeEmbed,
  createEndfieldLivestreamMessage,
  formatEndfieldRewards,
};
