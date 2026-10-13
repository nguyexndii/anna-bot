// src/features/endfieldCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ENDFIELD_LOGO_ID, ENDFIELD_OROBERYL_ID } = require("../../config/env");

/**
 * Định dạng phần thưởng cho Arknights: Endfield kèm emoji Oroberyl
 * @param {string} rewardsText
 * @returns {string}
 */
function formatEndfieldRewards(rewardsText) {
  if (!rewardsText) return "Chưa có thông tin phần thưởng";
  const gemEmoji = `<:endfield_oroberyl:${ENDFIELD_OROBERYL_ID || "1559559314652528770"}>`;

  // Tách dòng và làm sạch
  const lines = rewardsText
    .split(/\r?\n/)
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  const formatted = lines.map((item) => {
    // Nếu chứa Oroberyl thì thêm emoji phía trước
    if (/oroberyl/i.test(item) && !item.includes("<:")) {
      return `${gemEmoji} ${item}`;
    }
    return item;
  });

  return formatted.length > 1 ? formatted.join(", ") : formatted[0] || rewardsText;
}

/**
 * Tạo Discord Embed cho mã code Arknights: Endfield thường (Chuẩn 1 chạm sao chép)
 * @param {Object} codeObj
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createEndfieldCodeEmbed(codeObj) {
  const logoId = ENDFIELD_LOGO_ID || "1559559318309969970";
  const gameEmojiStr = `<:endfield_logo:${logoId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${logoId}.png`;

  const rewards = formatEndfieldRewards(codeObj.rewardsText);
  const duration = codeObj.duration || "Còn hiệu lực";

  const description =
    `\`${codeObj.code}\`\n\n` +
    `Phần thưởng: ${rewards}\n` +
    `Hết hạn: ${duration}\n\n` +
    `*Cách nhập: Mở Menu ➔ Cài đặt ➔ Tài khoản ➔ Đổi mã (Exchange Code)*`;

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} Mã code mới cho Arknights: Endfield!`)
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
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createEndfieldLivestreamMessage(streamData) {
  const logoId = ENDFIELD_LOGO_ID || "1559559318309969970";
  const gameEmojiStr = `<:endfield_logo:${logoId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${logoId}.png`;

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
      const formatted = formatEndfieldRewards(c.rewardsText);
      codesText += `Code ${index + 1}\n\`${c.code}\`\nPhần thưởng: ${formatted}\nHết hạn: ${c.duration || "Còn hiệu lực 48h"}\n\n`;
    });

    descriptionText =
      `Phiên bản ${version} - Tìm thấy ${codes.length} code!\n\n` +
      `${codesText.trim()}\n\n` +
      `▶️ Official Livestream\n` +
      `🌐 YouTube: [Watch](${streamYoutube})\n` +
      `🏢 Portal: [Gryphline SKPORT](${officialPortal})`;
  } else {
    descriptionText =
      `Livestream **Phiên bản ${version}** đã được công bố!\n\n` +
      `📅 **Thời gian phát sóng:** ${streamData.time || "Sắp diễn ra"}\n\n` +
      `▶️ Official Livestream\n` +
      `🌐 YouTube: [Xem trên YouTube](${streamYoutube})\n` +
      `🏢 Portal: [Gryphline Portal](${officialPortal})\n\n` +
      `🎁 **Quà tặng Livestream:**\n` +
      `• Các mã Giftcode giới hạn (Oroberyl & Tài nguyên nâng cấp)\n` +
      `• *Lưu ý: Mã thưởng livestream sẽ hết hạn trong 24h - 48h.*`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${codes.length > 0 ? "Code livestream" : "Thông báo livestream"} Arknights: Endfield`)
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
