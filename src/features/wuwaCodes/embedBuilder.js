// src/features/wuwaCodes/embedBuilder.js
const { EmbedBuilder } = require("discord.js");
const { WUWA_EMOJI_ID } = require("../../config/env");
const { translateDurationToVN } = require("./wuwaUtils");

const ASTRITE_ICON_URL = "https://static.wikia.nocookie.net/wutheringwaves/images/1/16/Item_Astrite.png/revision/latest/scale-to-width-down/150";

/**
 * Creates a Discord Embed for Wuthering Waves Redeem Codes (Modern, minimal & elegant)
 * @param {Object} codeObj
 * @returns {Promise<EmbedBuilder>}
 */
async function createWuwaCodeEmbed(codeObj) {
  const emojiId = WUWA_EMOJI_ID || "1536322393411424286";
  const emojiMention = `<:wuwa:${emojiId}>`;
  const defaultIconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png`;

  // Translate duration string to Vietnamese
  const durationVN = await translateDurationToVN(codeObj.duration);
  const rewardsContent = codeObj.rewardsText || "• Chưa có thông tin phần thưởng";

  const embed = new EmbedBuilder()
    .setTitle(`${emojiMention} WUTHERING WAVES — REDEEM CODE`)
    .setColor("#00D2FF")
    .setThumbnail(ASTRITE_ICON_URL)
    .setDescription(
      `### \`${codeObj.code}\`\n\n` +
      `**Phần thưởng:**\n${rewardsContent}\n\n` +
      `**Trạng thái:** \`${durationVN}\``
    )
    .setFooter({
      text: "Wuthering Waves • Giftcode Alert",
      iconURL: defaultIconUrl,
    })
    .setTimestamp();

  return embed;
}

/**
 * Creates a Warning Discord Embed for Codes Expiring in 24 Hours
 * @param {Array<Object>} expiringCodes
 * @returns {Promise<EmbedBuilder>}
 */
async function createWuwaExpiringSoonEmbed(expiringCodes) {
  const emojiId = WUWA_EMOJI_ID || "1536322393411424286";
  const emojiMention = `<:wuwa:${emojiId}>`;
  const defaultIconUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png`;

  const lines = [];
  for (const c of expiringCodes) {
    const durationVN = await translateDurationToVN(c.duration);
    lines.push(`• **\`${c.code}\`** ➔ \`${durationVN}\``);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${emojiMention} CẢNH BÁO: CODE SẮP HẾT HẠN (24H)`)
    .setDescription(
      "Các mã quà tặng dưới đây **sắp hết hạn trong 24 giờ tới**. Hãy nhanh chóng nhập vào tài khoản nhé:\n\n" +
      lines.join("\n")
    )
    .setColor("#FF4757")
    .setThumbnail(ASTRITE_ICON_URL)
    .setFooter({
      text: "Wuthering Waves • Expiry Alert",
      iconURL: defaultIconUrl,
    })
    .setTimestamp();

  return embed;
}

module.exports = { createWuwaCodeEmbed, createWuwaExpiringSoonEmbed, ASTRITE_ICON_URL };
