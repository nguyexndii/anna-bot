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

module.exports = { createWuwaCodeEmbed };
