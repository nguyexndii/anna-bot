// src/features/wordscramble/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Tạo Embed đố vui Sắp xếp từ ngắn gọn, tinh tế & hiện đại
 * @param {string} scrambledText - Cụm từ đã bị xáo trộn (Ví dụ: "T / K / Ế / I / N / C / Ứ / H")
 * @param {string} [hintText] - Gợi ý chủ đề
 * @returns {import("discord.js").EmbedBuilder}
 */
function createScrambleChallengeEmbed(scrambledText) {
  // Biến "T / K / Ế" thành dạng thẻ code tag gọn gàng: `T`  `K`  `Ế`
  const lettersFormatted = scrambledText
    .split(/\s*\/\s*/)
    .map((l) => `\`${l}\``)
    .join("  ");

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("Sắp Xếp Từ Tiếng Việt")
    .setDescription(
      `Ghép các chữ cái thành cụm từ có nghĩa:\n\n` +
      `**${lettersFormatted}**`
    )
    .setFooter({ text: "Gõ đáp án vào kênh này • Gõ !goiy nếu cần gợi ý" });
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

/**
 * Tạo Embed Bảng xếp hạng Sắp xếp từ
 * @param {Array<{username: string, wins: number}>} leaderboard
 * @returns {import("discord.js").EmbedBuilder}
 */
function createScrambleLeaderboardEmbed(leaderboard) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG SẮP XẾP TỪ")
    .setColor("#FFD700");

  let description = "";

  if (!leaderboard || leaderboard.length === 0) {
    description = "Chưa có ai giải đáp từ nào! Hãy là người đầu tiên ghi danh! 🧩";
  } else {
    leaderboard.slice(0, 10).forEach((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;
      description += `${medal} **${user.username}** — 🏆 **${user.wins}** lần thắng\n`;
    });
  }

  embed.setDescription(description);
  embed.setFooter({ text: "Gõ !sapxep để bắt đầu vòng đố tiếp theo!" });
  embed.setTimestamp();
  return embed;
}

/**
 * Tạo Embed hướng dẫn trò chơi Sắp xếp từ
 * @returns {import("discord.js").EmbedBuilder}
 */
function createScrambleHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("📖 HƯỚNG DẪN TRÒ CHƠI SẮP XẾP TỪ")
    .setColor("#9B59B6")
    .setDescription(
      "Chào mừng đến với **Trò chơi Sắp Xếp Từ**! Hãy thử thách khả năng ghép chữ và tinh mắt của bạn.\n\n" +
      "🔹 **Luật chơi cơ bản:**\n" +
      "✦ Hệ thống sẽ tự động tráo đổi ngẫu nhiên thứ tự các chữ cái của 1 cụm từ tiếng Việt.\n" +
      "✦ Bạn cần sắp xếp lại các chữ cái đó để đoán ra từ đúng gốc.\n" +
      "✦ Mỗi câu trả lời đúng sẽ giúp bạn tích lũy **+1 điểm chiến thắng** trên Bảng xếp hạng!\n\n" +
      "⚡ **Danh sách câu lệnh:**\n" +
      "✦ `!sapxep` hoặc `!daotu`: Bắt đầu ván đố mới.\n" +
      "✦ `!goiy`: Xin gợi ý chữ cái đầu tiên & chủ đề.\n" +
      "✦ `!bxh`: Xem Bảng xếp hạng cao thủ.\n" +
      "✦ `!huongdan` hoặc `!luatchoi`: Xem lại hướng dẫn này."
    )
    .setFooter({ text: "⏱️ Hướng dẫn này sẽ tự động xóa sau 1 phút để giữ kênh chat sạch đẹp." });
}

module.exports = {
  createScrambleChallengeEmbed,
  createScrambleSuccessEmbed,
  createScrambleLeaderboardEmbed,
  createScrambleHelpEmbed,
};
