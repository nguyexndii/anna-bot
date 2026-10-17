// src/features/wuwaCodes/index.js
const { WebhookClient } = require("discord.js");
const { scrapeWuwaCodes, fetchWuwaLivestreamInfo } = require("./wuwaScraper");
const { createWuwaCodeEmbed, createWuwaLivestreamMessage } = require("./embedBuilder");
const WuwaCodeModel = require("../../database/models/WuwaCode");
const { WUWA_CODES_CHANNEL_ID, WUWA_ROLE_ID, WEBHOOK_WUWA_CODES } = require("../../config/env");

const { isPermanentCode } = require("./wuwaUtils");
const { recordSuccess, recordError } = require("../../utils/healthTracker");

// In-memory fallback set for known codes if MongoDB is not connected
const knownCodesSet = new Set();
const knownWuwaLivestreamSet = new Set();

/**
 * Send notification via Webhook (with fallback to channel.send)
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").TextChannel} channel
 * @param {import("discord.js").EmbedBuilder} embed
 * @param {string|null} roleMention
 * @param {import("discord.js").ActionRowBuilder[]} components
 * @returns {Promise<boolean>}
 */
async function sendWuwaNotification(client, channel, embed, roleMention, components = []) {

  if (WEBHOOK_WUWA_CODES) {
    try {
      const webhookClient = new WebhookClient({ url: WEBHOOK_WUWA_CODES });
      await webhookClient.send({
        content: roleMention || undefined,
        embeds: [embed],
        components,
      });
      return true;
    } catch (whErr) {
      console.error("⚠️ Lỗi gửi tin nhắn qua Webhook, chuyển sang channel.send():", whErr.message);
    }
  }

  if (channel) {
    await channel.send({
      content: roleMention || undefined,
      embeds: [embed],
      components,
    });
    return true;
  }

  return false;
}

