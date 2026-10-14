// index.js
require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, Events } = require("discord.js");

const {
  DISCORD_TOKEN,
  IS_TEST_MODE,
  PROD_CHANNELS,
  TEST_CHANNELS,
  WORDCHAIN_CHANNEL_ID,
  WORDSCRAMBLE_CHANNEL_ID,
  RULES_CHANNEL_ID,
  WUWA_CODES_CHANNEL_ID,
  HOYO_CODES_CHANNEL_ID,
  ENDFIELD_CODES_CHANNEL_ID,
  ALLOWED_GUILD_IDS,
  KEEP_VOICE_CHANNEL_ID,
  ENABLE_VOICE_KEEPER,
  ADMIN_ID,
  GACHA_UPDATE_FORUM_CHANNEL_ID,
} = require("./src/config/env");

const { initStatusNotifier } = require("./src/utils/statusNotifier");

// 24/7 Smart Voice Room Keeper
const { initVoiceKeeper, getVoiceKeeperStatus } = require("./src/features/voiceKeeper");

const isAllowedGuild = (guildId) => {
  if (!ALLOWED_GUILD_IDS || ALLOWED_GUILD_IDS.length === 0) return true;
  return ALLOWED_GUILD_IDS.includes(guildId);
};

const { sendWebhook } = require("./src/utils/webhook.service");
const { connectDatabase } = require("./src/database/mongoose");
const LeaderboardModel = require("./src/database/models/Leaderboard");

// Word Chain & Word Scramble Features
const { onWordChainMessage, scheduleBotTurn } = require("./src/features/wordchain/messageHandler");
const { onWordScrambleMessage } = require("./src/features/wordscramble/messageHandler");
const { startGame, getWordChainScoresMap, restoreWordChainState } = require("./src/features/wordchain/game.service");
const { startScrambleRound, getScrambleState, restoreScrambleState } = require("./src/features/wordscramble/scramble.service");
const { createDetailedRulesEmbed } = require("./src/features/wordchain/embedBuilder");
const { createScrambleChallengeEmbed } = require("./src/features/wordscramble/embedBuilder");

// WuWa Code Watcher & Commands
const { initWuwaCodeWatcher } = require("./src/features/wuwaCodes");
const { onWuwaCodeMessage } = require("./src/features/wuwaCodes/commandHandler");

// HoYoverse (Genshin, HSR, ZZZ) Code Watcher
const { initHoyoCodeWatcher } = require("./src/features/hoyoCodes");

// Arknights: Endfield Code Watcher
const { initEndfieldCodeWatcher } = require("./src/features/endfieldCodes");

// Gacha Updates Forum Watcher (Tự động tóm tắt & đăng bài Forum)
const { initGachaUpdateWatcher } = require("./src/features/gachaUpdates");

// Master Help Command (!lenh, !help, !command, !comment...)
const { onHelpMessage, isMasterHelpCommand } = require("./src/features/helpCommand");

