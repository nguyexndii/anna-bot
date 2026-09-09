// src/features/wordchain/embedBuilder.js
const { EmbedBuilder } = require("discord.js");

/**
 * Create leaderboard embed displaying top players
 * @param {Array<{rank: number, username: string, wins: number}>} leaderboardData
 * @returns {EmbedBuilder}
 */
function createLeaderboardEmbed(leaderboardData) {
  const medalEmojis = ["🥇", "🥈", "🥉"];
  
  let descriptionText = "";
  if (!leaderboardData || leaderboardData.length === 0) {
    descriptionText = "Chưa có dữ liệu xếp hạng. Hãy là người đầu tiên thắng ván nối từ!";
  } else {
    descriptionText = leaderboardData
      .slice(0, 10)
      .map((player, index) => {
        const medal = medalEmojis[index] || `**#${index + 1}**`;
        return `${medal} **${player.username}** — 🏆 **${player.wins}** trận thắng`;
      })
      .join("\n");
  }

  return new EmbedBuilder()
    .setTitle("🏆 BẢNG XẾP HẠNG CAO THỦ NỐI TỪ")
    .setColor("#FFD700")
    .setDescription(descriptionText)
    .setFooter({ text: "Gõ !score để xem điểm số ván chơi hiện tại." })
    .setTimestamp();
}

/**
 * Create victory embed when player wins a game
 * @param {string} username - Winner's username
 * @param {string} winningWord - Word that won the game
 * @param {number} totalWins - Winner's total win count
 * @param {number} sessionScore - Current session score
 * @returns {EmbedBuilder}
 */
function createWinEmbed(username, winningWord, totalWins, sessionScore) {
  return new EmbedBuilder()
    .setTitle("🎉 CHÚC MỪNG CHIẾN THẮNG!")
    .setColor("#2ECC71")
    .setDescription(
      `**${username}** đã chiến thắng ván nối từ với từ: **"${winningWord}"**!\n\n` +
      `🏆 **Tổng trận thắng (BXH):** ${totalWins}\n` +
      `⭐ **Từ đúng ván này:** ${sessionScore}`
    )
    .setFooter({ text: "Ván chơi mới sẽ bắt đầu ngay bây giờ..." })
    .setTimestamp();
}

/**
 * Create session score embed for current game
 * @param {Array<{username: string, correctWords: number}>} sessionScores
 * @returns {EmbedBuilder}
 */
function createSessionScoreboardEmbed(sessionScores) {
  let text = "";
  if (!sessionScores || sessionScores.length === 0) {
    text = "Chưa có ai ghi điểm trong ván chơi hiện tại.";
  } else {
    text = sessionScores
      .map((p, i) => `**#${i + 1}** **${p.username}**: **${p.correctWords ?? p.score ?? 0}** từ đúng`)
      .join("\n");
  }

  return new EmbedBuilder()
    .setTitle("📊 ĐIỂM SỐ VÁN CHƠI HIỆN TẠI")
    .setColor("#3498DB")
    .setDescription(text)
    .setTimestamp();
}

/**
 * Create help / rules embed
 * @returns {EmbedBuilder}
 */
function createHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("📖 HƯỚNG DẪN CHƠI NỐI TỪ TIẾNG VIỆT")
    .setColor("#9B59B6")
    .setDescription(
      "🔹 **Luật chơi cơ bản:**\n" +
      "✦ Gõ cụm từ **2 tiếng** (Ví dụ: từ hiện tại là `danh dự` ➡️ bạn nối `dự đoán`).\n" +
      "✦ Tiếng đầu tiên của từ bạn gõ phải trùng khớp với tiếng cuối của từ trước đó.\n" +
      "✦ Nếu sau **3 phút** không ai nối tiếp, **Hệ thống** sẽ tự động tiếp chiêu cùng bạn!\n\n" +
      "⚡ **Danh sách câu lệnh:**\n" +
      "✦ `!goiy` hoặc `!gợi ý`: Nhờ Hệ thống gợi ý cụm từ tiếp theo.\n" +
      "✦ `!bxh` hoặc `!bangxephang`: Xem Bảng xếp hạng cao thủ.\n" +
      "✦ `!score` hoặc `!diem`: Xem điểm số ván chơi hiện tại.\n" +
      "✦ `!huongdan` hoặc `!luatchoi`: Xem lại hướng dẫn này."
    )
    .setFooter({ text: "⏱️ Hướng dẫn này sẽ tự động xóa sau 1 phút để giữ kênh chat sạch đẹp." });
}

/**
 * Create general rules embed for the Entertainment Category Rules Channel
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
      "🔤 **1. Trò Chơi Nối Từ Tiếng Việt**\n" +
      "✦ **Cách chơi:** Nối cụm từ **2 tiếng** (Ví dụ: `bình an` ➡️ `an nhiên`). Tiếng đầu của từ bạn gõ phải trùng với tiếng cuối của từ trước.\n" +
      "✦ **Đấu Bot 24/7:** Sau **3 phút** nếu không có người chơi nối tiếp, **Hệ thống** sẽ tự động tiếp chiêu 1 lượt để giữ ván game luôn liên tục.\n" +
      "✦ **Câu lệnh hỗ trợ:** `!goiy` (Xin gợi ý từ), `!bxh` (Bảng xếp hạng), `!score` (Điểm ván này), `!huongdan` (Hướng dẫn nhanh).\n\n" +
      "🧩 **2. Trò Chơi Sắp Xếp Từ (Word Unscramble)**\n" +
      "✦ **Cách chơi:** Hệ thống tráo đổi thứ tự các chữ cái của một cụm từ tiếng Việt (Ví dụ: `H / Ạ / N / H / P / H / Ú / C`). Ghép đúng từ gốc để tích lũy **+1 điểm** trên Bảng Xếp Hạng!\n" +
      "✦ **Câu lệnh hỗ trợ:** `!sapxep` (Đổi câu đố mới), `!goiy` (Gợi ý chữ cái đầu), `!bxh` (Bảng xếp hạng)."
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
