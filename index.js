require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require("discord.js");

const {
  DISCORD_TOKEN,
  WORDCHAIN_CHANNEL_ID,
  WORDSCRAMBLE_CHANNEL_ID,
  RULES_CHANNEL_ID,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI
} = require("./src/config/env");

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

// Global Error Handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

// Feature Enable/Disable States (Dynamic Toggles)
const featureStates = {
  wordchain: true,
  wordscramble: true,
  wuwaWatcher: true,
};

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const REDIRECT_URI = DISCORD_REDIRECT_URI || "http://localhost:5173/";

// Web Root Status Endpoint
app.get("/", (req, res) => {
  res.send("<h1>🤖 Bot Discord & Web API đang hoạt động 24/7!</h1>");
});

// Real System Health Stats Endpoint
app.get("/api/stats", (req, res) => {
  const isReady = client && client.isReady();
  const ping = isReady ? Math.round(client.ws.ping) : -1;
  const uptimeMs = isReady ? client.uptime : 0;

  // Format uptime to human readable (days, hours, minutes)
  const seconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const uptimeStr = isReady
    ? `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m`
    : "Offline";

  const guildsCount = isReady ? client.guilds.cache.size : 0;

  res.json({
    success: true,
    isReady,
    ping: ping < 0 ? 0 : ping,
    uptime: uptimeStr,
    guildsCount,
    features: featureStates,
  });
});

// Feature Toggle Endpoint
app.post("/api/features/toggle", (req, res) => {
  const { feature, enabled } = req.body;
  if (feature && typeof enabled === "boolean" && featureStates.hasOwnProperty(feature)) {
    featureStates[feature] = enabled;
    console.log(`⚙️ [Feature Toggle] ${feature} -> ${enabled ? 'BẬT' : 'TẮT'}`);
    return res.json({ success: true, features: featureStates });
  }
  return res.status(400).json({ success: false, error: "Feature không hợp lệ!" });
});

// OAuth2: Lấy URL Đăng nhập Discord
app.get("/api/auth/url", (req, res) => {
  const clientId = DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình DISCORD_CLIENT_ID trong .env" });
  }
  const scope = "identify guilds";
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  res.json({ success: true, url });
});

// OAuth2: Xử lý Mã Callback từ Discord
app.post("/api/auth/callback", async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: "Thiếu mã xác thực (code)!" });
  }

  const clientId = DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const clientSecret = DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình DISCORD_CLIENT_ID hoặc DISCORD_CLIENT_SECRET trong .env!" });
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", REDIRECT_URI);

    const tokenRes = await axios.post("https://discord.com/api/oauth2/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { access_token, token_type } = tokenRes.data;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { authorization: `${token_type} ${access_token}` },
    });

    const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", {
      headers: { authorization: `${token_type} ${access_token}` },
    });

    const user = userRes.data;
    const guilds = guildsRes.data || [];

    const adminGuilds = guilds.filter((g) => g.owner || (parseInt(g.permissions) & 0x8) === 0x8);

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        globalName: user.global_name || user.username,
        avatar: avatarUrl,
      },
      adminGuilds,
      isAdmin: adminGuilds.length > 0,
    });
  } catch (err) {
    console.error("❌ Lỗi OAuth2 Discord Callback:", err.response ? err.response.data : err.message);
    return res.status(500).json({ success: false, error: "Đăng nhập Discord thất bại! Mã xác thực đã dùng hoặc hết hạn." });
  }
});

