require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require("discord.js");

const {
  DISCORD_TOKEN,
  WORDCHAIN_CHANNEL_ID,
  WORDSCRAMBLE_CHANNEL_ID,
  RULES_CHANNEL_ID,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  JWT_SECRET,
  OWNER_DISCORD_ID
} = require("./src/config/env");

const { sendWebhook } = require("./src/utils/webhook.service");
const { connectDatabase } = require("./src/database/mongoose");
const LeaderboardModel = require("./src/database/models/Leaderboard");
const GuildConfigModel = require("./src/database/models/GuildConfig");

// Word Chain Feature & Word Scramble Feature
const { onWordChainMessage } = require("./src/features/wordchain/messageHandler");
const { onWordScrambleMessage } = require("./src/features/wordscramble/messageHandler");
const { startGame, getWordChainScoresMap } = require("./src/features/wordchain/game.service");
const { startScrambleRound, getScrambleState } = require("./src/features/wordscramble/scramble.service");
const { createDetailedRulesEmbed } = require("./src/features/wordchain/embedBuilder");
const { createScrambleChallengeEmbed } = require("./src/features/wordscramble/embedBuilder");

// Master Help Command (!lenh, !cmd, !commands, !help)
const { onHelpMessage } = require("./src/features/helpCommand");

// Global Error Handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Cache Map for GuildConfig: Map<guildId, ConfigObject>
const guildConfigsCache = new Map();

async function getGuildConfig(guildId) {
  if (!guildId) return null;
  if (guildConfigsCache.has(guildId)) {
    return guildConfigsCache.get(guildId);
  }
  try {
    let configDoc = await GuildConfigModel.findOne({ guildId });
    if (!configDoc) {
      configDoc = await GuildConfigModel.create({ guildId });
    }
    const configObj = configDoc.toObject();
    guildConfigsCache.set(guildId, configObj);
    return configObj;
  } catch (err) {
    console.error("❌ Error fetching GuildConfig for:", guildId, err.message);
    const fallback = {
      guildId,
      wordchainEnabled: false,
      wordchainChannelId: "",
      wordchainHintCooldownMs: 120000,
      wordchainAutoPlaySec: 60,
      wordscrambleEnabled: false,
      wordscrambleChannelId: "",
      wordscrambleRoundSec: 60,
      wuwaEnabled: false,
      wuwaChannelId: ""
    };
    return fallback;
  }
}

// In-Memory CSRF State Store for Discord OAuth2: Map<state, expirationTimestamp>
const oauthStateStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [st, exp] of oauthStateStore.entries()) {
    if (now > exp) oauthStateStore.delete(st);
  }
}, 15 * 60 * 1000);

// Helper: Format Uptime
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

// Auth Middleware: Verify JWT from Cookie or Authorization Header
function requireAuth(req, res, next) {
  const token = req.cookies.anna_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập!" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ!" });
  }
}

// API: Check Current Session Status
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// API: Logout (Clear Cookie)
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("anna_session");
  res.json({ success: true, message: "Đã đăng xuất thành công!" });
});

// API: Lấy URL Mời Bot vào Server (Scope: bot applications.commands)
app.get("/api/invite-url", (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình DISCORD_CLIENT_ID trong .env!" });
  }

  const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
  res.json({ success: true, url });
});

// API: Lấy URL Đăng nhập Discord với CSRF State Protection
app.get("/api/auth/url", (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình DISCORD_CLIENT_ID trong .env!" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  oauthStateStore.set(state, Date.now() + 10 * 60 * 1000); // 10 phút hết hạn

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    state: state
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ success: true, url, state });
});