/**
 * Check Fandom Wiki + DB for active WuWa codes and notify Discord channel if missing from chat
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyWuwaCodes(client) {
  try {
    console.log("🔄 [WuWa Code Watcher] Đang kiểm tra code Wuthering Waves (Web + Thêm thủ công)...");
    
    // 1. Scrape live codes from web (Fandom Wiki / Backup)
    const webCodes = (await scrapeWuwaCodes(client)) || [];

    // 2. Fetch active manual & saved codes from Database
    let dbActiveCodes = [];
    try {
      dbActiveCodes = await WuwaCodeModel.find({ isActive: true });
    } catch (dbErr) {
      console.error("⚠️ Lỗi truy vấn DB active codes:", dbErr.message);
    }

    // 3. Merge web codes + DB manual codes into a Map by Code string
    const allActiveCodesMap = new Map();

    // Populate from DB (includes manually added codes via !themcode)
    for (const doc of dbActiveCodes) {
      allActiveCodesMap.set(doc.code, {
        code: doc.code,
        server: doc.server || "All",
        rewards: doc.rewards || [],
        rewardsText: doc.rewardsText || "• Không rõ phần thưởng",
        duration: doc.duration || "Thêm thủ công",
        isManual: true,
      });
    }

    // Merge web codes (override or complement)
    for (const webObj of webCodes) {
      const existing = allActiveCodesMap.get(webObj.code) || {};
      allActiveCodesMap.set(webObj.code, {
        ...existing,
        ...webObj,
        isManual: false,
      });
    }

    if (allActiveCodesMap.size === 0) {
      console.log("ℹ️ [WuWa Code Watcher] Không có code nào để kiểm tra.");
      return;
    }

    // 4. Fetch recent 50 messages in Discord notification channel (Kênh chính thức 1528768068581457930)
    const targetChannelId = WUWA_CODES_CHANNEL_ID || "1528768068581457930";
    const channel = await client.channels.fetch(targetChannelId).catch((err) => {
      console.error(`❌ [WuWa Code Watcher] Không thể fetch channel (${targetChannelId}):`, err.message);
      return null;
    });

    const codesInChannel = new Set();
    if (channel) {
      try {
        const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (recentMessages && recentMessages.size > 0) {
          recentMessages.forEach((msg) => {
            // 1. Quét nội dung tin nhắn thường
            if (msg.content) {
              const contentMatches = msg.content.matchAll(/(`|\*\*)([A-Z0-9]{5,25})(`|\*\*)/g);
              for (const cm of contentMatches) {
                codesInChannel.add(cm[2].toUpperCase());
              }
            }

            // 2. Quét qua Embeds (Title, Description, Fields)
            if (msg.embeds && msg.embeds.length > 0) {
              for (const emb of msg.embeds) {
                const text = `${emb.title || ""} ${emb.description || ""}`;
                const embedMatches = text.matchAll(/(`|\*\*)([A-Z0-9]{5,25})(`|\*\*)/g);
                for (const em of embedMatches) {
                  codesInChannel.add(em[2].toUpperCase());
                }
                if (emb.fields) {
                  for (const f of emb.fields) {
                    const fieldMatches = `${f.name || ""} ${f.value || ""}`.matchAll(/(`|\*\*)([A-Z0-9]{5,25})(`|\*\*)/g);
                    for (const fm of fieldMatches) {
                      codesInChannel.add(fm[2].toUpperCase());
                    }
                  }
                }
              }
            }

            // 3. Quét qua nút bấm (Button customId & Label)
            if (msg.components && msg.components.length > 0) {
              for (const row of msg.components) {
                for (const comp of row.components || []) {
                  if (comp.customId && comp.customId.startsWith("copy_wuwa_")) {
                    codesInChannel.add(comp.customId.replace("copy_wuwa_", "").trim().toUpperCase());
                  }
                  if (comp.label) {
                    const labelMatch = comp.label.match(/([A-Z0-9]{5,25})/);
                    if (labelMatch) codesInChannel.add(labelMatch[1].toUpperCase());
                  }
                }
              }
            }
          });
        }
      } catch (msgFetchErr) {
        console.error("⚠️ Không thể đọc tin nhắn cũ trong kênh:", msgFetchErr.message);
      }
    }

    // 5. Notify ONLY brand new codes (Không gửi code cũ trước ngày hôm nay, không gửi code vô hạn)
    for (const [codeStr, codeObj] of allActiveCodesMap.entries()) {
      // Bỏ qua các code vô hạn (Permanent / Unknown) theo yêu cầu của user
      if (codeStr === "WUTHERINGGIFT" || isPermanentCode(codeObj.duration)) {
        knownCodesSet.add(codeStr);
        continue;
      }

      const isAlreadyInChannel = codesInChannel.has(codeStr);
      const isAlreadyKnown = knownCodesSet.has(codeStr);
      let existingDoc = null;

      try {
        existingDoc = await WuwaCodeModel.findOne({ code: codeStr });
      } catch (dbErr) {}

      // CHỈ GỬI THÔNG BÁO NẾU:
      // 1. Code chưa từng xuất hiện trong kênh Discord (!isAlreadyInChannel)
      // 2. VÀ Code KHÔNG PHẢI là code cũ trước thời điểm hôm nay (!isAlreadyKnown && (!existingDoc || !existingDoc.notified))
      if (!isAlreadyInChannel && !isAlreadyKnown && (!existingDoc || !existingDoc.notified)) {
        console.log(`🎉 [WuWa Code Watcher] PHÁT HIỆN CODE MỚI TINH (${codeObj.isManual ? "THỦ CÔNG" : "WEB"}): "${codeStr}"!`);

        // Save/Update DB & Memory
        knownCodesSet.add(codeStr);
        try {
          await WuwaCodeModel.findOneAndUpdate(
            { code: codeStr },
            {
              code: codeStr,
              server: codeObj.server || "All",
              rewards: codeObj.rewards || [],
              rewardsText: codeObj.rewardsText || "• Không rõ phần thưởng",
              duration: codeObj.duration || "Valid until: Unknown",
              isActive: true,
              notified: true,
            },
            { upsert: true, returnDocument: 'after' }
          );
        } catch (dbSaveErr) {
          console.error(`⚠️ Không thể lưu code "${codeStr}" vào MongoDB:`, dbSaveErr.message);
        }

        // Send Notification via Webhook or Channel
        try {
          const { embed, components } = await createWuwaCodeEmbed(codeObj);
          const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : null;
          await sendWuwaNotification(client, channel, embed, roleMention, components);
          codesInChannel.add(codeStr);
          console.log(`✅ Đã gửi thông báo code mới "${codeStr}" tới kênh chính thức (${targetChannelId})${roleMention ? ` kèm tag Role (${WUWA_ROLE_ID})` : ""}!`);
        } catch (sendErr) {
          console.error(`❌ Lỗi gửi tin nhắn cho code "${codeStr}":`, sendErr.message);
        }
      } else {
        // Đã biết hoặc đã có trong kênh -> cập nhật DB & Set bộ nhớ để không bao giờ gửi lại
        knownCodesSet.add(codeStr);
        if (existingDoc && !existingDoc.notified) {
          existingDoc.notified = true;
          await existingDoc.save().catch(() => {});
        }
        if (existingDoc && existingDoc.duration !== codeObj.duration && !codeObj.isManual) {
          existingDoc.duration = codeObj.duration;
          await existingDoc.save().catch(() => {});
        }
      }
    }
    recordSuccess("code_wuwa");
  } catch (error) {
    console.error("❌ [WuWa Code Watcher] Lỗi trong quá trình kiểm tra code:", error);
    recordError("code_wuwa", error.message);
  }
}

/**
 * Manually add a new WuWa code (via !themcode or !addcode)
 * @param {import("discord.js").Client} client
 * @param {Object} codeObj
 * @returns {Promise<{success: boolean, alreadyExisted?: boolean, error?: string}>}
 */
