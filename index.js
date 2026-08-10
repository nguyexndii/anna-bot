require("dotenv").config();
const http = require("http");

// Global Error Handling to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

// Create Keep-Alive HTTP Web Server for Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h1>🤖 Bot Discord Nối Từ đang hoạt động 24/7!</h1>");
}).listen(PORT, () => {
  console.log(`🌐 Keep-Alive Web Server đang lắng nghe tại port ${PORT}`);
});

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { DISCORD_TOKEN, WORDCHAIN_CHANNEL_ID, WORDSCRAMBLE_CHANNEL_ID, RULES_CHANNEL_ID } = require("./src/config/env");
const { sendWebhook } = require("./src/utils/webhook.service");
const { connectDatabase } = require("./src/database/mongoose");
const LeaderboardModel = require("./src/database/models/Leaderboard");

// Word Chain Feature & Word Scramble Feature
const { onWordChainMessage } = require("./src/features/wordchain/messageHandler");
const { onWordScrambleMessage } = require("./src/features/wordscramble/messageHandler");
const { startGame, getWordChainScoresMap } = require("./src/features/wordchain/game.service");
const { startScrambleRound, getScrambleState } = require("./src/features/wordscramble/scramble.service");
const { createDetailedRulesEmbed } = require("./src/features/wordchain/embedBuilder");
const { createScrambleChallengeEmbed } = require("./src/features/wordscramble/embedBuilder");

// Wuthering Waves Code Auto Watcher & Commands
const { initWuwaCodeWatcher } = require("./src/features/wuwaCodes");
const { onWuwaCodeMessage } = require("./src/features/wuwaCodes/commandHandler");

// Master Help Command (!lenh, !cmd, !commands, !help)
const { onHelpMessage } = require("./src/features/helpCommand");

if (!DISCORD_TOKEN) {
  console.error("❌ Thiếu DISCORD_TOKEN trong .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

/**
 * Sync MongoDB Atlas data to memory maps on startup
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
      console.log(`🍃 Đã đồng bộ ${docs.length} bản ghi Bảng xếp hạng từ MongoDB Atlas!`);
    }
  } catch (err) {
    console.error("❌ Lỗi đồng bộ từ MongoDB Atlas:", err.message);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);

  // Connect to MongoDB Atlas & Sync Data
  const isDbConnected = await connectDatabase();
  if (isDbConnected) {
    await hydrateMongoData();
  }

  // Check and Send Rules Embed to Rules Channel (1450073214620405903) if not already sent
  try {
    const rulesChannel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
    if (rulesChannel) {
      const recentMessages = await rulesChannel.messages.fetch({ limit: 10 }).catch(() => null);
      const alreadySent = recentMessages && recentMessages.some(msg => 
        msg.embeds && msg.embeds.some(e => e.title && e.title.includes("KHU GIẢI TRÍ"))
      );

      if (!alreadySent) {
        const detailedRulesEmbed = createDetailedRulesEmbed();
        await rulesChannel.send({ embeds: [detailedRulesEmbed] });
        console.log(`📌 Đã gửi BẢNG NỘI QUY CHI TIẾT vào Kênh Luật (${RULES_CHANNEL_ID})`);
      } else {
        console.log(`ℹ️ Kênh Luật đã có Bảng Nội Quy từ trước, không gửi lặp lại.`);
      }
    }
  } catch (err) {
    console.error("❌ Error checking/sending help embed to rules channel:", err);
  }
  
  // Start Word Chain game
  try {
    const newGame = startGame(client.user.id, client.user.username);
    console.log(`🔤 Game Nối Từ đã được kích hoạt! Từ mở màn: "${newGame.currentWord}"`);

    // Gửi từ mở màn vào Kênh Chat Discord ngay khi Bot vừa online
    const targetChannel = await client.channels.fetch(WORDCHAIN_CHANNEL_ID).catch(() => null);
    await sendWebhook(
      "wordchain",
      {
        content: `🔄 **Bot đã Online!** Từ mở màn là: **${newGame.currentWord}**`,
      },
      targetChannel
    );
  } catch (err) {
    console.error("❌ Error starting Word Chain game:", err);
  }

  // Start Word Scramble game on startup directly into Word Scramble channel 1535705241620717720
  try {
    const scrambleChannel = await client.channels.fetch(WORDSCRAMBLE_CHANNEL_ID).catch(() => null);
    if (scrambleChannel) {
      const round = await startScrambleRound();
      const embed = createScrambleChallengeEmbed(round.scrambledText);
      await sendWebhook("wordscramble", { embeds: [embed] }, scrambleChannel);
      console.log(`🧩 Game Sắp Xếp Từ đã được kích hoạt trong kênh (${WORDSCRAMBLE_CHANNEL_ID})! Từ gốc: "${round.originalWord}"`);
    }
  } catch (err) {
    console.error("❌ Error starting Word Scramble game on ready:", err);
  }

  // Start Wuthering Waves Code Auto Watcher
  try {
    initWuwaCodeWatcher(client);
  } catch (err) {
    console.error("❌ Error starting WuWa Code Watcher:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  try {
    // Feature 5: Word Chain Game
    onWordChainMessage(client)(message).catch((err) => {
      console.error("❌ Error in onWordChainMessage:", err);
    });

    // Feature 6: Word Scramble Game (Sắp Xếp Từ)
    onWordScrambleMessage(client)(message).catch((err) => {
      console.error("❌ Error in onWordScrambleMessage:", err);
    });

    // Feature 7: Wuthering Waves Code Commands (!testcode, !checkcode, !themcode, !addcode)
    onWuwaCodeMessage(client)(message).catch((err) => {
      console.error("❌ Error in onWuwaCodeMessage:", err);
    });

    // Feature 8: Master Help Command (!lenh, !cmd, !commands, !help)
    onHelpMessage(client)(message).catch((err) => {
      console.error("❌ Error in onHelpMessage:", err);
    });
  } catch (err) {
    console.error("❌ Error in messageCreate wrapper:", err);
  }
});

client.login(DISCORD_TOKEN);
