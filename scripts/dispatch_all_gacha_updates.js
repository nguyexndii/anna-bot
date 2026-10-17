// scripts/dispatch_all_gacha_updates.js
const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { buildForumPostPayload } = require("../src/features/gachaUpdates/embedBuilder");
const GachaForumPost = require("../src/database/models/GachaForumPost");
const { GACHA_UPDATE_FORUM_CHANNEL_ID } = require("../src/config/env");

const TARGET_CHANNEL_ID = GACHA_UPDATE_FORUM_CHANNEL_ID || "1559744328899887195";

const GACHA_UPDATES_DATA = [
  {
    game: "hsr",
    articleId: "46861607",
    title: "Honkai: Star Rail — Chi tiết Bản 4.6 [Dance With the Beast Before Moonrise]",
    bannerUrl: "https://upload-os-bbs.hoyolab.com/upload/community/2026/10/08/445eff9915166d9bcdbd60b279933ff8_739955734522521317.png",
    postUrl: "https://www.hoyolab.com/article/46861607",
    btnText: "Xem bài gốc HoYoLAB",
    publishedAt: new Date("2026-10-08T06:00:00.000Z"),
    summary: `### 📅 Phiên bản & Thời gian
Phiên bản 4.6 **"Dance With the Beast Before Moonrise"** đã chính thức phát hành sau đợt bảo trì hệ thống máy chủ toàn cầu.

### 🎯 Banner Nhân vật & Nón Ánh Sáng mới
• **Pearl (5★ Băng, Hư Cấu):** Vận mệnh Hư Cấu với cơ chế phòng thủ đặc biệt, có khả năng chia sẻ sát thương toàn đội, gia tăng thanh hành động đồng minh và thanh tẩy hiệu ứng xấu.
• **Colors for Tomorrow (5★ Hư Cấu):** Nón trấn độc quyền gia tăng mạnh hiệu quả phòng thủ và tỉ lệ bạo kích cho đồng đội.

### 🗺️ Cốt truyện & Bản đồ / Khu vực mới
• **Nhiệm vụ Khai Phá Astropolis:** Khởi đầu hành trình sử thi đối đầu quái thú cổ xưa thức tỉnh từ giấc ngủ ngàn năm.
• **Viện Khoa học Sự sống:** Mở khóa trung tâm nghiên cứu bí mật của Giáo sư Yabuli thuộc Bộ Công nghệ.

### 🎁 Sự kiện nổi bật & Quà tặng
• **Gift of Odyssey:** Điểm danh 7 ngày nhận ngay 10 Vé Tinh Cầu Đặc Biệt.
• **Wishpower UP! Down with Voracity!:** Đánh bại quái vật đột biến nhận ngay 500 Ngọc Ánh Sao và nguyên liệu nâng cấp quý giá.
• **Love, Ghosts & Robots:** Tham gia chuỗi minigame nhận phụ kiện đầu giới hạn "Lone Wolf Shades".

### ⚙️ Cải tiến tính năng (QoL nổi bật)
• **Finality's Vision:** Trải nghiệm trước cốt truyện chính tuyến và sự kiện giới hạn mà không cần hoàn thành toàn bộ chuỗi nhiệm vụ tiền đề.
• **Currency Wars x2:** Nhân đôi điểm thăng cấp và tài nguyên bồi dưỡng trong suốt thời gian diễn ra sự kiện.

### ✉️ Đền bù bảo trì
Đã gửi **600 Ngọc Ánh Sao** (300 đền bù bảo trì + 300 sửa lỗi) trực tiếp qua hòm thư Khai Phá.`
  },
  {
    game: "genshin",
    articleId: "46791577",
    title: "Genshin Impact — Chi tiết Bản 7.1 [A Rekviem for the Underworld]",
    bannerUrl: "https://upload-os-bbs.hoyolab.com/upload/2026/09/30/05c288b456815fbaf6aeb54f362f4f9f_3170646147861150357.png",
    postUrl: "https://www.hoyolab.com/article/46791577",
    btnText: "Xem bài gốc HoYoLAB",
    publishedAt: new Date("2026-09-30T06:00:00.000Z"),
    summary: `### 📅 Phiên bản & Thời gian
Phiên bản 7.1 **"A Rekviem for the Underworld"** đã chính thức khai mở sau 5 giờ bảo trì hệ thống máy chủ toàn cầu.

### 🎯 Banner Nhân vật & Vũ khí mới
• **Vesna (5★ Anemo, Đơn Kiếm):** "Lưỡi Kiếm Yến Tiệc Tuyết" — Đội trưởng Druzhna với lối chơi DPS Phong bùng nổ phản ứng Stellar Swirl.
• **Vodyanitsa (5★ Thủy, Pháp Khí):** "Khúc Ca Nàng Tiên Cá Vọng Mãi" — Prima Donna của Đoàn kịch Korolevskiy, hỗ trợ Thủy đa dụng vừa buff sát thương vừa hồi máu.
• **Vũ khí trấn 5★ mới:** Đơn kiếm "Beyond the Chrysalis" (tăng sát thương bạo kích và phục hồi năng lượng) và Pháp khí "Hymn of the Maelstrom".

### 🗺️ Cốt truyện & Bản đồ / Khu vực mới
• **Nhiệm vụ Ma Thần:** Khởi động Chương VII Màn III ("Đêm Trắng, Như Giấc Mơ Khi Tỉnh Giấc") & Màn IV ("A Rekviem for the Underworld").
• **Khu vực mới & Kẻ địch:** Bản đồ vùng băng giá Zapolyarny mở rộng cùng thủ lĩnh thế giới mới **Guardian Blade of Drifting Snow**.

### 🎁 Sự kiện nổi bật & Quà tặng
• **Sự kiện "Silverwing in Pursuit of the Moon":** Nhận miễn phí kiếm đơn 4 sao độc quyền **"Silver Light"** và vật phẩm tinh luyện Max R5.
• **Secret Tsarist Assignments:** Nhiệm vụ mật báo hàng tuần nhận Bản thiết kế Ấm Trần Ca và Nguyên Thạch.

### ⚙️ Cải tiến tính năng (QoL nổi bật)
Tối ưu hóa bộ lọc Thánh Di Vật theo thuộc tính phụ ưu tiên, bổ sung chế độ tải trước tài nguyên phân mảnh giúp giảm 30% thời gian cập nhật.

### ✉️ Đền bù bảo trì
Đã gửi **600 Nguyên Thạch** (300 bảo trì + 300 sửa lỗi) vào hòm thư cho tất cả Nhà Lữ Hành đạt Hạng Mạo Hiểm 5 trở lên.`
  },
  {
    game: "zzz",
    articleId: "46622788",
    title: "Zenless Zone Zero — Chi tiết Bản 3.2 [Their Secret Histories]",
    bannerUrl: "https://upload-os-bbs.hoyolab.com/upload/2026/10/10/0/4cde49db74e4409d89b172b9f25bf7a1_2026513355199788801.jpeg",
    postUrl: "https://www.hoyolab.com/article/46622788",
    btnText: "Xem bài gốc HoYoLAB",
    publishedAt: new Date("2026-10-10T06:00:00.000Z"),
    summary: `### 📅 Phiên bản & Thời gian
Phiên bản 3.2 **"Their Secret Histories"** đã chính thức cập bến thành phố New Eridu!

### 🎯 Banner Nhân vật & Vũ khí mới
• **Người Đại Diện Cấp S Mới:** Nhân vật tấn công vật lý mới gia nhập hàng ngũ Proxy với chuỗi đòn đánh phối hợp siêu nhanh.
• **W-Engine Cấp S Độc Quyền:** Vũ khí chuyên dụng tăng mạnh hiệu quả Xuyên Thấu và sát thương dứt điểm kẻ địch bị choáng.

### 🗺️ Cốt truyện & Bản đồ / Khu vực mới
• **Chương Cốt Truyện Mới:** Mở khóa hồ sơ bí mật về nguồn gốc hình thành của các Lỗ Hổng Zero nguyên thủy.
• **Ủy Thác Điều Tra Lỗ Hổng:** Bổ sung hàng loạt khu vực Hollow mới với địa hình biến đổi liên tục và bẫy Ether nguy hiểm.

### 🎁 Sự kiện nổi bật & Quà tặng
• **Băng Ghi Hình Mã Hóa:** Tham gia chuỗi nhiệm vụ Proxy nhận ngay 10 lần quay gacha giới hạn miễn phí.
• **Sự kiện tích lũy Phim Màu (Polychrome):** Thưởng dồi dào tài nguyên phục vụ việc triệu hồi người đại diện mới.

### ⚙️ Cải tiến tính năng (QoL nổi bật)
Nâng cấp độ mượt animation chiêu thức liên kích Chain Attack, bổ sung tính năng farm nhanh tài nguyên khiêu chiến chỉ với một chạm.

### ✉️ Đền bù bảo trì
Hộp thư đã nhận **600 Phim Màu (Polychrome)** (300 bảo trì + 300 sửa lỗi) dành cho mọi Proxy đủ điều kiện.`
  },
  {
    game: "wuwa",
    articleId: "5513",
    title: "Wuthering Waves — Chi tiết Bản 3.7 [As Full as Tonight, Forever]",
    bannerUrl: "https://hw-pcdownload-qcloud.aki-game.net/launcher/news/slide-picture/087sw5peq5mquvlulz.png",
    postUrl: "https://wutheringwaves.kurogames.com/en/main/news/detail/5513",
    btnText: "Xem cổng tin Kuro Games",
    publishedAt: new Date("2026-09-28T06:00:00.000Z"),
    summary: `### 📅 Phiên bản & Thời gian
Bản cập nhật 3.7 **"As Full as Tonight, Forever"** đã chính thức cập bến Solaris-3 sau đợt bảo trì hoàn tất.

### 🎯 Banner Nhân vật & Vũ khí mới
• **Resonator 5★ Phase I & Phase II:** Xuất hiện các Resonator 5 sao giới hạn mới mang cơ chế cộng hưởng nguyên tố độc đáo.
• **Vũ khí trấn 5★ độc quyền:** Trang bị trấn phái tối ưu hóa toàn diện sức mạnh bùng nổ kỹ năng Resonance Liberation.

### 🗺️ Cốt truyện & Bản đồ / Khu vực mới
• **Lễ hội Moon Festival:** Trải nghiệm đại lễ trăng tròn lung linh tại Huanglong với hàng loạt nhiệm vụ phong tục đặc sắc.
• **Khu vực mở rộng mới:** Khám phá vùng đất hoang sơ kỳ bí cùng hệ thống giải đố âm thanh và cơ chế leo trèo tự do.

### 🎁 Sự kiện nổi bật & Quà tặng
• **Sự kiện UGC Waking Moon:** Thử thách sáng tạo chiến đấu nhận vé quay Thủy Triều Rạng Rỡ và danh hiệu độc quyền.
• **Quà tặng Astrite dồi dào:** Tích lũy hàng ngàn Astrite miễn phí xuyên suốt thời gian diễn ra lễ hội.
• **Echo giới hạn:** Cơ hội thuần hóa và thu phục Echo cấp bậc Overlord độc quyền.

### ⚙️ Cải tiến tính năng (QoL nổi bật)
Ra mắt tính năng Tải tài nguyên phân tầng (Tiered Client Resource Downloads) giúp giảm tải dung lượng ổ cứng và tối ưu bộ lọc, sắp xếp Echo thông minh.

### ✉️ Đền bù bảo trì
Đã gửi **600 Astrite** trực tiếp qua hòm thư cho toàn thể Rover.`
  },
  {
    game: "endfield",
    articleId: "endfield_1.6_highlight",
    title: "Arknights: Endfield — Chi tiết Bản 1.6 [Sanctuary of Ink]",
    bannerUrl: "https://web-static.hg-cdn.com/upload/image/20261012/6522503e31c3e8aa7cecc1fc9c19f2e8.jpg",
    postUrl: "https://endfield.gryphline.com/news",
    btnText: "Xem cổng tin Gryphline",
    publishedAt: new Date("2026-10-12T06:00:00.000Z"),
    summary: `### 📅 Phiên bản & Thời gian
Core Chapter 1.6: **"Sanctuary of Ink"** đã chính thức phát hành trên toàn cầu cho tất cả các Operator thuộc Endfield Industries!

### 🎯 Banner Nhân vật & Vũ khí mới
• **Operator Cấp Cao Mới:** Kỹ sư vận hành chuyên sâu dây chuyền công nghiệp AIC, sở hữu kỹ năng khống chế diện rộng và hỗ trợ năng lượng vượt trội.
• **Vũ khí độc quyền:** Trang bị chuyên biệt cộng hưởng trường từ tính và gia tăng sản lượng khai khoáng AIC.

### 🗺️ Cốt truyện & Bản đồ / Khu vực mới
• **Sanctuary of Ink (Vùng Đất Mực):** Quần xã địa hình mới trên Talos-II với lớp sương mực độc hại và các công trình tàn tích cổ đại.
• **Nhiệm vụ cốt truyện AIC:** Mở rộng tuyến truyện giải mã nguồn năng lượng bí ẩn bên dưới đáy thung lũng Mực.

### 🎁 Sự kiện nổi bật & Quà tặng
• **Quà mừng ra mắt bản 1.6:** Nhận ngay vé tuyển mộ Operator cao cấp và gói tài nguyên công nghiệp qua cổng SKPORT.
• **Sự kiện khai hoang Talos:** Đạt mốc sản lượng nhà máy nhận hàng ngàn Oroberyl và T-Credits.

### ⚙️ Cải tiến tính năng (QoL nổi bật)
• **Auto-Farmer:** Tự động hóa hoàn toàn chu trình gieo hạt, bón phân và thu hoạch nguyên liệu nông nghiệp AIC.
• **Góc nhìn Top-View:** Chế độ xem từ trên cao giúp kiến thiết và nối dây chuyền nhà máy trực quan, dễ dàng.
• **Chia sẻ Blueprint:** Sao chép và chia sẻ sơ đồ nhà máy công nghiệp cùng bạn bè chỉ với một mã code.
• **Phát hành Steam Client:** Tối ưu hóa mượt mà cho trải nghiệm chuột/bàn phím trên máy tính PC.

### ✉️ Đền bù bảo trì
Toàn bộ phần thưởng **Oroberyl & T-Credits** đã được chuyển thẳng tới hòm thư cá nhân của các Operator.`
  }
];

