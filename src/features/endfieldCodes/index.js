// src/features/endfieldCodes/index.js
const { createEndfieldCodeEmbed, createEndfieldLivestreamMessage } = require("./embedBuilder");
const { scrapeEndfieldCodes, fetchEndfieldLivestreamInfo } = require("./endfieldScraper");
const { ENDFIELD_CODES_CHANNEL_ID, ENDFIELD_ROLE_ID } = require("../../config/env");
const EndfieldCodeModel = require("../../database/models/EndfieldCode");
const { recordSuccess, recordError } = require("../../utils/healthTracker");

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
    recordSuccess("code_endfield");
  } catch (err) {
    console.warn("⚠️ [Endfield Codes] Lỗi kiểm tra code:", err.message);
    recordError("code_endfield", err.message);
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
  const targetChannelId = ENDFIELD_CODES_CHANNEL_ID || "1528768068581457930";
  console.log(`🚀 [Endfield Codes] Đã kích hoạt theo dõi Code Arknights: Endfield cho kênh (${targetChannelId})!`);

  try {
    // 1. Tải danh sách code đã lưu trong MongoDB vào bộ nhớ
    const savedCodes = await EndfieldCodeModel.find({}).catch(() => []);
    if (savedCodes && savedCodes.length > 0) {
      savedCodes.forEach((c) => knownEndfieldCodes.add(c.code.toUpperCase()));
      console.log(`📦 [Endfield Codes] Đã nạp ${savedCodes.length} mã code từ MongoDB Atlas.`);
    }

    // 2. Khóa mốc toàn bộ code cũ hiện có trên web
    const codes = await scrapeEndfieldCodes().catch(() => []);
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

    // 3. Khóa mốc thông báo livestream cũ hiện có
    const info = await fetchEndfieldLivestreamInfo().catch(() => null);
    if (info?.version) {
      knownEndfieldLiveSet.add(info.version);
      console.log(`🔒 [Endfield Live] Đã khóa mốc livestream ban đầu: "${info.version}"`);
    }

    recordSuccess("code_endfield");
  } catch (err) {
    console.error("⚠️ [Endfield Codes] Lỗi khóa mốc ban đầu:", err.message);
    recordError("code_endfield", err.message);
  }

  // Set định kỳ kiểm tra mỗi 10 phút (600,000 ms)
  setInterval(() => {
    checkAndNotifyEndfieldCodes(client);
    checkAndNotifyEndfieldLivestream(client);
  }, 10 * 60 * 1000);
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