// Global Error Handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// =========================================================================
// LIGHTWEIGHT EXPRESS SERVER (KEEP-ALIVE FOR HOSTING 24/7)
// =========================================================================
const app = express();
const PORT = process.env.PORT || 3000;

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} ngày`);
  if (h > 0) parts.push(`${h} giờ`);
  if (m > 0) parts.push(`${m} phút`);
  parts.push(`${s} giây`);

  return parts.join(" ");
}



app.get("/", (req, res) => {
  res.json({
    status: "online",
    botName: "Anna Bot (Minigames, WuWa & Voice Keeper)",
    isReady: client ? client.isReady() : false,
    uptime: formatUptime(process.uptime()),
    ping: client && client.ws ? `${client.ws.ping}ms` : "N/A",
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`🚀 Keep-Alive Server đang lắng nghe tại port ${PORT}`);
});

// =========================================================================
// DISCORD CLIENT SETUP
// =========================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

initStatusNotifier(client, {
  adminId: ADMIN_ID || "875358286487097395",
  botName: "Anna Bot (Minigames & WuWa)",
  platform: "Render Hosting",
});

/**
 * Hydrate leaderboard scores from MongoDB Atlas into memory
 */
async function hydrateMongoData() {
  try {
    const docs = await LeaderboardModel.find({});
    if (docs && docs.length > 0) {
      const wcMap = getWordChainScoresMap();
      const scrambleState = getScrambleState();
      for (const doc of docs) {
        if (doc.game === "wordchain") {
          wcMap.set(doc.userId, { id: doc.userId, username: doc.username, wins: doc.wins });
        } else if (doc.game === "wordscramble") {
          scrambleState.scores.set(doc.userId, { username: doc.username, wins: doc.wins });
        }
      }
      console.log(`📊 Đã đồng bộ ${docs.length} bản ghi Bảng xếp hạng từ MongoDB Atlas!`);
    }
  } catch (err) {
    console.error("❌ Lỗi đồng bộ từ MongoDB Atlas:", err.message);
  }
}

// Bot Ready Event
client.once(Events.ClientReady, async () => {
  console.log(`🟢 Anna Bot đã online: ${client.user.tag}`);

  if (IS_TEST_MODE) {
    console.log("🧪 Đang chạy [CHẾ ĐỘ TEST] trên các kênh:");
    console.log(`   - Nối Từ:       <#${WORDCHAIN_CHANNEL_ID}>`);
    console.log(`   - Sắp Xếp Từ:   <#${WORDSCRAMBLE_CHANNEL_ID}>`);
    console.log(`   - Săn Code:     <#${WUWA_CODES_CHANNEL_ID}>`);
  } else {
    console.log("🚀 Đang chạy [CHẾ ĐỘ CHÍNH THỨC] trên các kênh Production.");
  }

  // Enforce Allowed Guilds Mode if configured
  if (ALLOWED_GUILD_IDS && ALLOWED_GUILD_IDS.length > 0) {
    console.log(`🔒 Chế độ Riêng tư: Bot chỉ phục vụ các Server ID: ${ALLOWED_GUILD_IDS.join(", ")}`);
    if (client.guilds && client.guilds.cache.size > 0) {
      client.guilds.cache.forEach((guild) => {
        if (!isAllowedGuild(guild.id)) {
          console.warn(`⚠️ Bot đang nằm ở Server không hợp lệ: "${guild.name}" (${guild.id}). Tiến hành tự động rời...`);
          guild.leave().catch((err) => console.error(`❌ Lỗi khi rời Server ${guild.id}:`, err.message));
        }
      });
    }
  }

  // Connect MongoDB Atlas
  const isDbConnected = await connectDatabase();
  if (isDbConnected) {
    await hydrateMongoData();
  }

  // Check and send detailed rules embed if needed (Chỉ gửi vào kênh luật chính thức nếu chưa có)
  if (!IS_TEST_MODE && RULES_CHANNEL_ID) {
    try {
      const rulesChannel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
      if (rulesChannel && rulesChannel.isTextBased()) {
        const recentMessages = await rulesChannel.messages.fetch({ limit: 10 }).catch(() => null);
        const alreadySent = recentMessages && recentMessages.some(
          (msg) => msg.embeds && msg.embeds.some((e) => e.title && e.title.includes("KHU GIẢI TRÍ"))
        );

        if (!alreadySent) {
          const detailedRulesEmbed = createDetailedRulesEmbed();
          await rulesChannel.send({ embeds: [detailedRulesEmbed] });
          console.log(`📌 Đã gửi BẢNG NỘI QUY CHI TIẾT vào Kênh Luật (${RULES_CHANNEL_ID})`);
        }
      }
    } catch (err) {
      console.error("❌ Error checking/sending rules embed:", err.message);
    }
  }

  // Initialize WordChain game (Khôi phục ván chơi dở dang nếu có)
  try {
    const chainChannel = await client.channels.fetch(WORDCHAIN_CHANNEL_ID).catch(() => null);
    if (chainChannel && chainChannel.isTextBased()) {
      const { restored, state } = await restoreWordChainState(chainChannel);
      if (restored && state) {
        console.log(`🔤 Minigame Nối Từ: Đã khôi phục ván dở dang "${state.currentWord}" (chờ chữ "${state.expectedKey}") tại kênh <#${WORDCHAIN_CHANNEL_ID}>`);
        // Khởi động lại bộ đếm tiếp chiêu nếu người chơi không ai nối
        scheduleBotTurn(client, chainChannel, null, 180);
      } else {
        const startState = startGame(client.user.id, client.user.username);
        await sendWebhook(
          "wordchain",
          {
            content: `🔄 **MINIGAME NỐI TỪ ĐÃ SẴN SÀNG!**\nTừ mở màn: **${startState.currentWord}**\n👉 Hãy nối tiếp từ 2 tiếng bắt đầu bằng chữ: **"${startState.expectedKey}"**!`
          },
          chainChannel
        );
        console.log(`🔤 Minigame Nối Từ đã sẵn sàng (ván mới) tại kênh <#${WORDCHAIN_CHANNEL_ID}>`);
      }
    }
  } catch (err) {
    console.error("❌ Lỗi khởi tạo WordChain:", err.message);
  }

  // Initialize WordScramble game (Khôi phục câu đố dở dang nếu chưa ai giải)
  try {
    const scrambleChannel = await client.channels.fetch(WORDSCRAMBLE_CHANNEL_ID).catch(() => null);
    if (scrambleChannel && scrambleChannel.isTextBased()) {
      const { restored, state } = await restoreScrambleState(scrambleChannel);
      if (restored && state) {
        console.log(`🧩 Minigame Sắp Xếp Từ: Đã khôi phục câu đố dở dang "${state.originalWord}" tại kênh <#${WORDSCRAMBLE_CHANNEL_ID}>`);
      } else {
        const round = await startScrambleRound();
        const embed = createScrambleChallengeEmbed(round.scrambledText, round.hintText);
        await sendWebhook("wordscramble", { embeds: [embed] }, scrambleChannel);
        console.log(`🧩 Minigame Sắp Xếp Từ đã kích hoạt (câu đố mới) tại kênh <#${WORDSCRAMBLE_CHANNEL_ID}>`);
      }
    }
  } catch (err) {
    console.error("❌ Lỗi khởi tạo WordScramble:", err.message);
  }

  // Initialize WuWa Code Watcher
  try {
    initWuwaCodeWatcher(client);
    console.log(`🎁 Săn Code Wuthering Waves đã kích hoạt tại kênh <#${WUWA_CODES_CHANNEL_ID}>`);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo WuWa Code Watcher:", err.message);
  }

  // Initialize HoYoverse Code Watcher (Genshin, HSR, ZZZ)
  try {
    initHoyoCodeWatcher(client);
    console.log(`🎮 Săn Code HoYoverse (Genshin, HSR, ZZZ) đã kích hoạt tại kênh demo <#${HOYO_CODES_CHANNEL_ID}>`);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Hoyo Code Watcher:", err.message);
  }

  // Initialize Arknights: Endfield Code Watcher
  try {
    initEndfieldCodeWatcher(client);
    console.log(`⚡ Săn Code Arknights: Endfield đã kích hoạt tại kênh <#${ENDFIELD_CODES_CHANNEL_ID}>`);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Endfield Code Watcher:", err.message);
  }

  // Initialize Gacha Updates Watcher (Tự động tóm tắt & đăng bài Bảng Tin Gacha)
  try {
    initGachaUpdateWatcher(client);
    console.log(`📰 Kênh Bảng Tin Cập Nhật Gacha Games đã kích hoạt tại kênh <#${GACHA_UPDATE_FORUM_CHANNEL_ID}>`);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Gacha Update Watcher:", err.message);
  }

  // Initialize 24/7 Smart Voice Room Keeper
  try {
    initVoiceKeeper(client);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Voice Keeper:", err.message);
  }

  // Initialize System Health Tracker & Alert Monitor
  try {
    const { initHealthTracker } = require("./src/utils/healthTracker");
    initHealthTracker(client);
    console.log("🩺 Hệ thống Health Monitor đã sẵn sàng giám sát toàn bộ dịch vụ!");
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Health Tracker:", err.message);
  }

  // Pre-load All Application Emojis into Memory Cache
  try {
    const { loadApplicationEmojis } = require("./src/utils/emojiHelper");
    await loadApplicationEmojis(client);
  } catch (emojiErr) {
    console.warn("⚠️ Không thể tải trước Application Emojis:", emojiErr.message);
  }
});

