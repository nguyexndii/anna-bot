// src/features/endfieldCodes/index.js
const { createEndfieldCodeEmbed, createEndfieldLivestreamMessage } = require("./embedBuilder");
const { scrapeEndfieldCodes, fetchEndfieldLivestreamInfo } = require("./endfieldScraper");
const { ENDFIELD_CODES_CHANNEL_ID, ENDFIELD_ROLE_ID } = require("../../config/env");
const EndfieldCodeModel = require("../../database/models/EndfieldCode");

const knownEndfieldCodes = new Set();
const knownEndfieldLiveSet = new Set();

/**
 * Gửi thông báo giftcode mới cho Arknights: Endfield
 * Quy tắc: Chỉ gửi code mới từ hôm nay trở đi, không gửi code cũ
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyEndfieldCodes(client) {
  try {
    const targetChannelId = ENDFIELD_CODES_CHANNEL_ID || "1528768068581457930";
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const codes = await scrapeEndfieldCodes();
    for (const codeObj of codes) {
      const codeKey = codeObj.code.toUpperCase();
      const existingDoc = await EndfieldCodeModel.findOne({ code: codeKey }).catch(() => null);

      if (!knownEndfieldCodes.has(codeKey) && (!existingDoc || !existingDoc.notified)) {
        console.log(`🎉 [Endfield Codes] PHÁT HIỆN CODE MỚI: ${codeKey}!`);
        knownEndfieldCodes.add(codeKey);

        // Lưu vào MongoDB Atlas
        try {
          await EndfieldCodeModel.findOneAndUpdate(
            { code: codeKey },
            {
              code: codeKey,
              rewardsText: codeObj.rewardsText || "• Chưa có thông tin phần thưởng",
              duration: codeObj.duration || "Còn hiệu lực",
              isActive: true,
              notified: true,
            },
            { upsert: true, returnDocument: "after" }
          );
        } catch (dbErr) {
          console.error(`⚠️ Không thể lưu code Endfield "${codeKey}" vào MongoDB:`, dbErr.message);
        }

        const { embed, components } = await createEndfieldCodeEmbed(codeObj, client);
        const roleMention = ENDFIELD_ROLE_ID ? `<@&${ENDFIELD_ROLE_ID}>` : null;
        await channel.send({ content: roleMention || undefined, embeds: [embed], components });
        console.log(`✅ [Endfield Codes] Đã gửi code mới (${codeKey}) kèm tag role tới kênh (${targetChannelId}).`);
      } else {
        knownEndfieldCodes.add(codeKey);
      }
    }
  } catch (err) {
    console.warn("⚠️ [Endfield Codes] Lỗi kiểm tra code:", err.message);
  }
}

/**
 * Gửi thông báo Livestream Special Program cho Arknights: Endfield (Không tag role, chỉ báo stream mới)
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyEndfieldLivestream(client) {
  try {
    const targetChannelId = ENDFIELD_CODES_CHANNEL_ID || "1528768068581457930";
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const liveData = await fetchEndfieldLivestreamInfo();
    if (liveData && !knownEndfieldLiveSet.has(liveData.version)) {
      console.log(`🎉 [Endfield Live] PHÁT HIỆN LIVESTREAM MỚI: Bản ${liveData.version}!`);
      knownEndfieldLiveSet.add(liveData.version);
      const { embed, components } = await createEndfieldLivestreamMessage(liveData);
      await channel.send({ embeds: [embed], components });
      console.log(`✅ [Endfield Live] Đã gửi thông báo livestream mới tới kênh (${targetChannelId}) không tag role.`);
    }
  } catch (err) {
    console.warn("⚠️ [Endfield Live] Lỗi kiểm tra live:", err.message);
  }
}

/**
 * Khởi động hệ thống theo dõi tự động code và livestream Arknights: Endfield
 * Quy tắc: Khóa mốc toàn bộ code cũ và stream cũ ban đầu, chỉ thông báo từ hôm nay trở đi
 * @param {import("discord.js").Client} client
 */
async function initEndfieldCodeWatcher(client) {
  // 1. Tải danh sách code đã lưu trong MongoDB vào bộ nhớ
  try {
    const savedCodes = await EndfieldCodeModel.find({});
    if (savedCodes && savedCodes.length > 0) {
      savedCodes.forEach((c) => knownEndfieldCodes.add(c.code.toUpperCase()));
      console.log(`📦 [Endfield Codes] Đã nạp ${savedCodes.length} mã code từ MongoDB Atlas.`);
    }
  } catch (dbErr) {
    console.warn("⚠️ [Endfield Codes] Lỗi nạp code từ MongoDB:", dbErr.message);
  }

  // 2. Khóa mốc toàn bộ code cũ hiện có trên web (nếu chưa có trong DB thì lưu với notified: true để không gửi lại)
  scrapeEndfieldCodes()
    .then(async (codes) => {
      for (const c of codes) {
        const key = c.code.toUpperCase();
        knownEndfieldCodes.add(key);
        try {
          await EndfieldCodeModel.updateOne(
            { code: key },
            { $setOnInsert: { code: key, rewardsText: c.rewardsText, duration: c.duration, notified: true } },
            { upsert: true }
          );
        } catch (_) {}
      }
      console.log(`🔒 [Endfield Codes] Đã khóa mốc ${knownEndfieldCodes.size} code cũ ban đầu (không gửi code cũ).`);
    })
    .catch((err) => console.warn("⚠️ [Endfield Codes] Lỗi khóa mốc code ban đầu:", err.message));

  // 3. Khóa mốc thông báo livestream cũ hiện có
  fetchEndfieldLivestreamInfo()
    .then((info) => {
      if (info?.version) {
        knownEndfieldLiveSet.add(info.version);
        console.log(`🔒 [Endfield Live] Đã khóa mốc livestream ban đầu: "${info.version}"`);
      }
    })
    .catch((err) => console.warn("⚠️ [Endfield Live] Lỗi khóa mốc live ban đầu:", err.message));

  // Chạy kiểm tra sau 10 giây khi khởi động
  setTimeout(() => {
    checkAndNotifyEndfieldCodes(client);
    checkAndNotifyEndfieldLivestream(client);
  }, 10000);

  // Set định kỳ kiểm tra mỗi 30 phút (1,800,000 ms)
  setInterval(() => {
    checkAndNotifyEndfieldCodes(client);
    checkAndNotifyEndfieldLivestream(client);
  }, 30 * 60 * 1000);
}

module.exports = {
  createEndfieldCodeEmbed,
  createEndfieldLivestreamMessage,
  checkAndNotifyEndfieldCodes,
  checkAndNotifyEndfieldLivestream,
  initEndfieldCodeWatcher,
  knownEndfieldCodes,
  knownEndfieldLiveSet,
};
