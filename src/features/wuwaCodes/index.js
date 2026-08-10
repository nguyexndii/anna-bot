// src/features/wuwaCodes/index.js
const { scrapeWuwaCodes } = require("./wuwaScraper");
const { createWuwaCodeEmbed, createWuwaExpiringSoonEmbed } = require("./embedBuilder");
const { isExpiringWithin24Hours } = require("./wuwaUtils");
const WuwaCodeModel = require("../../database/models/WuwaCode");
const { WUWA_CODES_CHANNEL_ID, WUWA_ROLE_ID } = require("../../config/env");

// In-memory fallback set for known codes if MongoDB is not connected
const knownCodesSet = new Set();

/**
 * Check Fandom Wiki + DB for active WuWa codes and notify Discord channel if missing from chat
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyWuwaCodes(client) {
  try {
    console.log("🔄 [WuWa Code Watcher] Đang kiểm tra code Wuthering Waves (Web + Thêm thủ công)...");
    
    // 1. Scrape live codes from web (Fandom Wiki / Backup)
    const webCodes = (await scrapeWuwaCodes()) || [];

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

    // 4. Fetch recent 50 messages in Discord notification channel
    const channel = await client.channels.fetch(WUWA_CODES_CHANNEL_ID).catch((err) => {
      console.error(`❌ [WuWa Code Watcher] Không thể fetch channel (${WUWA_CODES_CHANNEL_ID}):`, err.message);
      return null;
    });

    const codesInChannel = new Set();
    if (channel) {
      try {
        const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (recentMessages && recentMessages.size > 0) {
          recentMessages.forEach((msg) => {
            if (msg.embeds && msg.embeds.length > 0) {
              for (const emb of msg.embeds) {
                if (emb.description) {
                  const match = emb.description.match(/`([A-Z0-9]{5,25})`/);
                  if (match) codesInChannel.add(match[1]);
                }
                if (emb.fields) {
                  for (const f of emb.fields) {
                    if (f.name && f.name.includes("🔑 Mã Code:")) {
                      const match = f.name.match(/`([A-Z0-9]{5,25})`/);
                      if (match) codesInChannel.add(match[1]);
                    }
                    if (f.value) {
                      const matches = f.value.match(/`([A-Z0-9]{5,25})`/g);
                      if (matches) {
                        for (const m of matches) {
                          codesInChannel.add(m.replace(/`/g, "").trim());
                        }
                      }
                    }
                  }
                }
              }
            }
            if (msg.content) {
              const matches = msg.content.match(/`([A-Z0-9]{5,25})`/g);
              if (matches) {
                for (const m of matches) {
                  codesInChannel.add(m.replace(/`/g, "").trim());
                }
              }
            }
          });
        }
      } catch (msgFetchErr) {
        console.error("⚠️ Không thể đọc tin nhắn cũ trong kênh:", msgFetchErr.message);
      }
    }

    // 5. Notify any missing code (whether web or manual)!
    for (const [codeStr, codeObj] of allActiveCodesMap.entries()) {
      const isAlreadyInChannel = codesInChannel.has(codeStr);
      let existingDoc = null;

      try {
        existingDoc = await WuwaCodeModel.findOne({ code: codeStr });
      } catch (dbErr) {}

      if (!isAlreadyInChannel) {
        console.log(`🎉 [WuWa Code Watcher] PHÁT HIỆN CODE CẦN ĐĂNG KÊNH (${codeObj.isManual ? "THỦ CÔNG" : "WEB"}): "${codeStr}"!`);

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
            { upsert: true, new: true }
          );
        } catch (dbSaveErr) {
          console.error(`⚠️ Không thể lưu code "${codeStr}" vào MongoDB:`, dbSaveErr.message);
        }

        // Send Embed Notification to Discord Channel
        if (channel) {
          try {
            const embed = await createWuwaCodeEmbed(codeObj);
            const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : null;
            await channel.send({
              content: roleMention || undefined,
              embeds: [embed],
            });
            console.log(`✅ Đã gửi thông báo code "${codeStr}" tới kênh (${WUWA_CODES_CHANNEL_ID}) kèm tag Role (${WUWA_ROLE_ID})!`);
          } catch (sendErr) {
            console.error(`❌ Lỗi gửi tin nhắn cho code "${codeStr}":`, sendErr.message);
          }
        }
      } else {
        // Code already present in channel
        if (existingDoc && existingDoc.duration !== codeObj.duration && !codeObj.isManual) {
          existingDoc.duration = codeObj.duration;
          await existingDoc.save().catch(() => {});
        }
      }
    }

    // 6. Check for codes expiring within 24 hours that haven't been alerted yet
    try {
      const expiringCodesToNotify = [];
      for (const [codeStr, codeObj] of allActiveCodesMap.entries()) {
        if (isExpiringWithin24Hours(codeObj.duration)) {
          let doc = await WuwaCodeModel.findOne({ code: codeStr }).catch(() => null);
          if (doc && !doc.notifiedExpiringSoon) {
            expiringCodesToNotify.push(codeObj);
            doc.notifiedExpiringSoon = true;
            await doc.save().catch(() => {});
          }
        }
      }

      if (expiringCodesToNotify.length > 0 && channel) {
        console.log(`⚠️ [WuWa Code Watcher] PHÁT HIỆN ${expiringCodesToNotify.length} CODE SẮP HẾT HẠN TRONG 24H!`);
        const expireEmbed = await createWuwaExpiringSoonEmbed(expiringCodesToNotify);
        const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : null;
        await channel.send({
          content: roleMention ? `🔔 ${roleMention} **NHẮC NHỞ CODE SẮP HẾT HẠN!**` : undefined,
          embeds: [expireEmbed],
        });
      }
    } catch (expireCheckErr) {
      console.error("⚠️ Lỗi kiểm tra code sắp hết hạn:", expireCheckErr.message);
    }
  } catch (error) {
    console.error("❌ [WuWa Code Watcher] Lỗi trong quá trình kiểm tra code:", error);
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
        { upsert: true, new: true }
      );
    } catch (dbSaveErr) {
      console.error(`⚠️ Không thể lưu code "${codeStr}" vào DB:`, dbSaveErr.message);
    }

    // Send Embed Notification to test/notification channel
    if (channel) {
      const embed = await createWuwaCodeEmbed(codeObj);
      const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : null;
      await channel.send({
        content: roleMention || undefined,
        embeds: [embed],
      });
      console.log(`✅ [Thêm thủ công] Đã thông báo code "${codeStr}" vào kênh (${WUWA_CODES_CHANNEL_ID}) kèm tag Role (${WUWA_ROLE_ID})!`);
    }

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
 * Initialize WuWa Code Auto Watcher
 * Runs immediately on startup and sets periodic timer (30 mins)
 * @param {import("discord.js").Client} client
 */
function initWuwaCodeWatcher(client) {
  console.log(`🚀 [WuWa Code Watcher] Đã kích hoạt theo dõi Code tự động cho kênh (${WUWA_CODES_CHANNEL_ID})!`);

  // Hydrate known codes from MongoDB Atlas on startup
  WuwaCodeModel.find({}).then((docs) => {
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        knownCodesSet.add(doc.code);
      }
      console.log(`🍃 [WuWa Code Watcher] Đã load ${docs.length} code đã biết từ MongoDB.`);
    }
  }).catch(() => {});

  // Run initial check after 5 seconds
  setTimeout(() => {
    checkAndNotifyWuwaCodes(client);
  }, 5000);

  // Set recurring check every 30 minutes (1,800,000 ms)
  setInterval(() => {
    checkAndNotifyWuwaCodes(client);
  }, 30 * 60 * 1000);
}

module.exports = {
  initWuwaCodeWatcher,
  checkAndNotifyWuwaCodes,
  addManualCode,
  listManualCodes,
  updateManualCode,
  deleteManualCode,
};
