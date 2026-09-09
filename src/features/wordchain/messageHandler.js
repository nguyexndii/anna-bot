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
  createWinEmbed,
  createHelpEmbed,
} = require("./embedBuilder");
const { sendWebhook } = require("../../utils/webhook.service");
const { applySmartMoveReaction } = require("../../utils/emojiManager");
const { checkVulgarAndMute } = require("../../utils/moderation");
const { WORDCHAIN_CHANNEL_ID, ADMIN_IDS, ADMIN_ID } = require("../../config/env");

const isAdmin = (userId) => (ADMIN_IDS && ADMIN_IDS.length > 0) ? ADMIN_IDS.includes(userId) : userId === ADMIN_ID;

// Track messages being processed to prevent double processing
const processingMessages = new Set();

// Hint command cooldown map: Map<userId, timestamp>
const hintCooldowns = new Map();
const HINT_COOLDOWN_MS = 120000; // 2 phút

// Bot Auto-turn timer (3 phút = 180 giây)
const AUTO_PLAY_TIMEOUT_SEC = 180;
let botTurnTimer = null;

/**
 * Schedule Bot Auto-turn after 3 minutes if no human responds.
 * QUY TẮC: Bot CHỈ tiếp chiêu 1 lần duy nhất để cứu ván, sau đó dừng hẳn chờ người chơi!
 */
function scheduleBotTurn(client, channel, webhookUrl = null, autoPlaySec = AUTO_PLAY_TIMEOUT_SEC) {
  if (botTurnTimer) {
    clearTimeout(botTurnTimer);
    botTurnTimer = null;
  }

  const timeoutMs = autoPlaySec * 1000;

  botTurnTimer = setTimeout(async () => {
    try {
      if (!isGameActive()) return;

      const state = getCurrentState();
      if (!state || !state.expectedKey) return;

      const expectedKey = state.expectedKey;
      console.log(`🤖 Hết ${autoPlaySec}s không ai trả lời, Trọng tài tiếp chiêu 1 lượt cho từ "${expectedKey}"...`);

      let candidateWords = getNextWords(expectedKey);
      if (!candidateWords || candidateWords.length === 0) {
        const hints = await getAIHint(expectedKey);
        if (hints && hints.length > 0) {
          candidateWords = hints;
        }
      }

      const validCandidates = (candidateWords || []).filter((word) => {
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
          webhookUrl || "wordchain",
          {
            content: `🤖 **Trọng tài đã tiếp chiêu:** **${botPhrase}**\n💡 Từ hiện tại là: **${botPhrase}** *(Đến lượt các bạn!)*`,
          },
          channel
        );

        console.log(`🤖 Trọng tài đã nối: "${botPhrase}". Dừng lại chờ người chơi tiếp theo.`);
        // QUAN TRỌNG: KHÔNG gọi scheduleBotTurn ở đây để tránh bot tự chơi 1 mình!
      } else {
        const skipResult = skipGame(client.user.id, "Hệ Thống Trọng Tài");
        await sendWebhook(
          webhookUrl || "wordchain",
          {
            content: `🔄 **Hệ thống đổi ván mới do hết từ nối!**\nTừ mở màn: **${skipResult.currentWord}**`,
          },
          channel
        );
        // Sau khi đổi ván mới, chờ 3 phút xem có ai chơi không
        scheduleBotTurn(client, channel, webhookUrl, autoPlaySec);
      }
    } catch (err) {
      console.error("❌ Lỗi trong bot turn timer:", err);
    }
  }, timeoutMs);
}

/**
 * Handle Word Chain Messages
 */
