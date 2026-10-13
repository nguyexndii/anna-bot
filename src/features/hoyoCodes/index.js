// src/features/hoyoCodes/index.js
const { scrapeAllHoyoCodes } = require("./hoyoScraper");
const { createHoyoCodeMessage } = require("./embedBuilder");
const HoyoCodeModel = require("../../database/models/HoyoCode");
const { HOYO_CODES_CHANNEL_ID, HOYO_ROLE_ID } = require("../../config/env");

// Set ghi nhớ các code đã biết trong RAM
const knownHoyoCodesSet = new Set();

/**
 * Kiểm tra và thông báo các mã code mới của HoYoverse vào kênh Discord chính thức
 * @param {import("discord.js").Client} client
 */
async function checkAndNotifyHoyoCodes(client) {
  try {
    const targetChannelId = HOYO_CODES_CHANNEL_ID || "1528768068581457930";
    console.log(`🔄 [Hoyo Code Watcher] Đang kiểm tra code Genshin, HSR & ZZZ cho kênh <#${targetChannelId}>...`);

    // 1. Cào live toàn bộ code từ web
    const allScraped = await scrapeAllHoyoCodes();
    const liveCodesList = [
      ...allScraped.genshin,
      ...allScraped.hsr,
      ...allScraped.zzz,
    ];

    if (liveCodesList.length === 0) {
      console.log("ℹ️ [Hoyo Code Watcher] Không có code nào từ web.");
      return;
    }

    // 2. Fetch kênh Discord
    const channel = await client.channels.fetch(targetChannelId).catch((err) => {
      console.error(`❌ [Hoyo Code Watcher] Không thể fetch channel (${targetChannelId}):`, err.message);
      return null;
    });

    // 3. Quét tối đa 100 tin nhắn gần nhất trong kênh để không bao giờ gửi trùng
    const codesInChannel = new Set();
    if (channel && channel.isTextBased()) {
      try {
        const recentMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (recentMessages && recentMessages.size > 0) {
          recentMessages.forEach((msg) => {
            // Quét qua nội dung tin nhắn thường
            if (msg.content) {
              const contentMatches = msg.content.matchAll(/(`|\*\*)([A-Za-z0-9_-]{4,40})(`|\*\*)/g);
              for (const cm of contentMatches) {
                codesInChannel.add(cm[2].toUpperCase());
              }
            }

            // Quét qua các Embeds (tiêu đề và mô tả)
            if (msg.embeds && msg.embeds.length > 0) {
              for (const emb of msg.embeds) {
                const targetText = `${emb.title || ""} ${emb.description || ""}`;
                const matches = targetText.matchAll(/(`|\*\*)([A-Za-z0-9_-]{4,40})(`|\*\*)/g);
                for (const m of matches) {
                  codesInChannel.add(m[2].toUpperCase());
                }
              }
            }

            // Quét qua các Buttons (URL và Label) để bắt trọn vẹn 100% mã code
            if (msg.components && msg.components.length > 0) {
              for (const row of msg.components) {
                if (row.components) {
                  for (const comp of row.components) {
                    if (comp.url) {
                      const urlMatch = comp.url.match(/code=([A-Za-z0-9_-]+)/i);
                      if (urlMatch) codesInChannel.add(urlMatch[1].toUpperCase());
                    }
                    if (comp.label) {
                      const labelMatch = comp.label.match(/([A-Za-z0-9_-]{4,40})/);
                      if (labelMatch) codesInChannel.add(labelMatch[1].toUpperCase());
                    }
                  }
                }
              }
            }
          });
        }
      } catch (fetchErr) {
        console.error("⚠️ Không thể đọc tin nhắn cũ trong kênh:", fetchErr.message);
      }
    }

    // 4. Lọc và gửi thông báo cho code mới
    for (const codeObj of liveCodesList) {
      const codeKey = `${codeObj.game}_${codeObj.code}`;
      const isAlreadyInChannel = codesInChannel.has(codeObj.code);
      const isAlreadyKnown = knownHoyoCodesSet.has(codeKey);

      let existingDoc = null;
      try {
        existingDoc = await HoyoCodeModel.findOne({ game: codeObj.game, code: codeObj.code });
      } catch (dbErr) {}

      // CHỈ GỬI THÔNG BÁO NẾU:
      // 1. Code chưa từng xuất hiện trong kênh Discord (!isAlreadyInChannel)
      // 2. VÀ Code KHÔNG PHẢI là code cũ trước thời điểm kích hoạt hôm nay (!isAlreadyKnown && (!existingDoc || !existingDoc.notified))
      if (!isAlreadyInChannel && !isAlreadyKnown && (!existingDoc || !existingDoc.notified)) {
        console.log(`🎉 [Hoyo Code Watcher] PHÁT HIỆN CODE MỚI TINH (${codeObj.game.toUpperCase()}): "${codeObj.code}"!`);

        // Lưu vào DB & Set bộ nhớ
        knownHoyoCodesSet.add(codeKey);
        try {
          await HoyoCodeModel.findOneAndUpdate(
            { game: codeObj.game, code: codeObj.code },
            {
              game: codeObj.game,
              code: codeObj.code,
              server: codeObj.server || "Tất cả",
              rewardsText: codeObj.rewardsText || "• Chưa có thông tin phần thưởng",
              duration: codeObj.duration || "Còn hiệu lực",
              redeemUrl: codeObj.redeemUrl || "",
              isActive: true,
              notified: true,
            },
            { upsert: true, returnDocument: "after" }
          );
        } catch (dbSaveErr) {
          console.error(`⚠️ Không thể lưu code "${codeObj.code}" vào DB:`, dbSaveErr.message);
        }

        // Gửi tin nhắn Embed kèm nút bấm
        if (channel && channel.isTextBased()) {
          try {
            const { embed, components } = createHoyoCodeMessage(codeObj);
            const roleMention = HOYO_ROLE_ID ? `<@&${HOYO_ROLE_ID}>` : null;
            await channel.send({
              content: roleMention || undefined,
              embeds: [embed],
              components,
            });
            codesInChannel.add(codeObj.code);
            console.log(`✅ Đã gửi thông báo code ${codeObj.game.toUpperCase()} "${codeObj.code}" tới kênh chính (${targetChannelId})!`);
          } catch (sendErr) {
            console.error(`❌ Lỗi gửi tin nhắn code "${codeObj.code}":`, sendErr.message);
          }
        }
      } else {
        // Đã biết hoặc đã có trong kênh -> cập nhật DB & Set bộ nhớ để không bao giờ gửi lại
        knownHoyoCodesSet.add(codeKey);
        if (existingDoc && !existingDoc.notified) {
          existingDoc.notified = true;
          await existingDoc.save().catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("❌ [Hoyo Code Watcher] Lỗi trong chu kỳ kiểm tra code:", err);
  }
}

/**
 * Khởi tạo bộ theo dõi Code HoYoverse tự động
 * @param {import("discord.js").Client} client
 */
function initHoyoCodeWatcher(client) {
  const targetChannelId = HOYO_CODES_CHANNEL_ID || "1528768068581457930";
  console.log(`🚀 [Hoyo Code Watcher] Đã kích hoạt theo dõi Code Genshin, HSR & ZZZ cho kênh chính thức (${targetChannelId})!`);

  // 1. Nạp danh sách code đã biết từ MongoDB Atlas
  HoyoCodeModel.find({}).then(async (docs) => {
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        knownHoyoCodesSet.add(`${doc.game}_${doc.code}`);
      }
      console.log(`🍃 [Hoyo Code Watcher] Đã nạp ${docs.length} code HoYoverse đã biết từ MongoDB.`);
    }

    // 2. Chốt toàn bộ code hiện tại trên web làm mốc cũ (Baseline)
    // Tuyệt đối không gửi spam những code đã phát hành trước thời điểm kích hoạt hôm nay
    try {
      const allScraped = await scrapeAllHoyoCodes();
      const allCurrent = [...allScraped.genshin, ...allScraped.hsr, ...allScraped.zzz];
      for (const c of allCurrent) {
        knownHoyoCodesSet.add(`${c.game}_${c.code}`);
        await HoyoCodeModel.findOneAndUpdate(
          { game: c.game, code: c.code },
          {
            game: c.game,
            code: c.code,
            server: c.server || "Tất cả",
            rewardsText: c.rewardsText || "• Chưa có thông tin phần thưởng",
            duration: c.duration || "Còn hiệu lực",
            redeemUrl: c.redeemUrl || "",
            isActive: true,
            notified: true,
          },
          { upsert: true }
        ).catch(() => {});
      }
      console.log(`🔒 [Hoyo Code Watcher] Đã khóa mốc ban đầu (${knownHoyoCodesSet.size} code cũ sẽ không bị gửi lại).`);
    } catch (baselineErr) {
      console.error("⚠️ Lỗi chốt baseline code cũ:", baselineErr.message);
    }
  }).catch(() => {});

  // Chạy lần đầu sau 8 giây khi bot khởi động
  setTimeout(() => {
    checkAndNotifyHoyoCodes(client);
  }, 8000);

  // Định kỳ chạy mỗi 30 phút (1,800,000 ms)
  setInterval(() => {
    checkAndNotifyHoyoCodes(client);
  }, 30 * 60 * 1000);
}

module.exports = {
  initHoyoCodeWatcher,
  checkAndNotifyHoyoCodes,
};
