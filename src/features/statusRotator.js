// src/features/statusRotator.js
// Quản lý và tự động xoay tua trạng thái Custom Status (Kaomoji) cho Anna Bot

const { ActivityType } = require("discord.js");
const kaomojis = require("../config/kaomojis");

let statusInterval = null;
let lastIndex = -1;

/**
 * Lấy ngẫu nhiên một Kaomoji từ danh sách, đảm bảo không trùng với trạng thái vừa hiển thị
 * @returns {string}
 */
function getRandomStatus() {
  if (!kaomojis || kaomojis.length === 0) return "( •̀ ω •́ )✧";
  if (kaomojis.length === 1) return kaomojis[0];

  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * kaomojis.length);
  } while (nextIndex === lastIndex);

  lastIndex = nextIndex;
  return kaomojis[nextIndex];
}

/**
 * Cập nhật Custom Status cho bot
 * @param {import("discord.js").Client} client
 * @param {string|null} customText - Nếu truyền chuỗi cụ thể thì set trực tiếp
 */
function updateStatus(client, customText = null) {
  try {
    if (!client || !client.user) return null;
    const statusText = customText || getRandomStatus();

    client.user.setPresence({
      activities: [
        {
          name: statusText,
          type: ActivityType.Custom,
          state: statusText,
        },
      ],
      status: "online",
    });

    return statusText;
  } catch (err) {
    console.error("❌ [StatusRotator] Lỗi cập nhật trạng thái Kaomoji:", err.message);
    return null;
  }
}

/**
 * Khởi động bộ đếm xoay tua trạng thái
 * @param {import("discord.js").Client} client
 * @param {number} intervalMs - Chu kỳ đổi trạng thái (mặc định 60.000ms = 60s)
 */
function initStatusRotator(client, intervalMs = 60 * 1000) {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }

  // Cập nhật trạng thái đầu tiên ngay khi bot khởi động xong
  const initialStatus = updateStatus(client);
  if (initialStatus) {
    console.log(`✨ [StatusRotator] Đã đặt trạng thái mở màn: "${initialStatus}"`);
  }

  // Lên lịch định kỳ xoay tua trạng thái mỗi 60 giây
  statusInterval = setInterval(() => {
    updateStatus(client);
  }, intervalMs);

  console.log(
    `🎭 [StatusRotator] Đã kích hoạt xoay tua Kaomoji (${kaomojis.length} trạng thái, chu kỳ ${Math.round(intervalMs / 1000)}s/lần)`
  );
}

module.exports = {
  initStatusRotator,
  updateStatus,
  getRandomStatus,
};