function onWordChainMessage(client) {
  return async (message) => {
    if (message.author.bot) return;

    // Check for vulgar language and Mute 3 minutes if detected
    const isMuted = await checkVulgarAndMute(message);
    if (isMuted) return;

    const content = message.content.trim();
    const rawLower = content.toLowerCase();
    const userId = message.author.id;
    const username = message.author.globalName || message.author.username;
    const webhookUrl = null;

    // Admin Commands
    if (isAdmin(userId)) {
      if (rawLower === "!newgame" || rawLower === "!startgame" || rawLower === "!batdau") {
        if (botTurnTimer) clearTimeout(botTurnTimer);
        const newState = startGame(userId, username);
        await sendWebhook(
          webhookUrl || "wordchain",
          {
            content: `🎮 **Admin ${username} đã khởi tạo ván mới!**\n🔄 **Từ mở màn:** **${newState.currentWord}**`,
          },
          message.channel
        );
        scheduleBotTurn(client, message.channel, webhookUrl, AUTO_PLAY_TIMEOUT_SEC);
        return;
      }

      if (rawLower === "!skip" || rawLower === "!boqua") {
        if (botTurnTimer) clearTimeout(botTurnTimer);
        const skipResult = skipGame(userId, username);
        await sendWebhook(
          webhookUrl || "wordchain",
          {
            content: `⏩ **Admin ${username} đã bỏ qua ván này!**\n🔄 **Từ mở màn mới:** **${skipResult.currentWord}**`,
          },
          message.channel
        );
        scheduleBotTurn(client, message.channel, webhookUrl, AUTO_PLAY_TIMEOUT_SEC);
        return;
      }
    }

    // Public Commands
    if (rawLower === "!bxh" || rawLower === "!top" || rawLower === "!bangxephang") {
      const leaderboard = getLeaderboard();
      const embed = createLeaderboardEmbed(leaderboard);
      await sendWebhook(
        webhookUrl || "wordchain",
        { embeds: [embed] },
        message.channel
      );
      return;
    }

    if (rawLower === "!score" || rawLower === "!scores" || rawLower === "!diem") {
      const sessionScores = getSessionScoreboard();
      const embed = createSessionScoreboardEmbed(sessionScores);
      await sendWebhook(
        webhookUrl || "wordchain",
        { embeds: [embed] },
        message.channel
      );
      return;
    }

    if (rawLower === "!goiy" || rawLower === "!hint" || rawLower === "!gợi ý") {
      if (!isGameActive()) return;

      const now = Date.now();
      const lastHintTime = hintCooldowns.get(userId) || 0;

      if (now - lastHintTime < HINT_COOLDOWN_MS) {
        const remainingSec = Math.ceil((HINT_COOLDOWN_MS - (now - lastHintTime)) / 1000);
        await message.reply(`⏳ Bạn cần chờ **${remainingSec}s** nữa để dùng lại lệnh gợi ý!`).catch(() => {});
        return;
      }

      hintCooldowns.set(userId, now);

      const state = getCurrentState();
      const expectedKey = state.expectedKey;

      let hints = getNextWords(expectedKey);
      if (!hints || hints.length === 0) {
        hints = await getAIHint(expectedKey);
      }

      if (hints && hints.length > 0) {
        const validHints = hints.filter((word) => {
          const fullPhrase = `${expectedKey} ${word}`;
          return !checkDuplicate(normalize(fullPhrase));
        });

        if (validHints.length > 0) {
          const randomHint = validHints[Math.floor(Math.random() * validHints.length)];
          await message.reply(`💡 **Gợi ý:** Thử nối từ **"${expectedKey} ${randomHint}"** xem sao!`).catch(() => {});
        } else {
          await message.reply(`💡 **Gợi ý:** Các từ thông dụng bắt đầu bằng **"${expectedKey}"** đã được sử dụng hết rồi!`).catch(() => {});
        }
      } else {
        await message.reply(`💡 Chưa tìm thấy từ nối nào phù hợp với chữ "${expectedKey}"!`).catch(() => {});
      }
      return;
    }

    if (rawLower === "!luatchoi" || rawLower === "!help" || rawLower === "!huongdan") {
      const embed = createHelpEmbed();
      const sentMsg = await sendWebhook(
        webhookUrl || "wordchain",
        { embeds: [embed] },
        message.channel
      );
      if (sentMsg && typeof sentMsg.delete === "function") {
        setTimeout(() => sentMsg.delete().catch(() => {}), 60000);
      }
      setTimeout(() => message.delete().catch(() => {}), 5000);
      return;
    }

    // Auto Start Game if inactive
    if (!isGameActive()) {
      startGame(userId, username);
      scheduleBotTurn(client, message.channel, webhookUrl, AUTO_PLAY_TIMEOUT_SEC);
    }

    // Process Player Move
    if (processingMessages.has(message.id)) return;
    processingMessages.add(message.id);
    setTimeout(() => processingMessages.delete(message.id), 15000);

    try {
      // Validate format (must be 2 words)
      if (!isValidFormat(content)) return;

      const words = content.trim().split(/\s+/);
      if (words.length !== 2) return;

      const [firstWord, secondWord] = words;
      const normalizedInput = normalize(content);
      const state = getCurrentState();
      const expectedKey = state.expectedKey;

      // 1. Check first word match (Sai vần -> Bonk, Noob, Dumb)
      if (normalize(firstWord) !== normalize(expectedKey)) {
        await applySmartMoveReaction(message, false, "wrong_spelling");
        return;
      }

      // 2. Check duplicate across current game (Lặp từ -> Bruh, Cạn lời)
      if (checkDuplicate(normalizedInput)) {
        await applySmartMoveReaction(message, false, "duplicate");
        return;
      }

      // 3. Check reversal spam (Cấm lặp lại ngay từ vừa đảo -> Bớt mồm, stfu)
      if (checkReversal(normalizedInput)) {
        await applySmartMoveReaction(message, false, "reversal");
        return;
      }

      // 4. Validate connection (Chế từ / không có trong từ điển -> who_tf, Hề, Cười nhạo)
      const connectResult = await canConnectWithAI(firstWord, secondWord);
      if (!connectResult || !connectResult.connect) {
        await applySmartMoveReaction(message, false, "not_in_dict");
        return;
      }

      // 5. Check if player wins (no next words available)
      const hasNext = hasNextWords(secondWord);
      if (!hasNext) {
        if (botTurnTimer) clearTimeout(botTurnTimer);
        const winResult = recordWin(userId, username);

        await applySmartMoveReaction(message, true, "win");
        await message.react("🏆").catch(() => {});

        const winEmbed = createWinEmbed(username, content, winResult.wins, winResult.sessionScore);
        await sendWebhook(
          webhookUrl || "wordchain",
          { embeds: [winEmbed] },
          message.channel
        );

        const newState = startGame(client.user.id, client.user.username);
        await sendWebhook(
          webhookUrl || "wordchain",
          {
            content: `🔄 **VÁN MỚI BẮT ĐẦU!**\nTừ mở màn: **${newState.currentWord}**`,
          },
          message.channel
        );

        scheduleBotTurn(client, message.channel, webhookUrl, AUTO_PLAY_TIMEOUT_SEC);
        return;
      }

      // 6. Normal Valid Move (Thành công -> Thả reaction ĐÚNG + Cảm xúc vui vẻ)
      updateState(content, normalizedInput, userId, username);
      await applySmartMoveReaction(message, true, "normal");

      await sendWebhook(
        webhookUrl || "wordchain",
        {
          content: `💡 Từ hiện tại là: **${content}**`,
        },
        message.channel
      );

      // Lên lịch 3 phút chờ lượt của người tiếp theo
      scheduleBotTurn(client, message.channel, webhookUrl, AUTO_PLAY_TIMEOUT_SEC);
    } catch (err) {
      console.error("❌ Error processing wordchain message:", err);
    } finally {
      processingMessages.delete(message.id);
    }
  };
}

module.exports = {
  onWordChainMessage,
};
