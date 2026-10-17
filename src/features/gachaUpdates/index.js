// src/features/gachaUpdates/index.js
const { GACHA_UPDATE_FORUM_CHANNEL_ID } = require("../../config/env");
const GachaForumPost = require("../../database/models/GachaForumPost");
const { fetchAllGachaUpdates } = require("./scrapers");
const { summarizeGameUpdate } = require("./aiSummarizer");
const { buildForumPostPayload } = require("./embedBuilder");

let isChecking = false;

/**
 * Kiểm tra và đăng các bản cập nhật mới lên kênh Forum
 */
async function checkAndPublishGachaUpdates(client) {
  if (isChecking) {
    console.log("[GachaUpdates] Vòng quét trước đang chạy, bỏ qua lần này...");
    return;
  }

  if (!client || !client.isReady()) {
    return;
  }

  isChecking = true;
  try {
    const channel = await client.channels.fetch(GACHA_UPDATE_FORUM_CHANNEL_ID).catch(() => null);
    if (!channel || (!channel.isThreadOnly() && !channel.isTextBased())) {
      console.warn(`[GachaUpdates] Không tìm thấy kênh tin tức với ID: ${GACHA_UPDATE_FORUM_CHANNEL_ID}`);
      return;
    }

    console.log("[GachaUpdates] 🔄 Bắt đầu kiểm tra bản cập nhật mới cho 5 tựa game...");
    const latestUpdates = await fetchAllGachaUpdates();

    if (latestUpdates.length === 0) {
      console.log("[GachaUpdates] ℹ️ Không phát hiện bài cập nhật nào xuất bản từ hôm nay. Hệ thống sẽ tiếp tục theo dõi.");
      return;
    }

    for (const update of latestUpdates) {
      try {
        // Kiểm tra xem bài viết đã từng được đăng chưa
        const exists = await GachaForumPost.findOne({ articleId: update.articleId });
        if (exists) {
          continue; // Đã đăng rồi, bỏ qua
        }

        console.log(`[GachaUpdates] 🌟 Phát hiện bài cập nhật mới tinh [${update.game.toUpperCase()}]: ${update.title}`);

        // Gọi AI tóm tắt chuyên sâu 1200 - 1800 ký tự
        const summaryText = await summarizeGameUpdate(update.game, update.title, update.content);

        // Xây dựng payload đăng tin
        const payload = buildForumPostPayload(client, update, summaryText);

        let threadId = null;

        if (channel.isThreadOnly()) {
          // 1. Chế độ Diễn Đàn (Forum Channel): Tạo bài viết Thread
          const thread = await channel.threads.create({
            name: payload.threadName,
            appliedTags: payload.appliedTags,
            message: payload.message,
          });
          threadId = thread.id;
          console.log(`[GachaUpdates] ✅ Đã đăng bài thành công lên Forum: [${thread.name}] (Thread ID: ${thread.id})`);
        } else {
          // 2. Chế độ Kênh Chat Thường / Kênh Thông Báo: Gửi trực tiếp bản tin thường vào kênh
          const sentMsg = await channel.send(payload.message);
          threadId = sentMsg.id;
          console.log(`[GachaUpdates] ✅ Đã đăng bản tin trực tiếp vào kênh chat: [${payload.threadName}] (Message ID: ${sentMsg.id})`);
        }

        // Lưu vào MongoDB để không bao giờ đăng trùng lại
        await GachaForumPost.create({
          game: update.game,
          articleId: update.articleId,
          title: update.title,
          postUrl: update.postUrl,
          bannerUrl: update.bannerUrl,
          threadId: threadId,
          publishedAt: update.publishedAt,
        });

        // Nghỉ 2.5 giây giữa các bài đăng để đảm bảo an toàn với rate limit của Discord
        await new Promise((r) => setTimeout(r, 2500));
      } catch (postErr) {
        console.error(`[GachaUpdates] ❌ Lỗi xử lý bài viết [${update.game} - ${update.title}]:`, postErr.message);
      }
    }
  } catch (err) {
    console.error("[GachaUpdates] Lỗi trong quá trình quét cập nhật:", err.message);
  } finally {
    isChecking = false;
  }
}

/**
 * Khởi tạo watcher theo dõi cập nhật game định kỳ
 */
function initGachaUpdateWatcher(client) {
  console.log("🚀 Khởi chạy hệ thống theo dõi tin tức Gacha Forum Watcher...");

  // Quét lần đầu sau khi bot khởi động 15 giây
  setTimeout(() => {
    checkAndPublishGachaUpdates(client);
  }, 15000);

  // Lên lịch quét định kỳ mỗi 10 phút (600.000 ms)
  setInterval(() => {
    checkAndPublishGachaUpdates(client);
  }, 10 * 60 * 1000);
}

module.exports = {
  initGachaUpdateWatcher,
  checkAndPublishGachaUpdates,
};
