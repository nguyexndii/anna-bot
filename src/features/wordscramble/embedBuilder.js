// src/features/wordscramble/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Create embed for a new Word Scramble Challenge (No icon, large text)
 */
function createScrambleChallengeEmbed(scrambledText) {
  return new EmbedBuilder()
    .setTitle("SẮP XẾP TỪ")
    .setColor("#9B59B6") // Elegant Purple
    .setDescription(
      "Hãy sắp xếp các chữ cái bị xáo trộn dưới đây để tạo thành một cụm từ tiếng Việt có nghĩa!\n\n" +
      `# **${scrambledText}**\n\n` +
      "──────────────────────────────\n" +
      "👉 *Gõ câu trả lời của bạn trực tiếp vào kênh này!*"
    )
    .setFooter({ text: "Gõ !goiy nếu bạn cần thêm gợi ý từ Hệ thống!" });
}

/**
 * Create embed for Word Scramble Winner announcement
 */
function createScrambleWinEmbed(username, originalWord, totalWins) {
  return new EmbedBuilder()
    .setTitle("🎉 THẮNG RỒI! GIẢI ĐÁP CHÍNH XÁC!")
    .setColor("#57F287")
    .setDescription(
      `🏆 **${username}** đã xuất sắc ghép đúng cụm từ: **"${originalWord}"**!\n\n` +
      `🏅 Tổng tích lũy: **${totalWins}** lần giải đáp đúng.`
    )
    .setFooter({ text: "Ván mới sẽ tiếp tục ngay bây giờ..." });
}

/**
 * Create embed for Word Scramble Leaderboard
 */
function createScrambleLeaderboardEmbed(leaderboard) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG SẮP XẾP TỪ")
    .setColor("#FFD700");

  let description = "";

  if (!leaderboard || leaderboard.length === 0) {
    description = "Chưa có ai giải đáp từ nào! Hãy là người đầu tiên ghi danh! 🧩";
  } else {
    leaderboard.slice(0, 5).forEach((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;
      description += `${medal} **${user.username}** — 🏆 ${user.wins} lần thắng\n`;
    });
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create help embed for Word Scramble Game
 */
function createScrambleHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("📖 HƯỚNG DẪN TRÒ CHƠI SẮP XẾP TỪ")
    .setColor("#9B59B6")
    .setDescription(
      "Chào mừng đến với **Trò chơi Sắp Xếp Từ**! Hãy thử thách khả năng ghép chữ và tinh mắt của bạn.\n\n" +
      "🔹 **Luật chơi cơ bản:**\n" +
      "✦ **Hệ thống** sẽ tự động tráo đổi ngẫu nhiên thứ tự các chữ cái của 1 cụm từ tiếng Việt.\n" +
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
  createScrambleWinEmbed,
  createScrambleLeaderboardEmbed,
  createScrambleHelpEmbed,
};
