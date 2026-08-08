// src/features/wordchain/messageHandler.js
const {
  isGameActive,
  getCurrentState,
  checkDuplicate,
  checkReversal,
  updateState,
  recordWin,
  getLeaderboard,
  getSessionScoreboard,
  startGame,
  skipGame,
} = require("./game.service");
const { canConnectWithAI, hasNextWords, getNextWords } = require("./wordPairs.service");
const { getAIHint } = require("./aiValidator.service");
const { isValidFormat, normalize } = require("../../utils/textUtils");
const {
  createLeaderboardEmbed,
  createSessionScoreboardEmbed,
  createHelpEmbed,
} = require("./embedBuilder");
const { sendWebhook } = require("../../utils/webhook.service");
const { WORDCHAIN_CHANNEL_ID, ADMIN_IDS, ADMIN_ID } = require("../../config/env");

// Target channel ID & Admin check
const TARGET_CHANNEL_ID = WORDCHAIN_CHANNEL_ID || "1450065511231520778";
const isAdmin = (userId) => ADMIN_IDS ? ADMIN_IDS.includes(userId) : userId === ADMIN_ID;

// Track messages being processed to prevent double processing
const processingMessages = new Set();

// Hint command cooldown map: Map<userId, timestamp>
const hintCooldowns = new Map();
const HINT_COOLDOWN_MS = 120000; // 2 minutes (120 seconds)

// Bot Auto-turn timer (1 minute / 60 seconds)
let botTurnTimer = null;

/**
 * Schedule Bot Auto-turn after 1 minute if no human responds
 */
function scheduleBotTurn(client, channel) {
  if (botTurnTimer) {
    clearTimeout(botTurnTimer);
    botTurnTimer = null;
  }

  botTurnTimer = setTimeout(async () => {
    try {
      if (!isGameActive()) return;

      const state = getCurrentState();
      if (!state || !state.expectedKey) return;

      const expectedKey = state.expectedKey;
      console.log(`🤖 Hết 1 phút không ai trả lời, Hệ thống tự động tìm từ nối tiếp cho "${expectedKey}"...`);

      let candidateWords = getNextWords(expectedKey);
      if (!candidateWords || candidateWords.length === 0) {
        const hints = await getAIHint(expectedKey);
        if (hints && hints.length > 0) {
          candidateWords = hints;
        }
      }

      const validCandidates = (candidateWords || []).filter(word => {
        const fullPhrase = `${expectedKey} ${word}`;
        return !checkDuplicate(normalize(fullPhrase));
      });

      if (validCandidates.length > 0) {
        const chosenSecondWord = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        const botPhrase = `${expectedKey} ${chosenSecondWord}`;
        const normalizedBotPhrase = normalize(botPhrase);

        updateState(
          botPhrase,
          normalizedBotPhrase,
          client.user.id,
          "Hệ Thống Trọng Tài"
        );

        await sendWebhook(
          "wordchain",
          {
            content: `🤖 **Hệ thống Trọng tài đã tiếp chiêu:** **${botPhrase}**\n💡 Từ hiện tại là: **${botPhrase}**`,
          },
          channel
        );

        console.log(`🤖 Hệ thống tự động nối từ: "${botPhrase}"`);
      } else {
        const skipResult = skipGame(client.user.id, "Hệ Thống Trọng Tài");
        await sendWebhook(
          "wordchain",
          {
            content: `🤖 **Hệ thống không tìm thấy từ tiếp theo nên tự động đổi ván!**\n🔄 **Từ mở màn mới là:** **${skipResult.newWord}**`,
          },
          channel
        );
      }
    } catch (err) {
      console.error("❌ Lỗi trong lượt tự động của Hệ thống:", err);
    }
  }, 60000); // 1 minute (60 seconds)
}

/**
 * Main message handler for Word Chain Game
 */
