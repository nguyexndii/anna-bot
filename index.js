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
const { DISCORD_TOKEN, WORDCHAIN_CHANNEL_ID, RULES_CHANNEL_ID } = require("./src/config/env");
const { sendWebhook } = require("./src/utils/webhook.service");

// Word Chain Feature & Word Scramble Feature
const { onWordChainMessage } = require("./src/features/wordchain/messageHandler");
const { onWordScrambleMessage } = require("./src/features/wordscramble/messageHandler");
const { startGame } = require("./src/features/wordchain/game.service");
const { createDetailedRulesEmbed } = require("./src/features/wordchain/embedBuilder");

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

client.once(Events.ClientReady, async () => {
  console.log(`🔥 Bot đã online: ${client.user.tag}`);

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
  } catch (err) {
    console.error("❌ Error in messageCreate wrapper:", err);
  }
});

client.login(DISCORD_TOKEN);
