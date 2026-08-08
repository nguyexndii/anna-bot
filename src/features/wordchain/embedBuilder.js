// src/features/wordchain/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Create leaderboard embed
 * @param {Array<{id: string, username: string, wins: number}>} leaderboard
 * @param {string} currentWord - Current word in the game
 * @returns {EmbedBuilder}
 */
function createLeaderboardEmbed(leaderboard, currentWord = "") {
  const embed = new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG CAO THỦ")
    .setColor("#FFD700");

  let description = "";

  if (!leaderboard || leaderboard.length === 0) {
    description = "Chưa có ai ghi danh! Hãy là người đầu tiên chinh phục bảng xếp hạng! 🎯";
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
  if (currentWord) {
    embed.setFooter({ text: `💡 Từ hiện tại là: ${currentWord}` });
  }

  return embed;
}

/**
 * Create win announcement embed
 * @param {string} username
 * @param {number} totalWins
 * @returns {EmbedBuilder}
 */
function createWinEmbed(username, totalWins) {
  const embed = new EmbedBuilder()
    .setTitle("🎉 CHIẾN THẮNG TUYỆT ĐỐI!")
    .setDescription(`**${username}** đã xuất sắc dành chiến thắng! (Tổng: **${totalWins}** lần thắng)`)
    .setColor("#57F287")
    .setFooter({ text: "Cùng cố gắng chinh phục đỉnh cao tiếp theo nhé!" });

  return embed;
}

/**
 * Create session scoreboard embed (who played in THIS game)
 * @param {Array<{userId: string, username: string, correctWords: number}>} scoreboard
 * @param {string} winner - Winner's username
 * @returns {EmbedBuilder}
 */
function createSessionScoreboardEmbed(scoreboard, winner) {
  const embed = new EmbedBuilder()
    .setTitle("🏁 BẢNG ĐIỂM VÁN CHƠI")
    .setColor("#5865F2");

  let description = `🏆 **${winner}** dành chiến thắng ván này!\n\n`;

  if (scoreboard && scoreboard.length > 0) {
    scoreboard.forEach((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `#${index + 1}`;
      description += `${medal} **${user.username}** — 🏆 ${user.correctWords} từ đúng\n`;
    });
  }

  description += "\n_Cố gắng giành nhiều chiến thắng hơn ở ván tiếp theo nhé!_";

  embed.setDescription(description);
  return embed;
}

/**
 * Create beautiful guide/help embed
 * @returns {EmbedBuilder}
 */
function createHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("📖 HƯỚNG DẪN TRÒ CHƠI NỐI TỪ")
    .setColor("#5865F2")
    .setDescription(
      "Chào mừng bạn tham gia trò chơi **Nối Từ Tiếng Việt**! Hãy thử thách vốn từ của bạn cùng bạn bè và Hệ thống trọng tài.\n\n" +
      "🔹 **Luật chơi cơ bản:**\n" +
      "✦ Gõ cụm từ **2 tiếng** (Ví dụ: từ hiện tại là `danh dự` ➡️ bạn nối `dự đoán`).\n" +
      "✦ Tiếng đầu tiên của từ bạn gõ phải trùng khớp với tiếng cuối của từ trước đó.\n" +
      "✦ Nếu sau **1 phút** không ai nối tiếp, **Hệ thống** sẽ tự động tiếp chiêu cùng bạn!\n\n" +
      "⚡ **Danh sách câu lệnh:**\n" +
      "✦ `!goiy` hoặc `!gợi ý`: Nhờ Hệ thống gợi ý cụm từ tiếp theo.\n" +
      "✦ `!bxh` hoặc `!bangxephang`: Xem Bảng xếp hạng cao thủ.\n" +
      "✦ `!huongdan` hoặc `!luatchoi`: Xem lại hướng dẫn này."
    )
    .setFooter({ text: "⏱️ Hướng dẫn này sẽ tự động xóa sau 1 phút để giữ kênh chat sạch đẹp." });
}

module.exports = {
  createLeaderboardEmbed,
  createWinEmbed,
  createSessionScoreboardEmbed,
  createHelpEmbed,
};