function onWordChainMessage(client) {
  return async (message) => {
    // 1. Basic filters
    if (!message.guild) return;
    if (message.author.bot) return;

    // Strict channel check: Must be in channel 1450065511231520778
    if (message.channelId !== TARGET_CHANNEL_ID) {
      return;
    }

    if (!isGameActive()) return;

    const rawContent = message.content.trim().toLowerCase();

    // ====================================================
    // LỆNH `!` THUẦN TIẾNG VIỆT
    // ====================================================

    // 0. Lệnh !batdau / !bắt đầu (CHỈ ADMIN MỚI ĐƯỢC DÙNG)
    if (
      rawContent === "!batdau" ||
      rawContent === "!bắt đầu"
    ) {
      if (!isAdmin(message.author.id)) {
        await sendWebhook(
          "wordchain",
          {
            content: `⛔ <@${message.author.id}> Chỉ có Admin <@${ADMIN_ID}> mới có quyền dùng lệnh \`!batdau\` để bắt đầu ván chơi!`,
          },
          message.channel
        );
        return;
      }

      if (botTurnTimer) clearTimeout(botTurnTimer);
      const newGame = startGame(message.author.id, message.author.username);
      await sendWebhook(
        "wordchain",
        {
          content: `🔄 **Admin <@${message.author.id}> đã bắt đầu ván chơi mới!**\n💡 Từ mở màn là: **${newGame.currentWord}**`,
        },
        message.channel
      );
      return;
    }

    // 1. Lệnh Gợi ý Hệ thống: !goiy (Giữ nguyên tin nhắn & tag người dùng)
    if (
      rawContent === "!goiy" ||
      rawContent === "!gợi ý"
    ) {
      const now = Date.now();
      const lastUsed = hintCooldowns.get(message.author.id) || 0;
      const timeDiff = now - lastUsed;

      if (timeDiff < HINT_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((HINT_COOLDOWN_MS - timeDiff) / 1000);
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const timeStr = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;

        await sendWebhook(
          "wordchain",
          {
            content: `⏳ <@${message.author.id}> Vui lòng chờ **${timeStr}** nữa để tiếp tục xin gợi ý từ Hệ thống nhé!`,
          },
          message.channel
        );
        return;
      }

      hintCooldowns.set(message.author.id, now);

      const state = getCurrentState();
      if (!state) return;

      await message.channel.sendTyping();
      const hints = await getAIHint(state.expectedKey);
      if (hints && hints.length > 0) {
        await sendWebhook(
          "wordchain",
          {
            content: `✨ **Hệ thống gợi ý từ theo yêu cầu của <@${message.author.id}> (bắt đầu bằng "${state.expectedKey}"):**\n` +
              hints.map((h) => `✦ \`${h}\``).join("\n"),
          },
          message.channel
        );
      } else {
        await sendWebhook(
          "wordchain",
          {
            content: `✨ <@${message.author.id}> Hệ thống chưa tìm thấy từ gợi ý cho từ "${state.expectedKey}".`,
          },
          message.channel
        );
      }
      return;
    }

    // 2. Lệnh Xem Bảng Xếp Hạng: !bxh, !bangxephang
    if (
      rawContent === "!bxh" ||
      rawContent === "!bangxephang" ||
      rawContent === "!bảng xếp hạng"
    ) {
      const leaderboard = getLeaderboard();
      const state = getCurrentState();
      const leaderboardEmbed = createLeaderboardEmbed(
        leaderboard,
        state ? state.currentWord : ""
      );
      await sendWebhook("wordchain", { embeds: [leaderboardEmbed] }, message.channel);
      return;
    }

    // 3. Lệnh Hướng dẫn luật chơi: !luatchoi, !huongdan (Tự động xóa sau 1 phút)
    if (
      rawContent === "!luatchoi" ||
      rawContent === "!huongdan" ||
      rawContent === "!luật chơi" ||
      rawContent === "!hướng dẫn"
    ) {
      const helpEmbed = createHelpEmbed();
      const sentMsg = await sendWebhook(
        "wordchain",
        { embeds: [helpEmbed] },
        message.channel
      );

      // Tự động xóa thông báo hướng dẫn sau 60 giây (1 phút)
      if (sentMsg && typeof sentMsg.delete === "function") {
        setTimeout(() => {
          sentMsg.delete().catch(() => {});
        }, 60000);
      }

      // Xóa tin nhắn lệnh !huongdan của user sau 5 giây để kênh sạch sẽ
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 5000);
      return;
    }

    // ====================================================
    // XỬ LÝ LƯỢT CHƠI NỐI TỪ CỦA NGƯỜI DÙNG
    // ====================================================

    // Prevent duplicate processing
    const msgId = message.id;
    if (processingMessages.has(msgId)) {
      return;
    }

    processingMessages.add(msgId);
    setTimeout(() => processingMessages.delete(msgId), 15000);

    // Validate format
    const candidate = message.content.trim();

    if (!isValidFormat(candidate)) {
      processingMessages.delete(msgId);
      return;
    }

    const words = candidate.split(/\s+/);
    if (words.length !== 2) {
      processingMessages.delete(msgId);
      return;
    }

    const [firstWord, secondWord] = words;
    const normalizedCandidate = normalize(candidate);
    const state = getCurrentState();
    const expectedWord = state.expectedKey;

    // Validation logic
    try {
      // 1. Check first word match
      if (normalize(firstWord) !== normalize(expectedWord)) {
        await reactOnce(message, false);
        console.log(
          `❌ [${message.author.tag}] First word mismatch: "${firstWord}" !== "${expectedWord}"`
        );
        return;
      }

      // 2. Check duplicate
      if (checkDuplicate(normalizedCandidate)) {
        await reactOnce(message, false);
        console.log(`❌ [${message.author.tag}] Duplicate: "${candidate}"`);
        return;
      }

      // 3. Check reversal spam
      if (checkReversal(normalizedCandidate)) {
        await reactOnce(message, false);
        console.log(`❌ [${message.author.tag}] Reversal spam: "${candidate}"`);
        return;
      }

      // 4. Check connection (Dictionary + System Fallback)
      const connectResult = await canConnectWithAI(firstWord, secondWord);
      if (!connectResult.connect) {
        await reactOnce(message, false);
        console.log(
          `❌ [${message.author.tag}] Cannot connect: "${firstWord}" -> "${secondWord}"`
        );
        return;
      }

      // If verified via System Trọng tài
      if (connectResult.source === "ai") {
        try {
          await message.react("✨");
        } catch {}
      }

      // 5. Check if player wins (no next words available)
      if (!hasNextWords(secondWord)) {
        if (botTurnTimer) clearTimeout(botTurnTimer);
        await handleWin(message, client, candidate);
        return;
      }

      // 6. Valid move - update state
      await reactOnce(message, true);

      updateState(
        candidate,
        normalizedCandidate,
        message.author.id,
        message.author.username
      );

      // Send webhook / channel message
      const systemNote =
        connectResult.source === "ai" ? " *(✨ Hệ thống đã thẩm định)*" : "";
      await sendWebhook(
        "wordchain",
        { content: `💡 Từ hiện tại là: **${candidate}**${systemNote}` },
        message.channel
      );

      console.log(
        `✅ [${message.author.tag}] Valid word (${connectResult.source}): "${candidate}"`
      );

      // Schedule Bot turn after 15 seconds if no human moves
      scheduleBotTurn(client, message.channel);

    } catch (error) {
      console.error(`❌ Error processing message ${msgId}:`, error);
    } finally {
      processingMessages.delete(msgId);
    }
  };
}