async function main() {
  console.log(`🚀 Bắt đầu gửi lại 5 bài cập nhật (Giao diện mới: Ảnh trên - Chữ dưới) vào kênh <#${TARGET_CHANNEL_ID}>...`);

  // 1. Kết nối MongoDB
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("🍃 Đã kết nối MongoDB thành công.");
    } catch (e) {
      console.warn("⚠️ Không thể kết nối MongoDB:", e.message);
    }
  }

  // 2. Khởi tạo Discord Client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once("ready", async () => {
    try {
      console.log(`🤖 Bot đã đăng nhập: ${client.user.tag}`);
      const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch((e) => {
        console.error(`❌ Không tìm thấy kênh ${TARGET_CHANNEL_ID}:`, e.message);
        return null;
      });

      if (!channel) {
        console.error("❌ Không thể truy cập kênh đích.");
        process.exit(1);
      }

      console.log(`📌 Kênh đích: #${channel.name} (${channel.id})`);

      // 3. Dọn dẹp tin nhắn cũ và thread cũ trong kênh
      try {
        console.log("🧹 Đang dọn dẹp tin nhắn cũ trong kênh...");
        const oldMessages = await channel.messages.fetch({ limit: 20 });
        for (const msg of oldMessages.values()) {
          // Xóa tin nhắn nếu có thread con đi kèm
          if (msg.thread) {
            await msg.thread.delete().catch(() => {});
          }
          await msg.delete().catch(() => {});
          console.log(`🗑️ Đã xóa tin nhắn cũ ID: ${msg.id}`);
        }
      } catch (delErr) {
        console.warn("⚠️ Cảnh báo dọn dẹp tin nhắn cũ:", delErr.message);
      }

      // 4. Gửi từng bài theo giao diện mới (KHÔNG tạo luồng thảo luận, chỉ là tin nhắn thường)
      for (let i = 0; i < GACHA_UPDATES_DATA.length; i++) {
        const update = GACHA_UPDATES_DATA[i];
        console.log(`\n⏳ [${i + 1}/5] Đang đăng bài [${update.game.toUpperCase()}]: ${update.title}...`);

        const payload = buildForumPostPayload(client, update, update.summary);

        // Gửi tin nhắn thường duy nhất, KHÔNG startThread
        const sentMsg = await channel.send(payload.message);
        console.log(`✅ Đã gửi bản tin thành công: [${payload.threadName}] (Msg ID: ${sentMsg.id})`);

        // Cập nhật DB
        if (mongoose.connection.readyState === 1) {
          await GachaForumPost.findOneAndUpdate(
            { articleId: update.articleId },
            {
              game: update.game,
              articleId: update.articleId,
              title: update.title,
              postUrl: update.postUrl,
              bannerUrl: update.bannerUrl,
              threadId: sentMsg.id,
              publishedAt: update.publishedAt,
            },
            { upsert: true, returnDocument: "after" }
          );
        }

        // Nghỉ 2.5 giây giữa các bài để đảm bảo thứ tự và tránh rate limit
        if (i < GACHA_UPDATES_DATA.length - 1) {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }

      console.log("\n🎉 HOÀN TẤT: Đã gửi lại 5 bài theo giao diện mới (Ảnh trên - Chữ dưới, không tạo thảo luận)!");
    } catch (err) {
      console.error("❌ Lỗi trong quá trình đăng bài:", err);
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
