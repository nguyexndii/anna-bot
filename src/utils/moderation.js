// src/utils/moderation.js
// Bộ kiểm duyệt tự động CHỈ MUTE khi phát ngôn từ ngữ RẤT BẬY BẠ / TỤC TĨU NẶNG
// Tuyệt đối không Mute bừa các từ thông thường.

// Strict Regex CHỈ bắt các từ chửi thề / tục tĩu cực nặng
const SEVERE_VULGAR_REGEX = /\b(địt|địt mẹ|địt má|dmm|đmm|dcm|đcm|lồn|buồi|cặc|con cặc|đkm|đme|chịch|đỉ mẹ|đỉ chó)\b/i;

/**
 * Kiểm tra xem tin nhắn có chứa từ ngữ RẤT BẬY BẠ / TỤC TĨU NẶNG không để Mute 3 phút
 * @param {object} message - Discord Message
 * @returns {Promise<boolean>} Trả về true nếu thực sự bậy nồng nặc và đã Mute thành công
 */
async function checkVulgarAndMute(message) {
  if (!message || !message.content) return false;
  const content = message.content.trim().toLowerCase();

  // Chỉ Mute khi dính các từ chửi thề cực nặng
  if (SEVERE_VULGAR_REGEX.test(content)) {
    try {
      if (message.member && typeof message.member.timeout === "function") {
        await message.member.timeout(3 * 60 * 1000, "Phát ngôn từ ngữ rất bậy bạ trong kênh game");
        await message.channel.send(
          `🛑 <@${message.author.id}> đã bị tạm dừng quyền chat (Mute) **3 phút** do phát ngôn từ ngữ bậy bạ / tục tĩu!`
        );
        return true;
      }
    } catch (err) {
      console.error(`❌ Không thể mute thành viên ${message.author.tag}:`, err.message);
    }
  }

  return false;
}

module.exports = {
  checkVulgarAndMute,
};