async function addManualCode(client, codeObj) {
  try {
    const codeStr = codeObj.code;
    let existingDoc = null;
    try {
      existingDoc = await WuwaCodeModel.findOne({ code: codeStr });
    } catch (dbErr) {}

    // Check recent channel messages for duplicate
    const channel = await client.channels.fetch(WUWA_CODES_CHANNEL_ID).catch(() => null);
    let inChannel = false;
    if (channel) {
      const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (recentMessages) {
        recentMessages.forEach((msg) => {
          if (msg.embeds) {
            for (const emb of msg.embeds) {
              if (emb.description && emb.description.includes(`\`${codeStr}\``)) inChannel = true;
              if (emb.fields) {
                for (const f of emb.fields) {
                  if (f.name && f.name.includes(codeStr)) inChannel = true;
                  if (f.value && f.value.includes(`\`${codeStr}\``)) inChannel = true;
                }
              }
            }
          }
        });
      }
    }

    if (inChannel && existingDoc) {
      return { success: false, alreadyExisted: true };
    }

    // Save to Memory & DB
    knownCodesSet.add(codeStr);
    try {
      await WuwaCodeModel.findOneAndUpdate(
        { code: codeStr },
        {
          code: codeStr,
          server: codeObj.server || "All",
          rewards: codeObj.rewards || [],
          rewardsText: codeObj.rewardsText || "• Chưa có thông tin phần thưởng",
          duration: codeObj.duration || "Thêm thủ công",
          isActive: true,
          notified: true,
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (dbSaveErr) {
      console.error(`⚠️ Không thể lưu code "${codeStr}" vào DB:`, dbSaveErr.message);
    }

    // Send Notification via Webhook or Channel
    const { embed, components } = await createWuwaCodeEmbed(codeObj, client);
    const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : null;
    await sendWuwaNotification(client, channel, embed, roleMention, components);
    console.log(`✅ [Thêm thủ công] Đã thông báo code "${codeStr}" vào kênh (${WUWA_CODES_CHANNEL_ID}) kèm tag Role (${WUWA_ROLE_ID})!`);

    return { success: true };
  } catch (err) {
    console.error("❌ Lỗi khi thêm code thủ công:", err);
    return { success: false, error: err.message };
  }
}

/**
 * List all saved codes formatted with index numbers
 * @returns {Promise<Array<{index: number, id: string, code: string, rewardsText: string, duration: string, isActive: boolean}>>}
 */
async function listManualCodes() {
  try {
    const docs = await WuwaCodeModel.find({}).sort({ createdAt: -1 });
    return docs.map((doc, idx) => ({
      index: idx + 1,
      id: doc._id.toString(),
      code: doc.code,
      rewardsText: doc.rewardsText || "• Chưa có thông tin phần thưởng",
      duration: doc.duration || "Thêm thủ công",
      isActive: doc.isActive,
    }));
  } catch (err) {
    console.error("❌ Lỗi truy vấn danh sách code:", err);
    return [];
  }
}

/**
 * Update an existing manual code by numeric index ID or Code string
 * @param {string|number} identifier
 * @param {Object} updateData
 * @returns {Promise<{success: boolean, codeObj?: Object, error?: string}>}
 */
async function updateManualCode(identifier, updateData) {
  try {
    let doc = null;
    const allDocs = await WuwaCodeModel.find({}).sort({ createdAt: -1 });

    const numIdx = parseInt(identifier, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= allDocs.length) {
      doc = allDocs[numIdx - 1];
    } else {
      const searchCode = String(identifier).trim().toUpperCase();
      doc = allDocs.find((d) => d.code === searchCode);
    }

    if (!doc) {
      return { success: false, error: `Không tìm thấy code với ID/Mã "${identifier}"!` };
    }

    if (updateData.rewardsText) doc.rewardsText = updateData.rewardsText;
    if (updateData.duration) doc.duration = updateData.duration;
    if (updateData.isActive !== undefined) doc.isActive = updateData.isActive;

    await doc.save();
    return { success: true, codeObj: doc };
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật code:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a code by numeric index ID or Code string
 * @param {string|number} identifier
 * @returns {Promise<{success: boolean, deletedCode?: string, error?: string}>}
 */
async function deleteManualCode(identifier) {
  try {
    let doc = null;
    const allDocs = await WuwaCodeModel.find({}).sort({ createdAt: -1 });

    const numIdx = parseInt(identifier, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= allDocs.length) {
      doc = allDocs[numIdx - 1];
    } else {
      const searchCode = String(identifier).trim().toUpperCase();
      doc = allDocs.find((d) => d.code === searchCode);
    }

    if (!doc) {
      return { success: false, error: `Không tìm thấy code với ID/Mã "${identifier}"!` };
    }

    const deletedCodeStr = doc.code;
    await WuwaCodeModel.deleteOne({ _id: doc._id });
    knownCodesSet.delete(deletedCodeStr);

    return { success: true, deletedCode: deletedCodeStr };
  } catch (err) {
    console.error("❌ Lỗi khi xóa code:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Kiểm tra và thông báo Livestream Special Program mới của Wuthering Waves
 * Quy tắc: Tuyệt đối KHÔNG TAG ROLE, chỉ thông báo khi có stream mới (không báo cũ)
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyWuwaLivestream(client) {
  try {
    const liveInfo = await fetchWuwaLivestreamInfo();
    if (!liveInfo || !liveInfo.notice) return;

    const noticeKey = liveInfo.notice.content;
    if (knownWuwaLivestreamSet.has(noticeKey)) {
      return; // Đã thông báo rồi hoặc nằm trong mốc cũ
    }

    console.log(`🎉 [WuWa Livestream] PHÁT HIỆN THÔNG BÁO LIVESTREAM MỚI: "${noticeKey}"!`);
    knownWuwaLivestreamSet.add(noticeKey);

    const targetChannelId = WUWA_CODES_CHANNEL_ID || "1528768068581457930";
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const verMatch = noticeKey.match(/Version\s*([\d\.]+)/i);
    const version = verMatch ? verMatch[1] : "Mới";

    const streamData = {
      version,
      bannerUrl: liveInfo.bannerUrl,
      time: liveInfo.notice.time ? `Ngày ${liveInfo.notice.time}` : "Xem chi tiết tại kênh chính thức",
    };

    const { embed, components } = await createWuwaLivestreamMessage(streamData);
    // Quy tắc: Tuyệt đối KHÔNG TAG ROLE cho thông báo livestream
    await sendWuwaNotification(client, channel, embed, null, components);
    console.log(`✅ [WuWa Livestream] Đã gửi thông báo livestream mới tới kênh (${targetChannelId}) không tag role.`);
  } catch (err) {
    console.warn("⚠️ [WuWa Livestream] Lỗi kiểm tra livestream:", err.message);
  }
}

/**
 * Initialize WuWa Code Auto Watcher
 * Runs immediately on startup and sets periodic timer (30 mins)
 * @param {import("discord.js").Client} client
 */
/**
 * Initialize WuWa Code Auto Watcher
 * Runs immediately on startup and sets periodic timer (10 mins)
 * @param {import("discord.js").Client} client
 */
async function initWuwaCodeWatcher(client) {
  const targetChannelId = WUWA_CODES_CHANNEL_ID || "1528768068581457930";
  console.log(`🚀 [WuWa Code Watcher] Đã kích hoạt theo dõi Code tự động cho kênh chính thức (${targetChannelId})!`);

  try {
    // 1. Nạp toàn bộ code đã biết từ MongoDB Atlas vào Set trong RAM
    const docs = await WuwaCodeModel.find({}).catch(() => []);
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        knownCodesSet.add(doc.code);
      }
      console.log(`🍃 [WuWa Code Watcher] Đã load ${docs.length} code đã biết từ MongoDB.`);
    }

    // 2. Cào dữ liệu hiện tại và khóa mốc Baseline vào RAM + DB
    // Toàn bộ code đang có trên web hiện tại sẽ được đánh dấu đã biết và lưu vào DB (notified: true)
    // để bot KHÔNG BAO GIỜ gửi lại các code cũ trước thời điểm hôm nay
    const allScraped = await scrapeWuwaCodes(client).catch(() => []);
    if (allScraped && allScraped.length > 0) {
      for (const c of allScraped) {
        knownCodesSet.add(c.code);
        await WuwaCodeModel.findOneAndUpdate(
          { code: c.code },
          {
            code: c.code,
            server: c.server || "All",
            rewards: c.rewards || [],
            rewardsText: c.rewardsText || "• Không rõ phần thưởng",
            duration: c.duration || "Valid until: Unknown",
            isActive: true,
            notified: true,
          },
          { upsert: true }
        ).catch(() => {});
      }
      console.log(`🔒 [WuWa Code Watcher] Đã khóa mốc ban đầu (${allScraped.length} code cũ sẽ không bị gửi lại).`);
    }

    // 3. Khóa mốc thông báo livestream ban đầu (không báo tin cũ)
    const info = await fetchWuwaLivestreamInfo().catch(() => null);
    if (info?.notice?.content) {
      knownWuwaLivestreamSet.add(info.notice.content);
      console.log(`🔒 [WuWa Livestream] Đã khóa mốc livestream ban đầu: "${info.notice.content}"`);
    }

    recordSuccess("code_wuwa");
  } catch (err) {
    console.error("⚠️ [WuWa Code Watcher] Lỗi trong quá trình khởi tạo watcher:", err.message);
    recordError("code_wuwa", err.message);
  }

  // Set định kỳ kiểm tra mỗi 10 phút (600,000 ms)
  setInterval(() => {
    checkAndNotifyWuwaCodes(client);
    checkAndNotifyWuwaLivestream(client);
  }, 10 * 60 * 1000);
}

module.exports = {
  initWuwaCodeWatcher,
  checkAndNotifyWuwaCodes,
  checkAndNotifyWuwaLivestream,
  createWuwaLivestreamMessage,
  addManualCode,
  listManualCodes,
  updateManualCode,
  deleteManualCode,
};