// API: Discord OAuth2 Callback với CSRF & HTTP-Only JWT Cookie Session
app.post("/api/auth/callback", async (req, res) => {
  const { code, state } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: "Thiếu mã xác thực Discord (code)!" });
  }

  if (!state || !oauthStateStore.has(state)) {
    return res.status(400).json({ success: false, error: "CSRF state không hợp lệ hoặc đã hết hạn!" });
  }
  oauthStateStore.delete(state);

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const adminGuilds = guildsRes.data.filter((g) => {
      const permissions = BigInt(g.permissions);
      const ADMINISTRATOR = BigInt(0x8);
      const MANAGE_GUILD = BigInt(0x20);
      return g.owner || (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
    }).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));

    if (adminGuilds.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Bạn không có quyền Quản Lý (Admin) trên bất kỳ Server Discord nào mà Bot phục vụ!"
      });
    }

    const avatarUrl = userRes.data.avatar
      ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${userRes.data.discriminator % 5}.png`;

    const isOwner = userRes.data.id === OWNER_DISCORD_ID;

    const tokenPayload = {
      userId: userRes.data.id,
      username: userRes.data.username,
      globalName: userRes.data.global_name,
      avatar: avatarUrl,
      adminGuilds,
      isOwner,
      isAdmin: true,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    res.cookie("anna_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      user: tokenPayload,
    });
  } catch (err) {
    console.error("❌ Lỗi OAuth2 Discord Callback:", err.response ? err.response.data : err.message);
    return res.status(500).json({ success: false, error: "Đăng nhập Discord thất bại! Mã xác thực đã dùng hoặc hết hạn." });
  }
});

// API: Lấy Cấu Hình Chi Tiết Minigame Theo Guild
app.get("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const isAdminOfGuild = req.user.adminGuilds.some((g) => g.id === guildId);
  if (!isAdminOfGuild) {
    return res.status(403).json({ success: false, error: "Bạn không có quyền quản trị Server này!" });
  }

  const config = await getGuildConfig(guildId);
  res.json({ success: true, config });
});

// Helper: Dispatch Game Start Messages into Discord Channel
async function dispatchGameStartEvents(config) {
  if (!client || !client.isReady()) return;

  // WordChain (Nối Từ)
  if (config.wordchainEnabled && config.wordchainChannelId) {
    const ch = await client.channels.fetch(config.wordchainChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      const state = startGame(client.user.id, client.user.username);
      const embed = new EmbedBuilder()
        .setTitle("🎮 MINIGAME NỐI TỪ TIẾNG VIỆT - BẮT ĐẦU VÒNG CHƠI!")
        .setColor(0x5865F2)
        .setDescription(`Trò chơi Nối Từ đã được kích hoạt cho kênh **#${ch.name}**!\n\nTừ khởi đầu: **${state.currentWord.toUpperCase()}**\nHãy nối tiếp từ bắt đầu bằng chữ: **"${state.expectedKey.toUpperCase()}"**`)
        .setFooter({ text: "Gõ từ nối tiếp theo 2 tiếng tiếng Việt để tham gia!" })
        .setTimestamp();

      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // WordScramble (Sắp Xếp Từ)
  if (config.wordscrambleEnabled && config.wordscrambleChannelId) {
    const ch = await client.channels.fetch(config.wordscrambleChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      const round = await startScrambleRound();
      const embed = createScrambleChallengeEmbed(round.scrambledText, round.hintText);
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // WuWa Code Watcher
  if (config.wuwaEnabled && config.wuwaChannelId) {
    const ch = await client.channels.fetch(config.wuwaChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("🎁 SẮN CODE WUTHERING WAVES - ĐÃ KÍCH HOẠT")
        .setColor(0x48CAE4)
        .setDescription(`Kênh **#${ch.name}** đã được đăng ký nhận thông báo Giftcode Wuthering Waves mới nhất tự động!`)
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

// API: Cập Nhật Cấu Hình Chi Tiết Minigame Theo Guild
app.put("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const isAdminOfGuild = req.user.adminGuilds.some((g) => g.id === guildId);
  if (!isAdminOfGuild) {
    return res.status(403).json({ success: false, error: "Bạn không có quyền quản trị Server này!" });
  }

  const {
    wordchainEnabled,
    wordchainChannelId,
    wordchainHintCooldownMs,
    wordchainAutoPlaySec,
    wordscrambleEnabled,
    wordscrambleChannelId,
    wordscrambleRoundSec,
    wuwaEnabled,
    wuwaChannelId
  } = req.body;

  // Validation: Mandatory channel selection before enabling feature
  if (wordchainEnabled && !wordchainChannelId) {
    return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Minigame Nối Từ trước khi bật!" });
  }
  if (wordscrambleEnabled && !wordscrambleChannelId) {
    return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Minigame Sắp Xếp Từ trước khi bật!" });
  }
  if (wuwaEnabled && !wuwaChannelId) {
    return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Săn Code Wuthering Waves trước khi bật!" });
  }

  try {
    const updatedDoc = await GuildConfigModel.findOneAndUpdate(
      { guildId },
      {
        $set: {
          wordchainEnabled: !!wordchainEnabled,
          wordchainChannelId: wordchainChannelId || "",
          wordchainHintCooldownMs: Number(wordchainHintCooldownMs) || 120000,
          wordchainAutoPlaySec: Number(wordchainAutoPlaySec) || 60,
          wordscrambleEnabled: !!wordscrambleEnabled,
          wordscrambleChannelId: wordscrambleChannelId || "",
          wordscrambleRoundSec: Number(wordscrambleRoundSec) || 60,
          wuwaEnabled: !!wuwaEnabled,
          wuwaChannelId: wuwaChannelId || "",
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    const configObj = updatedDoc.toObject();
    guildConfigsCache.set(guildId, configObj);

    // Dispatch game starting word & challenge embeds directly into Discord channel
    await dispatchGameStartEvents(configObj);

    res.json({ success: true, config: configObj });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Stats Thực Tế (Phân quyền Owner-Only cho guildsCount & Per-Guild Features)
app.get("/api/stats", async (req, res) => {
  let user = null;
  const token = req.cookies.anna_session || req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }

  const isOwner = user && user.userId === OWNER_DISCORD_ID;
  const selectedGuildId = req.query.guildId;
  const guildConfig = selectedGuildId ? await getGuildConfig(selectedGuildId) : null;

  const features = guildConfig ? {
    wordchain: guildConfig.wordchainEnabled,
    wordscramble: guildConfig.wordscrambleEnabled,
    wuwaWatcher: guildConfig.wuwaEnabled
  } : { wordchain: false, wordscramble: false, wuwaWatcher: false };

  const statsData = {
    success: true,
    isReady: client ? client.isReady() : false,
    ping: client && client.ws ? client.ws.ping : -1,
    uptime: formatUptime(process.uptime()),
    features
  };

  if (isOwner) {
    statsData.guildsCount = client && client.guilds ? client.guilds.cache.size : 0;
  }

  res.json(statsData);
});

// API: Lấy danh sách kênh Text mà User có quyền Admin trên Guild đó
app.get("/api/channels", requireAuth, (req, res) => {
  try {
    if (!client || !client.isReady()) {
      return res.status(530).json({ success: false, error: "Bot chưa sẵn sàng!" });
    }

    const adminGuildIds = new Set(req.user.adminGuilds.map((g) => g.id));
    const channels = [];

    client.channels.cache.forEach((ch) => {
      if (ch.isTextBased() && !ch.isThread() && ch.guild && adminGuildIds.has(ch.guild.id)) {
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

// API: Bật/Tắt tính năng minigame theo từng Guild
app.post("/api/features/toggle", requireAuth, async (req, res) => {
  const { feature, enabled, guildId } = req.body;
  if (!guildId) {
    return res.status(400).json({ success: false, error: "Vui lòng chọn Server (guildId)!" });
  }

  const isAdminOfGuild = req.user.adminGuilds.some((g) => g.id === guildId);
  if (!isAdminOfGuild) {
    return res.status(403).json({ success: false, error: "Bạn không có quyền Quản Lý trên Server này!" });
  }

  const config = await getGuildConfig(guildId);
  if (enabled) {
    if (feature === "wordchain" && !config.wordchainChannelId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Minigame Nối Từ trước khi bật!" });
    }
    if (feature === "wordscramble" && !config.wordscrambleChannelId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Minigame Sắp Xếp Từ trước khi bật!" });
    }
    if (feature === "wuwaWatcher" && !config.wuwaChannelId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord cho Săn Code Wuthering Waves trước khi bật!" });
    }
  }

  const updateMap = {
    wordchain: { wordchainEnabled: !!enabled },
    wordscramble: { wordscrambleEnabled: !!enabled },
    wuwaWatcher: { wuwaEnabled: !!enabled }
  };

  if (!updateMap[feature]) {
    return res.status(400).json({ success: false, error: "Tính năng không hợp lệ!" });
  }

  try {
    const updatedDoc = await GuildConfigModel.findOneAndUpdate(
      { guildId },
      { $set: updateMap[feature] },
      { new: true, upsert: true }
    );

    const configObj = updatedDoc.toObject();
    guildConfigsCache.set(guildId, configObj);

    if (enabled) {
      await dispatchGameStartEvents(configObj);
    }

    res.json({
      success: true,
      features: {
        wordchain: configObj.wordchainEnabled,
        wordscramble: configObj.wordscrambleEnabled,
        wuwaWatcher: configObj.wuwaEnabled
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Đăng Embed hoặc Tin Nhắn Thường
app.post("/api/send-embed", requireAuth, async (req, res) => {
  try {
    const { content: msgContent, channelId, title, description, url, color, imageUrl, thumbnailUrl, authorName, authorIcon, footerText, footerIcon, fields } = req.body;

    if (!channelId) {
      return res.status(400).json({ success: false, error: "Vui lòng chọn Kênh Discord (channelId)!" });
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.guild) {
      return res.status(404).json({ success: false, error: "Không tìm thấy kênh Discord này!" });
    }

    const isAdminOfGuild = req.user.adminGuilds.some((g) => g.id === channel.guild.id);
    if (!isAdminOfGuild) {
      return res.status(403).json({ success: false, error: "Bạn không có quyền đăng bài vào Server này!" });
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
  console.log(`🚀 Express API & Keep-Alive Server đang lắng nghe tại port ${PORT}`);
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
      console.log(`📊 Đã đồng bộ ${docs.length} bản ghi Bảng xếp hạng từ MongoDB Atlas!`);
    }
  } catch (err) {
    console.error("❌ Lỗi đồng bộ từ MongoDB Atlas:", err.message);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`🟢 Bot đã online: ${client.user.tag}`);

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
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  try {
    if (message.guild) {
      const guildConfig = await getGuildConfig(message.guild.id);
      if (guildConfig) {
        // Minigame Nối Từ
        if (guildConfig.wordchainEnabled) {
          const targetCh = guildConfig.wordchainChannelId || WORDCHAIN_CHANNEL_ID;
          if (message.channel.id === targetCh) {
            onWordChainMessage(client)(message).catch((err) => console.error("❌ Error in onWordChainMessage:", err));
          }
        }
        // Minigame Sắp Xếp Từ
        if (guildConfig.wordscrambleEnabled) {
          const targetCh = guildConfig.wordscrambleChannelId || WORDSCRAMBLE_CHANNEL_ID;
          if (message.channel.id === targetCh) {
            onWordScrambleMessage(client)(message).catch((err) => console.error("❌ Error in onWordScrambleMessage:", err));
          }
        }
      }
    }
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
