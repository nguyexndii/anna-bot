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
 * Create beautiful guide/help embed (Quick guide for game channel)
 * @returns {EmbedBuilder}
 */
function createHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("📖 HƯỚNG DẪN TRÒ CHƠI NỐI TỪ")
    .setColor("#5865F2")
    .setDescription(
      "Chào mừng đến với trò chơi **Nối Từ Tiếng Việt**! Hãy thử thách với vốn từ của bạn.\n\n" +
      "🔹 **Luật chơi cơ bản:**\n" +
      "✦ Gõ cụm từ **2 tiếng** (Ví dụ: từ hiện tại là `danh dự` ➡️ bạn nối `dự đoán`).\n" +
      "✦ Tiếng đầu tiên của từ bạn gõ phải trùng khớp với tiếng cuối của từ trước đó.\n" +
      "✦ Nếu sau **1 phút** không ai nối tiếp, **Hệ thống** sẽ tự động chơi cùng bạn!\n\n" +
      "⚡ **Danh sách câu lệnh:**\n" +
      "✦ `!goiy` hoặc `!gợi ý`: Nhờ Hệ thống gợi ý cụm từ tiếp theo.\n" +
      "✦ `!bxh` hoặc `!bangxephang`: Xem Bảng xếp hạng cao thủ.\n" +
      "✦ `!huongdan` hoặc `!luatchoi`: Xem lại hướng dẫn này."
    )
    .setFooter({ text: "⏱️ Hướng dẫn này sẽ tự động xóa sau 1 phút để giữ kênh chat sạch đẹp." });
}

/**
 * Create general rules embed for the Entertainment Category Rules Channel (1450073214620405903)
 * Polite, dignified, structured & clear!
 * @returns {EmbedBuilder}
 */
function createDetailedRulesEmbed() {
  return new EmbedBuilder()
    .setTitle("🎮 NỘI QUY & HƯỚNG DẪN KHU GIẢI TRÍ")
    .setColor("#E67E22")
    .setDescription(
      "Chào mừng đến với **Khu Giải Trí**! Đây là nơi mọi người thư giãn, giao lưu và thử thách bản thân. Xin vui lòng tuân thủ các quy định sau:\n\n" +
      "📌 **1. QUY ĐỊNH CHUNG KHI THAM GIA:**\n" +
      "✦ **Ứng xử văn minh:** Tôn trọng lẫn nhau, duy trì không khí giao lưu vui vẻ, lịch sự.\n" +
      "✦ **Cấm ngôn từ thô tục:** Nghiêm cấm chửi thề, sử dụng từ ngữ thô tục, cố tình phát ngôn nhảm nhí phá rối ván chơi.\n" +
      "✦ **Chơi game công bằng:** Không sử dụng công cụ gian lận.\n\n" +
      "🎮 **2. CÁC TRÒ CHƠI HIỆN CÓ KHU GIẢI TRÍ:**\n\n" +
      "🔤 **1. Trò Chơi Nối Từ Tiếng Việt** *(Kênh <#1450065511231520778>)*\n" +
      "✦ **Cách chơi:** Nối cụm từ **2 tiếng** (Ví dụ: `bình an` ➡️ `an nhiên`). Tiếng đầu của từ bạn gõ phải trùng với tiếng cuối của từ trước.\n" +
      "✦ **Đấu Bot 24/7:** Sau **1 phút** nếu không có người chơi nối tiếp, **Hệ thống** sẽ tự động tiếp chiêu 1 lượt để giữ ván game luôn liên tục.\n" +
      "✦ **Câu lệnh hỗ trợ:** `!goiy` (Xin gợi ý từ), `!bxh` (Bảng xếp hạng), `!huongdan` (Hướng dẫn nhanh).\n\n" +
      "🧩 **2. Trò Chơi Sắp Xếp Từ (Word Unscramble)** *(Kênh <#1535705241620717720>)*\n" +
      "✦ **Cách chơi:** AI tráo đổi thứ tự các chữ cái của một cụm từ tiếng Việt (Ví dụ: `H / Ạ / N / H / P / H / Ú / C`). Ghép đúng từ gốc để tích lũy **+1 điểm** trên Bảng Xếp Hạng!\n" +
      "✦ **Câu lệnh hỗ trợ:** `!sapxep` (Đổi câu đố mới), `!goiy` (Gợi ý chữ cái đầu & chủ đề), `!bxh` (Bảng xếp hạng)."
    )
    .setFooter({ text: "Chúc các thành viên có những giây phút giải trí tuyệt vời tại Khu Giải Trí!" });
}

module.exports = {
  createLeaderboardEmbed,
  createWinEmbed,
  createSessionScoreboardEmbed,
  createHelpEmbed,
  createDetailedRulesEmbed,
};
