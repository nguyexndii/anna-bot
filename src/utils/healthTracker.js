// src/utils/healthTracker.js
const { EmbedBuilder } = require("discord.js");
const { sendAdminDM, getVietnamTime } = require("./statusNotifier");
const { ADMIN_ID } = require("../config/env");

/**
 * Danh sách dịch vụ được giám sát sức khỏe
 */
const SERVICES = {
  gacha_hoyoverse: { name: "HoYoLAB News (HSR/GI/ZZZ)", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  gacha_wuwa: { name: "Kuro Games News (WuWa)", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  gacha_endfield: { name: "Gryphline SKPORT (Endfield)", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  gemini_ai: { name: "Google Gemini AI (4 Keys)", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  code_hoyo: { name: "Săn Code HoYoverse", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  code_wuwa: { name: "Săn Code Wuthering Waves", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  code_endfield: { name: "Săn Code Arknights: Endfield", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
  mongodb: { name: "MongoDB Atlas Database", status: "ONLINE", consecutiveErrors: 0, lastSuccess: null, lastError: null },
};

let clientInstance = null;
const ERROR_ALERT_THRESHOLD = 3; // Báo cáo DM Admin khi lỗi liên tiếp >= 3 lần

/**
 * Gắn client để gửi DM khi cần
 */
function initHealthTracker(client) {
  clientInstance = client;
}

/**
 * Ghi nhận dịch vụ hoạt động thành công
 * @param {string} key Tên dịch vụ trong SERVICES
 */
function recordSuccess(key) {
  if (!SERVICES[key]) return;
  const s = SERVICES[key];
  s.status = "ONLINE";
  s.consecutiveErrors = 0;
  s.lastSuccess = new Date();
}

/**
 * Ghi nhận dịch vụ gặp lỗi và tự động cảnh báo Admin nếu lỗi kéo dài
 * @param {string} key Tên dịch vụ trong SERVICES
 * @param {string} errorMsg Chi tiết lỗi
 */
async function recordError(key, errorMsg) {
  if (!SERVICES[key]) return;
  const s = SERVICES[key];
  s.consecutiveErrors += 1;
  s.lastError = { message: String(errorMsg).slice(0, 200), time: new Date() };

  if (s.consecutiveErrors >= ERROR_ALERT_THRESHOLD) {
    s.status = "OFFLINE";
  } else {
    s.status = "DEGRADED";
  }

  // Nếu vừa đạt ngưỡng lỗi liên tiếp thì gửi DM cảnh báo ngay cho Admin
  if (s.consecutiveErrors === ERROR_ALERT_THRESHOLD && clientInstance && ADMIN_ID) {
    console.warn(`[HealthTracker] ⚠️ CẢNH BÁO: Dịch vụ ${s.name} đã lỗi liên tiếp ${s.consecutiveErrors} lần!`);
    await sendAdminDM(clientInstance, ADMIN_ID, {
      title: `⚠️ CẢNH BÁO HỆ THỐNG: [${s.name}] Gặp Sự Cố!`,
      description:
        `Dịch vụ **${s.name}** đã ghi nhận lỗi liên tiếp **${s.consecutiveErrors} lần**.\n` +
        `Có thể Endpoint hoặc API nguồn của nhà phát hành đã bị thay đổi!\n\n` +
        `• **Chi tiết lỗi:** \`${s.lastError.message}\`\n` +
        `• **Thời điểm:** \`${getVietnamTime()}\` (Giờ VN)\n\n` +
        `💡 *Hãy kiểm tra lại endpoint nguồn hoặc dùng lệnh \`!status\` trong Discord để xem chi tiết.*`,
      color: 0xe74c3c, // Đỏ
    });
  }
}

/**
 * Tạo Discord Embed hiển thị Dashboard sức khỏe hệ thống
 * @returns {EmbedBuilder}
 */
function createHealthDashboardEmbed() {
  const vnTime = getVietnamTime();
  const uptimeHours = (process.uptime() / 3600).toFixed(1);
  const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const embed = new EmbedBuilder()
    .setTitle("🩺 BẢNG ĐIỀU KHIỂN SỨC KHỎE HỆ THỐNG (HEALTH MONITOR)")
    .setColor("#2ECC71")
    .setDescription(
      `Theo dõi tình trạng hoạt động thời gian thực của toàn bộ tính năng và endpoint API.\n` +
      `⏱️ **Uptime:** \`${uptimeHours} giờ\` | 🧠 **RAM:** \`${memMB} MB\` | ⏰ **Thời gian:** \`${vnTime}\``
    );

  const statusIcons = {
    ONLINE: "🟢 Hoạt động tốt",
    DEGRADED: "🟡 Đang thử lại / Chập chờn",
    OFFLINE: "🔴 Mất kết nối / Cần kiểm tra",
  };

  let hasIssues = false;

  for (const [key, s] of Object.entries(SERVICES)) {
    const icon = statusIcons[s.status] || "⚪";
    let detail = `Trạng thái: **${icon}**`;
    if (s.lastSuccess) {
      detail += `\n└ Lần thành công gần nhất: <t:${Math.floor(s.lastSuccess.getTime() / 1000)}:R>`;
    }
    if (s.lastError && s.consecutiveErrors > 0) {
      hasIssues = true;
      detail += `\n└ ⚠️ Lỗi (${s.consecutiveErrors} lần liên tiếp): \`${s.lastError.message}\``;
    }

    embed.addFields({
      name: `${s.status === "ONLINE" ? "✅" : s.status === "DEGRADED" ? "⚠️" : "❌"} ${s.name}`,
      value: detail,
      inline: false,
    });
  }

  if (hasIssues) {
    embed.setColor("#F1C40F"); // Vàng nếu có dịch vụ đang chập chờn
  }

  embed.setFooter({ text: "Bot Anna • Tự động cảnh báo qua DM Admin khi endpoint lỗi >= 3 lần" }).setTimestamp();

  return embed;
}

module.exports = {
  initHealthTracker,
  recordSuccess,
  recordError,
  createHealthDashboardEmbed,
  SERVICES,
};