// API: Lấy danh sách kênh Text mà Bot có quyền truy cập
app.get("/api/channels", (req, res) => {
  try {
    if (!client || !client.isReady()) {
      return res.status(530).json({ success: false, error: "Bot chưa sẵn sàng!" });
    }
    const channels = [];
    client.channels.cache.forEach((ch) => {
      if (ch.isTextBased() && !ch.isThread() && ch.guild) {
        channels.push({
          id: ch.id,
          name: ch.name,
          guildId: ch.guild.id,
          guildName: ch.guild.name,
        });
      }
    });
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Nhận dữ liệu Embed hoặc Tin Nhắn Thường từ Web Frontend và gửi vào kênh Discord
app.post("/api/send-embed", async (req, res) => {
  try {
    const { content: msgContent, channelId, title, description, url, color, imageUrl, thumbnailUrl, authorName, authorIcon, footerText, footerIcon, fields } = req.body;

    if (!channelId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord (channelId)!" });
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return res.status(404).json({ success: false, error: "Không tìm thấy kênh Discord này!" });
    }

    const validFields = fields && Array.isArray(fields) ? fields.filter((f) => f.name || f.value) : [];
    const hasEmbedData = !!(title || description || url || imageUrl || thumbnailUrl || (authorName && authorName.trim().length > 0) || footerText || validFields.length > 0);

    if (hasEmbedData) {
      const embed = new EmbedBuilder();

      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (url) embed.setURL(url);

      if (color) {
        const colorHex = color.replace("#", "");
        embed.setColor(parseInt(colorHex, 16) || 0x5865F2);
      } else {
        embed.setColor(0x5865F2);
      }

      if (imageUrl) embed.setImage(imageUrl);
      if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

      if (authorName && authorName.trim().length > 0) {
        embed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });
      }

      if (footerText) {
        embed.setFooter({ text: footerText, iconURL: footerIcon || undefined });
      }

      embed.setTimestamp();

      if (validFields.length > 0) {
        embed.addFields(validFields.map((f) => ({ name: f.name || " ", value: f.value || " ", inline: !!f.inline })));
      }

      await channel.send({ content: msgContent || undefined, embeds: [embed] });
      console.log(`✅ [Web API] Đã gửi Embed thành công vào kênh #${channel.name} (${channelId})`);
      return res.json({ success: true, message: `Đã gửi bài Embed thành công vào kênh #${channel.name}!` });
    } else {
      if (!msgContent) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập nội dung tin nhắn!" });
      }
      await channel.send({ content: msgContent });
      console.log(`✅ [Web API] Đã gửi Tin Nhắn Thường vào kênh #${channel.name} (${channelId})`);
      return res.json({ success: true, message: `Đã gửi Tin Nhắn Thường thành công vào kênh #${channel.name}!` });
    }
  } catch (err) {
    console.error("❌ Lỗi [Web API /api/send-embed]:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Express API & Keep-Alive Server đang lắng nghe tại port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

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

  const isDbConnected = await connectDatabase();
  if (isDbConnected) {
    await hydrateMongoData();
  }

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
      }
    }
  } catch (err) {
    console.error("❌ Error checking/sending help embed to rules channel:", err);
  }

  // Initialize WordChain silently without spamming "Bot đã Online!"
  try {
    if (featureStates.wordchain) {
      startGame(client.user.id, client.user.username);
    }
  } catch (err) {
    console.error("❌ Error starting Word Chain game:", err);
  }

  try {
    if (featureStates.wordscramble) {
      const scrambleChannel = await client.channels.fetch(WORDSCRAMBLE_CHANNEL_ID).catch(() => null);
      if (scrambleChannel) {
        const round = await startScrambleRound();
        const embed = createScrambleChallengeEmbed(round.scrambledText);
        await sendWebhook("wordscramble", { embeds: [embed] }, scrambleChannel);
      }
    }
  } catch (err) {
    console.error("❌ Error starting Word Scramble game on ready:", err);
  }

  try {
    if (featureStates.wuwaWatcher) {
      initWuwaCodeWatcher(client);
    }
  } catch (err) {
    console.error("❌ Error starting WuWa Code Watcher:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  try {
    if (featureStates.wordchain) {
      onWordChainMessage(client)(message).catch((err) => console.error("❌ Error in onWordChainMessage:", err));
    }
    if (featureStates.wordscramble) {
      onWordScrambleMessage(client)(message).catch((err) => console.error("❌ Error in onWordScrambleMessage:", err));
    }
    onWuwaCodeMessage(client)(message).catch((err) => console.error("❌ Error in onWuwaCodeMessage:", err));
    onHelpMessage(client)(message).catch((err) => console.error("❌ Error in onHelpMessage:", err));
  } catch (err) {
    console.error("❌ Error in messageCreate wrapper:", err);
  }
});

if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN);
} else {
  console.log("⚠️ CHƯA CÓ DISCORD_TOKEN TRONG .ENV");
}
