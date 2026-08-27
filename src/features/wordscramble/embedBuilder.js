const { EmbedBuilder } = require("discord.js");

/**
 * Tạo Embed đố vui Sắp xếp từ ngắn gọn & chuyên nghiệp
 * @param {string} scrambledText - Cụm từ đã bị xáo trộn (Ví dụ: "Ơ / V / H / Ầ / T / N")
 * @returns {import("discord.js").EmbedBuilder}
 */
function createScrambleChallengeEmbed(scrambledText) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🧩 SẮP XẾP TỪ TIẾNG VIỆT")
    .setDescription(
      `Hãy sắp xếp các chữ cái sau thành từ có nghĩa:\n\n# **${scrambledText}**\n\n👉 *Gõ câu trả lời vào kênh này! (Gõ \`!goiy\` nếu cần gợi ý)*`
    )
    .setTimestamp();
}

/**
 * Tạo Embed thông báo trả lời đúng
 */
function createScrambleSuccessEmbed(username, originalWord, timeTakenSec) {
  return new EmbedBuilder()
    .setColor(0x22C55E)
    .setTitle("🎉 CHÚC MỪNG TRẢ LỜI ĐÚNG!")
    .setDescription(`**${username}** đã giải chính xác đáp án: **${originalWord}**\n⏱️ Thời gian: **${timeTakenSec} giây**`)
    .setTimestamp();
}

module.exports = {
  createScrambleChallengeEmbed,
  createScrambleSuccessEmbed,
};
