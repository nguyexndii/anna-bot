// src/features/wuwaCodes/embedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { WUWA_EMOJI_ID } = require("../../config/env");
const { translateDurationToVN } = require("./wuwaUtils");

/**
 * Định dạng phần thưởng cho gọn gàng và đẹp mắt
 */
function formatRewards(rewardsText) {
  if (!rewardsText) return "Chưa có thông tin phần thưởng";
  const lines = rewardsText
    .split(/\r?\n/)
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.join(", ");
  }
  return lines[0] || "Chưa có thông tin phần thưởng";
}

/**
 * Tạo Discord Embed và Button cho mã code Wuthering Waves (Chuẩn phong cách tối giản HoYoverse)
 * @param {Object} codeObj
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createWuwaCodeEmbed(codeObj) {
  const emojiId = WUWA_EMOJI_ID || "1536322393411424286";
  const gameEmojiStr = `<:wutheringwave:${emojiId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png`;

  // Dịch thời hạn sang tiếng Việt
  let durationVN = await translateDurationToVN(codeObj.duration);
  durationVN = durationVN
    .replace(/^Hạn dùng:\s*/i, "")
    .replace(/\|\s*Hạn dùng:\s*/i, "| ")
    .trim() || "Còn hiệu lực";

  if (durationVN.toLowerCase().includes("vô thời hạn")) {
    durationVN = "Vô thời hạn (Còn hiệu lực)";
  }

  const formattedRewards = formatRewards(codeObj.rewardsText);

  let serverVN = codeObj.server || "Tất cả";
  if (serverVN.toLowerCase() === "all") serverVN = "Tất cả";

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} Mã code mới cho Wuthering Waves!`)
    .setColor("#00D2FF")
    .setThumbnail(iconUrl)
    .setDescription(
      `\`${codeObj.code}\`\n` +
      `└ ${formattedRewards}\n\n` +
      `• Máy chủ: ${serverVN} | Trạng thái: ${durationVN}`
    )
    .setFooter({
      text: "Wuthering Waves • Giftcode Alert",
      iconURL: iconUrl,
    })
    .setTimestamp();

  // Bỏ hoàn toàn hàng nút bấm - Người dùng chạm trực tiếp vào mã code để sao chép
  return { embed, components: [] };
}

/**
 * Tạo Discord Embed và Buttons cho Code / Thông báo Livestream Special Program của Wuthering Waves
 * @param {Object} streamData
 * @returns {Promise<{ embed: EmbedBuilder, components: ActionRowBuilder[] }>}
 */
async function createWuwaLivestreamMessage(streamData) {
  const emojiId = WUWA_EMOJI_ID || "1536322393411424286";
  const gameEmojiStr = `<:wutheringwave:${emojiId}>`;
  const iconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png`;

  const codes = streamData.codes || [];
  const version = streamData.version || "Mới";
  const bannerUrl = streamData.bannerUrl || "https://hw-pcdownload-qcloud.aki-game.net/launcher/news/slide-picture/087sw5peq5mquvlulz.png";

  const streamYoutube = streamData.streamYoutube || "https://www.youtube.com/@WutheringWaves";
  const streamTwitch = streamData.streamTwitch || "https://www.twitch.tv/wuthering_waves";

  let descriptionText = "";

  if (codes.length > 0) {
    let codesText = "";
    codes.forEach((c, index) => {
      const formatted = formatRewards(c.rewardsText);
      codesText += `Code ${index + 1}\n\`${c.code}\`\nPhần thưởng: ${formatted}\nHết hạn: ${c.duration || "Còn hiệu lực 24h - 48h"}\n\n`;
    });

    descriptionText =
      `Phiên bản ${version} - Tìm thấy ${codes.length} code!\n\n` +
      `${codesText.trim()}\n\n` +
      `▶️ Official Livestream\n` +
      `🌐 YouTube: [Watch](${streamYoutube})\n` +
      `🟣 Twitch: [Watch](${streamTwitch})`;
  } else {
    descriptionText =
      `Livestream **Phiên bản ${version}** đã được công bố!\n\n` +
      `📅 **Thời gian phát sóng:** ${streamData.time || "Sắp diễn ra"}\n\n` +
      `▶️ Official Livestream\n` +
      `🌐 YouTube: [Xem trên YouTube](${streamYoutube})\n` +
      `🟣 Twitch: [Xem trên Twitch](${streamTwitch})\n\n` +
      `🎁 **Quà tặng Livestream:**\n` +
      `• 3 Mã Giftcode giới hạn (Astrite & Nguyên liệu nâng cấp)\n` +
      `• *Lưu ý: Mã thưởng sẽ hết hạn trong 24h - 48h sau khi stream kết thúc.*`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${gameEmojiStr} ${codes.length > 0 ? "Code livestream" : "Thông báo livestream"} Wuthering Waves`)
    .setColor("#FFD700")
    .setThumbnail(iconUrl)
    .setDescription(descriptionText)
    .setImage(bannerUrl)
    .setFooter({
      text: "Wuthering Waves • Special Program Livestream",
      iconURL: iconUrl,
    })
    .setTimestamp();

  // Nút bấm liên kết trực tiếp tới kênh livestream
  const components = [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("YouTube Stream")
      .setStyle(ButtonStyle.Link)
      .setURL(streamYoutube),
    new ButtonBuilder()
      .setLabel("Twitch Stream")
      .setStyle(ButtonStyle.Link)
      .setURL(streamTwitch)
  );
  components.push(row);

  return { embed, components };
}

module.exports = { createWuwaCodeEmbed, createWuwaLivestreamMessage };
