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
  ALLOWED_GUILD_IDS,
  KEEP_VOICE_CHANNEL_ID,
  ENABLE_VOICE_KEEPER,
} = require("./src/config/env");

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
const { onWordChainMessage } = require("./src/features/wordchain/messageHandler");
const { onWordScrambleMessage } = require("./src/features/wordscramble/messageHandler");
const { startGame, getWordChainScoresMap } = require("./src/features/wordchain/game.service");
const { startScrambleRound, getScrambleState } = require("./src/features/wordscramble/scramble.service");
const { createDetailedRulesEmbed } = require("./src/features/wordchain/embedBuilder");
const { createScrambleChallengeEmbed } = require("./src/features/wordscramble/embedBuilder");

// WuWa Code Watcher & Commands
const { initWuwaCodeWatcher } = require("./src/features/wuwaCodes");
const { onWuwaCodeMessage } = require("./src/features/wuwaCodes/commandHandler");

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

function getMemoryStats() {
  const mem = process.memoryUsage();
  const toMB = (bytes) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  return {
    rss: toMB(mem.rss),
    heapUsed: toMB(mem.heapUsed),
    heapTotal: toMB(mem.heapTotal),
    renderLimit: "512 MB",
    percentOf512MB: `${Math.round((rssMB / 512) * 1000) / 10}%`,
  };
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    botName: "Anna Bot (Minigames, WuWa & Voice Keeper)",
    isReady: client ? client.isReady() : false,
    mode: IS_TEST_MODE ? "TEST_MODE" : "PRODUCTION_MODE",
    ping: client && client.ws ? `${client.ws.ping}ms` : "N/A",
    uptime: formatUptime(process.uptime()),
    memory: getMemoryStats(),
    voiceKeeper: getVoiceKeeperStatus(),
    channels: {
      wordchain: WORDCHAIN_CHANNEL_ID,
      wordscramble: WORDSCRAMBLE_CHANNEL_ID,
      wuwaCodes: WUWA_CODES_CHANNEL_ID,
      rules: RULES_CHANNEL_ID,
      voiceKeeperRoom: KEEP_VOICE_CHANNEL_ID,
    },
    prodChannels: PROD_CHANNELS,
    testChannels: TEST_CHANNELS,
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

  // Initialize WordChain game
  try {
    const chainChannel = await client.channels.fetch(WORDCHAIN_CHANNEL_ID).catch(() => null);
    const startState = startGame(client.user.id, client.user.username);
    if (chainChannel && chainChannel.isTextBased()) {
      await sendWebhook(
        "wordchain",
        {
          content: `🔄 **MINIGAME NỐI TỪ ĐÃ SẴN SÀNG!**\nTừ mở màn: **${startState.currentWord}**\n👉 Hãy nối tiếp từ 2 tiếng bắt đầu bằng chữ: **"${startState.expectedKey}"**!`
        },
        chainChannel
      );
    }
    console.log(`🔤 Minigame Nối Từ đã sẵn sàng tại kênh <#${WORDCHAIN_CHANNEL_ID}>`);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo WordChain:", err.message);
  }

  // Initialize WordScramble game
  try {
    const scrambleChannel = await client.channels.fetch(WORDSCRAMBLE_CHANNEL_ID).catch(() => null);
    if (scrambleChannel && scrambleChannel.isTextBased()) {
      const round = await startScrambleRound();
      const embed = createScrambleChallengeEmbed(round.scrambledText, round.hintText);
      await sendWebhook("wordscramble", { embeds: [embed] }, scrambleChannel);
      console.log(`🧩 Minigame Sắp Xếp Từ đã kích hoạt tại kênh <#${WORDSCRAMBLE_CHANNEL_ID}>`);
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

  // Initialize 24/7 Smart Voice Room Keeper
  try {
    initVoiceKeeper(client);
  } catch (err) {
    console.error("❌ Lỗi khởi tạo Voice Keeper:", err.message);
  }
});

// Auto-leave if added to an unauthorized guild
client.on(Events.GuildCreate, async (guild) => {
  if (!isAllowedGuild(guild.id)) {
    console.warn(`⚠️ Bot được mời vào Server không được phép: "${guild.name}" (${guild.id}). Rời ngay lập tức...`);
    await guild.leave().catch((err) => console.error(`❌ Lỗi khi tự động rời Server ${guild.id}:`, err.message));
  }
});

// Message Event Handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild || !isAllowedGuild(message.guild.id)) return;

  try {
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
