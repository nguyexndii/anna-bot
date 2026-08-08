// src/features/wordscramble/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Create embed for a new Word Scramble Challenge
 */
function createScrambleChallengeEmbed(scrambledText, hintText) {
  return new EmbedBuilder()
    .setTitle("🧩 TRÒ CHƠI SẮP XẾP TỪ (WORD UNSCRAMBLE)")
    .setColor("#9B59B6") // Elegant Purple
    .setDescription(
      "Hãy sắp xếp các chữ cái bị xáo trộn dưới đây để tạo thành một cụm từ tiếng Việt có nghĩa!\n\n" +
      `🔀 **Các chữ cái bị xáo trộn:**\n${scrambledText}\n\n` +
      `💡 **Gợi ý chủ đề:** *${hintText}*\n\n` +
      "👉 *Gõ câu trả lời của bạn trực tiếp vào kênh này!*"
    )
    .setFooter({ text: "Gõ !goiy nếu bạn cần thêm manh mút từ Hệ thống!" });
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

module.exports = {
  createScrambleChallengeEmbed,
  createScrambleWinEmbed,
  createScrambleLeaderboardEmbed,
};
