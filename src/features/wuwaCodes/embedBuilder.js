// src/features/wuwaCodes/embedBuilder.js
const { EmbedBuilder } = require("discord.js");
const { WUWA_EMOJI_ID } = require("../../config/env");
const { translateDurationToVN } = require("./wuwaUtils");

const ASTRITE_ICON_URL = "https://static.wikia.nocookie.net/wutheringwaves/images/1/16/Item_Astrite.png/revision/latest/scale-to-width-down/150";

/**
 * Creates a Discord Embed for Wuthering Waves Redeem Codes
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
    .setTitle(`${emojiMention} REDEEM CODE MỚI – WUTHERING WAVES`)
    .setColor("#00E5FF")
    .setThumbnail(ASTRITE_ICON_URL)
    .setDescription(
      `🔑 **Mã Code:** \`${codeObj.code}\`\n\n` +
      `🎁 **Phần thưởng nhận được**\n${rewardsContent}\n\n` +
      `⏳ **Thời hạn / Trạng thái**\n\`${durationVN}\``
    )
    .setFooter({
      text: "Nhập code trong Settings game",
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
    .setTitle(`${emojiMention} ⚠️ CẢNH BÁO: CODE SẮP HẾT HẠN TRONG 24H!`)
    .setDescription(
      "Dưới đây là danh sách các Redeem Code Wuthering Waves **sắp hết hạn trong vòng 24 giờ tới**. Hãy nhanh tay nhập ngay kẻo lỡ nhé!\n\n" +
      lines.join("\n")
    )
    .setColor("#FF3838")
    .setThumbnail(ASTRITE_ICON_URL)
    .setFooter({
      text: "Nhập code trong Settings game",
      iconURL: defaultIconUrl,
    })
    .setTimestamp();

  return embed;
}

module.exports = { createWuwaCodeEmbed, createWuwaExpiringSoonEmbed, ASTRITE_ICON_URL };