/**
 * React to a message once
 */
async function reactOnce(message, isCorrect) {
  try {
    const emoji = isCorrect ? "✅" : "⛔";
    await message.react(emoji);
  } catch (error) {
    console.error(`❌ Error reacting to message ${message.id}:`, error.message);
  }
}

/**
 * Handle win scenario
 */
async function handleWin(message, client, winningWord) {
  try {
    const userId = message.author.id;
    const username = message.author.username;

    await message.react("🏆");
    console.log(`🏆 ${username} wins with: "${winningWord}"`);

    recordWin(userId, username);

    const sessionScoreboard = getSessionScoreboard();
    const leaderboard = getLeaderboard();

    const sessionEmbed = createSessionScoreboardEmbed(
      sessionScoreboard,
      username
    );
    await sendWebhook("wordchain", { embeds: [sessionEmbed] }, message.channel);

    const leaderboardEmbed = createLeaderboardEmbed(leaderboard, winningWord);
    await sendWebhook("wordchain", { embeds: [leaderboardEmbed] }, message.channel);

    const newGame = startGame(client.user.id, client.user.username);
    await sendWebhook(
      "wordchain",
      {
        content: `🔄 **Ván mới!** Từ mở màn: **${newGame.currentWord}**`,
      },
      message.channel
    );

    console.log(`🎮 New game phrase: ${newGame.currentWord}`);
  } catch (error) {
    console.error("❌ Error in handleWin:", error);
  }
}

module.exports = { onWordChainMessage };
