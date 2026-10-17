// scripts/dispatch_all_wuwa_codes.js
const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { scrapeWuwaCodes } = require("../src/features/wuwaCodes/wuwaScraper");
const { createWuwaCodeEmbed } = require("../src/features/wuwaCodes/embedBuilder");
const { isCodeExpired } = require("../src/features/wuwaCodes/wuwaUtils");
const WuwaCodeModel = require("../src/database/models/WuwaCode");
const { WUWA_CODES_CHANNEL_ID } = require("../src/config/env");

const DEMO_CHANNEL_ID = WUWA_CODES_CHANNEL_ID || "1547084091868844142";

async function main() {
  console.log(`🚀 Bắt đầu tiến trình gửi toàn bộ code Wuthering Waves vào kênh demo <#${DEMO_CHANNEL_ID}>...`);

  // 1. Kết nối MongoDB
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("🍃 Đã kết nối MongoDB thành công.");
    } catch (dbErr) {
      console.warn("⚠️ Không thể kết nối MongoDB, tiếp tục chế độ bộ nhớ:", dbErr.message);
    }
  }

  // 2. Thu thập code từ Scraper
  const scrapedCodes = (await scrapeWuwaCodes()) || [];
  console.log(`🔍 Tìm thấy ${scrapedCodes.length} code từ Web Scraper.`);

  // 3. Khởi tạo Discord Client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async () => {
    try {
      console.log(`🤖 Bot đã đăng nhập: ${client.user.tag}`);
      const channel = await client.channels.fetch(DEMO_CHANNEL_ID).catch((err) => {
        console.error(`❌ Không thể truy cập kênh ${DEMO_CHANNEL_ID}:`, err.message);
        return null;
      });

      if (!channel || !channel.isTextBased()) {
        console.error("❌ Kênh không tồn tại hoặc không phải kênh văn bản.");
        process.exit(1);
      }

      // 4. Xóa toàn bộ tin nhắn WuWa cũ trong kênh demo (bao gồm SHOREKEEPER và các tin nhắn 2 nút trước đó)
      try {
        const recent = await channel.messages.fetch({ limit: 15 });
        for (const msg of recent.values()) {
          if (msg.embeds && msg.embeds.some((e) => e.title && e.title.includes("Wuthering Waves"))) {
            await msg.delete().catch(() => {});
            console.log(`🗑️ Đã xóa tin nhắn WuWa cũ (${msg.id}).`);
          }
        }
      } catch (cleanErr) {
        console.warn("⚠️ Không thể kiểm tra/xóa tin nhắn cũ:", cleanErr.message);
      }

      // 5. Lọc các code còn hạn
      const activeCodes = scrapedCodes.filter((c) => !isCodeExpired(c.duration));
      console.log(`📋 Danh sách ${activeCodes.length} code còn hiệu lực:`, activeCodes.map((c) => c.code).join(", "));

      // 6. Gửi từng code vào kênh demo
      for (const codeObj of activeCodes) {
        try {
          const { embed, components } = await createWuwaCodeEmbed(codeObj);
          await channel.send({
            embeds: [embed],
            components,
          });
          console.log(`✅ [ĐÃ GỬI] Code "${codeObj.code}" đã được gửi thành công vào kênh demo <#${DEMO_CHANNEL_ID}>!`);

          // Cập nhật DB
          if (mongoose.connection.readyState === 1) {
            await WuwaCodeModel.findOneAndUpdate(
              { code: codeObj.code },
              {
                code: codeObj.code,
                server: codeObj.server || "All",
                rewards: codeObj.rewards || [],
                rewardsText: codeObj.rewardsText || "• Không rõ phần thưởng",
                duration: codeObj.duration || "Còn hiệu lực",
                isActive: true,
                notified: true,
              },
              { upsert: true, returnDocument: "after" }
            );
          }

          // Chờ 1.5 giây giữa các tin nhắn để giữ đúng thứ tự và tránh rate limit
          await new Promise((r) => setTimeout(r, 1500));
        } catch (sendErr) {
          console.error(`❌ Lỗi gửi code "${codeObj.code}":`, sendErr.message);
        }
      }

      console.log("🎉 Hoàn tất gửi toàn bộ code Wuthering Waves vào kênh demo!");
    } catch (err) {
      console.error("❌ Lỗi trong quá trình xử lý:", err);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
      client.destroy();
      process.exit(0);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

main();