// Auto-leave if added to an unauthorized guild
client.on(Events.GuildCreate, async (guild) => {
  if (!isAllowedGuild(guild.id)) {
    console.warn(`⚠️ Bot được mời vào Server không được phép: "${guild.name}" (${guild.id}). Rời ngay lập tức...`);
    await guild.leave().catch((err) => console.error(`❌ Lỗi khi tự động rời Server ${guild.id}:`, err.message));
  }
});

// Interaction Event Handler (Hỗ trợ nút bấm Sao chép nhanh mã code Wuthering Waves)
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith("copy_wuwa_")) {
    const code = interaction.customId.replace("copy_wuwa_", "");
    return interaction.reply({
      content: `📋 **Mã quà tặng Wuthering Waves:**\n\`${code}\`\n\n💡 *Bấm vào mã trên để sao chép nhanh, sau đó mở game vào **Cài đặt ➔ Cài đặt khác ➔ Mã đổi quà** để nhận nhé!*`,
      flags: 64, // Ephemeral: Chỉ người bấm mới thấy
    });
  }
});

// Message Event Handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild || !isAllowedGuild(message.guild.id)) return;

  try {
    // 0.0 Lệnh Quản trị Xóa tin nhắn (!clear <x>, !xoa <x>)
    if (message.content.startsWith("!clear") || message.content.startsWith("!xoa")) {
      const { handleClearCommand } = require("./src/features/adminCommands");
      const handled = await handleClearCommand(client, message);
      if (handled) return;
    }

    const lowerRaw = message.content.trim().toLowerCase();

    // 0.05 Lệnh Kiểm tra Sức khỏe Toàn bộ Dịch vụ (!status, !health, !astatus, !ahealth)
    if (lowerRaw === "!status" || lowerRaw === "!health" || lowerRaw === "!astatus" || lowerRaw === "!ahealth") {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const { createHealthDashboardEmbed } = require("./src/utils/healthTracker");
        const embed = createHealthDashboardEmbed();
        return message.channel.send({ embeds: [embed] });
      }
    }

    // 0.1 Lệnh Admin ép quét code HoYoverse tức thì (!checkhoyo, !acheckhoyo)
    if (lowerRaw === "!checkhoyo" || lowerRaw === "!acheckhoyo") {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const statusMsg = await message.channel.send("🔄 **[Hoyo Watcher]** Đang tiến hành quét kiểm tra code HoYoverse (Genshin, HSR, ZZZ)...");
        const { checkAndNotifyHoyoCodes } = require("./src/features/hoyoCodes");
        try {
          const result = await checkAndNotifyHoyoCodes(client);
          if (result && result.success) {
            await statusMsg.edit(`✅ **[Hoyo Watcher]** Đã kiểm tra xong!\n${result.message}`);
          } else {
            await statusMsg.edit(`⚠️ **[Hoyo Watcher]** Quá trình quét gặp sự cố: ${result?.message || "Không xác định"}`);
          }
        } catch (err) {
          await statusMsg.edit(`❌ **[Hoyo Watcher]** Lỗi hệ thống: ${err.message}`);
        }
      }
      return;
    }

    // 0.2 Lệnh Admin gửi tin nhắn mẫu Livestream Special Program (!testlive, !atestlive)
    // GỬI TRỰC TIẾP VÀO KÊNH BẠN ĐANG DÙNG LỆNH
    if (lowerRaw.startsWith("!testlive") || lowerRaw.startsWith("!atestlive")) {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const parts = message.content.trim().split(/\s+/);
        const gameArg = (parts[1] || "zzz").toLowerCase();
        const { createLivestreamCodeMessage } = require("./src/features/hoyoCodes/embedBuilder");
        const { fetchLivestreamBanner } = require("./src/features/hoyoCodes/hoyoScraper");

        let embed, components;

        if (gameArg === "wuwa" || gameArg === "ww") {
          const { createWuwaLivestreamMessage } = require("./src/features/wuwaCodes/embedBuilder");
          const sampleWuwaLive = {
            version: "3.7",
            bannerUrl: "https://hw-pcdownload-qcloud.aki-game.net/launcher/news/slide-picture/087sw5peq5mquvlulz.png",
            streamYoutube: "https://youtu.be/xLWZ-bApa2c?si=JdBiUsz4qL0Sxwvg",
            streamTwitch: "https://www.twitch.tv/wuthering_waves",
            time: "Phát sóng ngày 19/09/2026",
            codes: [
              { code: "FALLINGSANCTUM", rewardsText: "• Astrite x100\n• Premium Resonance Potion x2\n• Advanced Inhaler x2", duration: "Đã hết hạn" },
              { code: "WAKINGMOON", rewardsText: "• Astrite x100\n• Advanced Sealed Tube x2\n• Premium Tuner x10", duration: "Đã hết hạn" },
              { code: "FINDSENTINEL", rewardsText: "• Astrite x100\n• Shell Credit x40000\n• Premium Enclosure Tank x1", duration: "Đã hết hạn" },
            ],
          };
          const result = await createWuwaLivestreamMessage(sampleWuwaLive, client);
          embed = result.embed;
          components = result.components;
        } else if (gameArg === "endfield" || gameArg === "ef" || gameArg === "ak") {
          const { createEndfieldLivestreamMessage } = require("./src/features/endfieldCodes/embedBuilder");
          const sampleEndfieldLive = {
            version: "1.6",
            bannerUrl: "https://web-static.hg-cdn.com/upload/image/20261012/6522503e31c3e8aa7cecc1fc9c19f2e8.jpg",
            streamYoutube: "https://www.youtube.com/@ArknightsEndfield",
            officialPortal: "https://endfield.gryphline.com/",
            codes: [
              { code: "SANCTUARYINK", rewardsText: "150 Oroberyl, 10,000 T-Credits, 5 Arms INSP Kits", duration: "Còn hiệu lực 48h" },
              { code: "TALOSPROTOCOL", rewardsText: "150 Oroberyl, 20 Intermediate Combat Records", duration: "Còn hiệu lực 48h" },
            ],
          };
          const result = await createEndfieldLivestreamMessage(sampleEndfieldLive, client);
          embed = result.embed;
          components = result.components;
        } else {
          let streamData;
          if (gameArg === "hsr") {
            streamData = {
              game: "hsr",
              version: "4.6",
              bannerUrl: "https://upload-os-bbs.hoyolab.com/upload/community/2026/10/08/445eff9915166d9bcdbd60b279933ff8_739955734522521317.png",
              codes: [
                { code: "3S3XKXZ5NU27", rewardsText: "100 Stellar Jade, 50,000 Credits", duration: "Còn hiệu lực 24h", redeemUrl: "https://hsr.hoyoverse.com/gift?code=3S3XKXZ5NU27" },
                { code: "5T3XZXZ5NU28", rewardsText: "100 Stellar Jade, 5 Traveler's Guide", duration: "Còn hiệu lực 24h", redeemUrl: "https://hsr.hoyoverse.com/gift?code=5T3XZXZ5NU28" },
                { code: "7B3XZXZ5NU29", rewardsText: "100 Stellar Jade, 4 Refined Aether", duration: "Còn hiệu lực 24h", redeemUrl: "https://hsr.hoyoverse.com/gift?code=7B3XZXZ5NU29" },
              ],
            };
          } else if (gameArg === "genshin" || gameArg === "gi") {
            streamData = {
              game: "genshin",
              version: "7.1",
              bannerUrl: "https://upload-os-bbs.hoyolab.com/upload/2026/09/30/05c288b456815fbaf6aeb54f362f4f9f_3170646147861150357.png",
              codes: [
                { code: "GENSHINLIVE1", rewardsText: "100 Primogem, 10 Mystic Enhancement Ore", duration: "Còn hiệu lực 24h", redeemUrl: "https://genshin.hoyoverse.com/en/gift?code=GENSHINLIVE1" },
                { code: "GENSHINLIVE2", rewardsText: "100 Primogem, 5 Hero's Wit", duration: "Còn hiệu lực 24h", redeemUrl: "https://genshin.hoyoverse.com/en/gift?code=GENSHINLIVE2" },
                { code: "GENSHINLIVE3", rewardsText: "100 Primogem, 50,000 Mora", duration: "Còn hiệu lực 24h", redeemUrl: "https://genshin.hoyoverse.com/en/gift?code=GENSHINLIVE3" },
              ],
            };
          } else {
            const zzzBanner = await fetchLivestreamBanner("zzz");
            streamData = {
              game: "zzz",
              version: "3.2",
              bannerUrl: zzzBanner,
              codes: [
                { code: "JRNY2SKY", rewardsText: "300 Polychrome, 30,000 Denny, 2 Senior Investigator Log, 2 W-Engine Battery", duration: "Đã hết hạn", redeemUrl: "https://zenless.hoyoverse.com/redemption?code=JRNY2SKY" },
              ],
            };
          }

          const hoyoRes = createLivestreamCodeMessage(streamData, client);
          embed = hoyoRes.embed;
          components = hoyoRes.components;
        }

        // Gửi thẳng vào kênh hiện tại
        await message.channel.send({ embeds: [embed], components });
      }
      return;
    }

    // 0.3 Lệnh Admin gửi mẫu Code Thường HoYoverse (!testhoyo, !atesthoyo [hsr|gi|zzz])
    if (lowerRaw.startsWith("!testhoyo") || lowerRaw.startsWith("!atesthoyo")) {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const parts = message.content.trim().split(/\s+/);
        const gameArg = (parts[1] || "genshin").toLowerCase();
        const { createRegularCodeMessage } = require("./src/features/hoyoCodes/embedBuilder");

        let sampleCode;
        if (gameArg === "hsr") {
          sampleCode = {
            game: "hsr",
            code: "STARRAILGIFT",
            rewardsText: "50 Stellar Jade, 10,000 Credits, 2 Traveler's Guide",
            duration: "Vô thời hạn (Còn hiệu lực)",
            redeemUrl: "https://hsr.hoyoverse.com/gift?code=STARRAILGIFT",
          };
        } else if (gameArg === "zzz") {
          sampleCode = {
            game: "zzz",
            code: "ZENLESSGIFT",
            rewardsText: "50 Polychrome, 2 Official Investigator Log, 3 W-Engine Power Supply",
            duration: "Vô thời hạn (Còn hiệu lực)",
            redeemUrl: "https://zenless.hoyoverse.com/redemption?code=ZENLESSGIFT",
          };
        } else {
          sampleCode = {
            game: "genshin",
            code: "GENSHINGIFT",
            rewardsText: "50 Primogem, 3 Hero's Wit",
            duration: "Vô thời hạn (Còn hiệu lực)",
            redeemUrl: "https://genshin.hoyoverse.com/en/gift?code=GENSHINGIFT",
          };
        }

        const { embed, components } = createRegularCodeMessage(sampleCode, client);
        await message.channel.send({ embeds: [embed], components });
      }
      return;
    }

    // 0.4 Lệnh Admin gửi tin nhắn mẫu Code Wuthering Waves (!testwuwa, !atestwuwa)
    if (lowerRaw.startsWith("!testwuwa") || lowerRaw.startsWith("!atestwuwa")) {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const { createWuwaCodeEmbed } = require("./src/features/wuwaCodes/embedBuilder");
        const sampleWuwaCode = {
          code: "SHOREKEEPER",
          server: "Tất cả",
          rewardsText: "• Astrite x100\n• Shell Credit x10000\n• Premium Sealed Tube x2",
          duration: "Còn hiệu lực",
        };
        const { embed, components } = await createWuwaCodeEmbed(sampleWuwaCode, client);
        await message.channel.send({ embeds: [embed], components });
      }
      return;
    }

    // 0.5 Lệnh Admin gửi tin nhắn mẫu Code Arknights: Endfield (!testendfield, !atestendfield)
    if (lowerRaw.startsWith("!testendfield") || lowerRaw.startsWith("!atestendfield")) {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const { createEndfieldCodeEmbed } = require("./src/features/endfieldCodes/embedBuilder");
        const sampleEndfieldCode = {
          code: "ENDFIELDGIFT",
          rewardsText: "• 150 Oroberyl\n• 10,000 T-Creds\n• 20 Intermediate Combat Records\n• 20 Arms INSP Kits",
          duration: "Còn hiệu lực",
        };
        const { embed, components } = await createEndfieldCodeEmbed(sampleEndfieldCode, client);
        await message.channel.send({ embeds: [embed], components });
      }
      return;
    }

    // 0.6 Lệnh Admin xem trước bài viết Diễn đàn Cập nhật Gacha (!testgacha, !atestgacha [hsr|gi|zzz|wuwa|ef])
    if (lowerRaw.startsWith("!testgacha") || lowerRaw.startsWith("!atestgacha")) {
      const { ADMIN_IDS, ADMIN_ID } = require("./src/config/env");
      if (ADMIN_IDS.includes(message.author.id) || message.author.id === ADMIN_ID || message.member?.permissions?.has("Administrator")) {
        const parts = message.content.trim().split(/\s+/);
        const gameArg = (parts[1] || "genshin").toLowerCase();
        const { buildForumPostPayload } = require("./src/features/gachaUpdates/embedBuilder");
        const { DEFAULT_BANNERS } = require("./src/features/gachaUpdates/scrapers");

        const sampleMap = {
          hsr: { game: "hsr", title: 'Honkai: Star Rail Version 4.6 "Dance With the Beast Before Moonrise" Update Details' },
          zzz: { game: "zzz", title: "Zenless Zone Zero Version 3.2 Update Details" },
          wuwa: { game: "wuwa", title: "Wuthering Waves Version 3.7 Patch Notes" },
          ef: { game: "endfield", title: "Arknights: Endfield Core Chapter 1.6 Update Details" },
          genshin: { game: "genshin", title: 'Genshin Impact Version 7.1 "A Rekviem for the Underworld" Update Details' },
        };

        const sampleSummaries = {
          hsr: `**Phiên bản & Thời gian:** Khai mở sau đợt bảo trì hoàn tất từ 06:00 đến 11:00 (UTC+8).\n\n` +
            `**Banner Nhân vật & Vũ khí mới:** Ra mắt nhân vật giới hạn 5 sao mới cùng Nón Ánh Sáng trấn đặc trưng.\n\n` +
            `**Cốt truyện & Bản đồ/Khu vực mới:** Mở khóa chuỗi Khai Phá mới và bản đồ thám hiểm thế giới mới.\n\n` +
            `**Sự kiện nổi bật & Quà tặng:** Tham gia chuỗi hoạt động phiên bản nhận 1000 Ngọc Ánh Sao và Vé Tinh Cầu Đặc Biệt.\n\n` +
            `**Cải tiến tính năng (QoL nổi bật):** Tối ưu hóa hệ thống Di Vật và tăng tốc độ farm nguyên liệu.\n\n` +
            `**Đền bù bảo trì:** 600 Ngọc Ánh Sao đền bù gửi trực tiếp qua hòm thư trong game.`,
          genshin: `**Phiên bản & Thời gian:** Khai mở sau đợt bảo trì hoàn tất từ 06:00 đến 11:00 (UTC+8).\n\n` +
            `**Banner Nhân vật & Vũ khí mới:** Ra mắt nhân vật 5 sao mới cùng vũ khí đặc trưng.\n\n` +
            `**Cốt truyện & Bản đồ/Khu vực mới:** Mở khóa nhiệm vụ Ma Thần và khu vực thám hiểm mới.\n\n` +
            `**Sự kiện nổi bật & Quà tặng:** Tham gia sự kiện nhận 1000 Nguyên Thạch và Mối Duyên Vương Vấn.\n\n` +
            `**Cải tiến tính năng (QoL nổi bật):** Nâng cấp giao diện bản đồ và túi đồ.\n\n` +
            `**Đền bù bảo trì:** 600 Nguyên Thạch gửi qua hòm thư.`,
          zzz: `**Phiên bản & Thời gian:** Khai mở sau đợt bảo trì hoàn tất từ 06:00 đến 11:00 (UTC+8).\n\n` +
            `**Banner Nhân vật & Vũ khí mới:** Ra mắt Agent hạng S mới cùng W-Engine đặc trưng.\n\n` +
            `**Cốt truyện & Bản đồ/Khu vực mới:** Mở khóa chương truyện đặc biệt và khu vực New Eridu mới.\n\n` +
            `**Sự kiện nổi bật & Quà tặng:** Tham gia sự kiện nhận 1000 Phim Màu và Băng Ghi Hình Mã Hóa.\n\n` +
            `**Cải tiến tính năng (QoL nổi bật):** Tối ưu hệ thống Ủy thác và Khiêu chiến Lỗ Hổng.\n\n` +
            `**Đền bù bảo trì:** 600 Phim Màu gửi qua hòm thư.`,
          wuwa: `**Phiên bản & Thời gian:** Khai mở sau đợt bảo trì hoàn tất từ 06:00 đến 11:00 (UTC+8).\n\n` +
            `**Banner Nhân vật & Vũ khí mới:** Ra mắt Resonator 5 sao mới cùng vũ khí trấn đặc trưng.\n\n` +
            `**Cốt truyện & Bản đồ/Khu vực mới:** Mở khóa cốt truyện Huanglong mới và vùng đất thám hiểm bí ẩn.\n\n` +
            `**Sự kiện nổi bật & Quà tặng:** Tham gia sự kiện nhận 1000 Astrite và Thủy Triều Rạng Rỡ.\n\n` +
            `**Cải tiến tính năng (QoL nổi bật):** Tối ưu hệ thống Echo và tự động khóa trang bị.\n\n` +
            `**Đền bù bảo trì:** 600 Astrite gửi qua hòm thư.`,
          endfield: `**Phiên bản & Thời gian:** Khai mở sau đợt bảo trì hoàn tất từ 06:00 đến 11:00 (UTC+8).\n\n` +
            `**Banner Nhân vật & Vũ khí mới:** Tuyển dụng Operator đặc nhiệm mới cùng trang bị chuyên dụng.\n\n` +
            `**Cốt truyện & Bản đồ/Khu vực mới:** Mở khóa chương hành động mới trên bề mặt Talos-II.\n\n` +
            `**Sự kiện nổi bật & Quà tặng:** Hoàn thành nhiệm vụ nhận 1000 Oroberyl và tài nguyên tiếp tế.\n\n` +
            `**Cải tiến tính năng (QoL nổi bật):** Nâng cấp dây chuyền sản xuất tự động AIC.\n\n` +
            `**Đền bù bảo trì:** 600 Oroberyl gửi qua hòm thư.`,
        };

        const sampleSummary = sampleSummaries[chosen.game] || sampleSummaries.genshin;

        const updateData = {
          game: chosen.game,
          title: chosen.title,
          bannerUrl: DEFAULT_BANNERS[chosen.game] || DEFAULT_BANNERS.genshin,
          postUrl: "https://hoyolab.com/",
          btnText: "Xem bài gốc",
          publishedAt: new Date(),
        };

        const payload = buildForumPostPayload(client, updateData, sampleSummary);
        await message.channel.send({
          content: `📰 **[TEST XEM TRƯỚC BẢNG TIN] Tiêu đề:** \`${payload.threadName}\``,
          embeds: payload.message.embeds,
          components: payload.message.components,
        });
      }
      return;
    }

    // 0. Ưu tiên số 1: Lệnh tra cứu danh sách lệnh (!lenh, !help, !command, !comment, !menu...)
    // Hoạt động ở TOÀN BỘ CÁC KÊNH (kể cả kênh test nối từ, sắp xếp từ hay săn code)
    if (isMasterHelpCommand(message.content)) {
      await onHelpMessage(client)(message);
      return;
    }

    const channelId = message.channel.id;

    // Route 1: Minigame Nối Từ
    if (channelId === WORDCHAIN_CHANNEL_ID) {
      await onWordChainMessage(client)(message);
      return;
    }

    // Route 2: Minigame Sắp Xếp Từ
    if (channelId === WORDSCRAMBLE_CHANNEL_ID) {
      await onWordScrambleMessage(client)(message);
      return;
    }

    // Route 3: Săn Code Wuthering Waves (Các lệnh quản lý code của Admin)
    if (channelId === WUWA_CODES_CHANNEL_ID) {
      await onWuwaCodeMessage(client)(message);
    }

    // Route 4: Lệnh trợ giúp tổng hợp dự phòng
    await onHelpMessage(client)(message);
  } catch (err) {
    console.error("❌ Error in messageCreate wrapper:", err);
  }
});

// Log In Discord Client
if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN);
} else {
  console.log("⚠️ CHƯA CÓ DISCORD_TOKEN TRONG .ENV");
}
