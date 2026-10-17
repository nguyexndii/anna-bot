// src/features/wordscramble/messageHandler.js
const {
  startScrambleRound,
  checkGuessAsync,
  recordScrambleWin,
  getScrambleLeaderboard,
  getScrambleState,
} = require("./scramble.service");
const {
  createScrambleChallengeEmbed,
  createScrambleLeaderboardEmbed,
  createScrambleHelpEmbed,
} = require("./embedBuilder");
const { applySmartMoveReaction } = require("../../utils/emojiManager");
const { sendWebhook } = require("../../utils/webhook.service");
const { WORDSCRAMBLE_CHANNEL_ID, ADMIN_IDS, ADMIN_ID } = require("../../config/env");

const isAdmin = (userId) => (ADMIN_IDS && ADMIN_IDS.length > 0) ? ADMIN_IDS.includes(userId) : userId === ADMIN_ID;

// Track processed guess messages
const processingScramble = new Set();
let isRoundTransitioning = false;

// Cooldown maps: Map<userId, timestamp>
const scrambleHintCooldowns = new Map();
const SCRAMBLE_HINT_COOLDOWN_MS = 60000; // 60 giây Cooldown chống spam
const scrambleStartCooldowns = new Map();
const SCRAMBLE_START_COOLDOWN_MS = 15000; // 15 giây Cooldown chống spam gọi ván mới

/**
 * Handle messages for Word Scramble Game
 */
function onWordScrambleMessage(client) {
  return async (message) => {
    if (!message.guild || message.author.bot) return;

    const rawContent = message.content.trim().toLowerCase();
    const state = getScrambleState();
    const webhookUrl = null;

    // ====================================================
    // LỆNH SẮP XẾP TỪ
    // ====================================================

    // Lệnh !sapxep / !daotu: Bắt đầu ván chơi Sắp xếp từ mới
    if (rawContent === "!sapxep" || rawContent === "!daotu" || rawContent === "!đảo từ") {
      // 1. Chống phá ván / đốt quota: Nếu ván đang diễn ra, người thường không được quyền hủy ván
      if (state.active && state.originalWord && !isAdmin(message.author.id)) {
        await message.reply("🧩 Hiện đang có câu đố chưa được giải! Hãy giải câu đố hiện tại hoặc dùng `!goiy` nhé (Chỉ Admin mới có thể dùng `!skip` để đổi câu).").catch(() => {});
        return;
      }

      // 2. Chống spam gọi Gemini AI: Cooldown 15 giây mỗi người chơi
      const now = Date.now();
      const lastStartTime = scrambleStartCooldowns.get(message.author.id) || 0;
      if (now - lastStartTime < SCRAMBLE_START_COOLDOWN_MS) {
        const remainingSec = Math.ceil((SCRAMBLE_START_COOLDOWN_MS - (now - lastStartTime)) / 1000);
        await message.reply(`⏳ Bạn thao tác quá nhanh! Vui lòng chờ **${remainingSec}s** nữa để bắt đầu ván mới.`).catch(() => {});
        return;
      }
      scrambleStartCooldowns.set(message.author.id, now);

      isRoundTransitioning = false;
      await message.channel.sendTyping();
      const round = await startScrambleRound();
      const embed = createScrambleChallengeEmbed(round.scrambledText);
      await sendWebhook(webhookUrl || "wordscramble", { embeds: [embed] }, message.channel);
      return;
    }

    // Lệnh !bxh / !bxh_sapxep: Bảng xếp hạng Sắp xếp từ
    if (
      rawContent === "!bxh" ||
      rawContent === "!bangxephang" ||
      rawContent === "!bxh_sapxep" ||
      rawContent === "!bxh sapxep" ||
      rawContent === "!top"
    ) {
      const leaderboard = getScrambleLeaderboard();
      const embed = createScrambleLeaderboardEmbed(leaderboard);
      await sendWebhook(webhookUrl || "wordscramble", { embeds: [embed] }, message.channel);
      return;
    }

    // Lệnh !skip / !boqua: Bỏ qua câu đố khó (Chỉ dành cho Admin)
    if (rawContent === "!skip" || rawContent === "!boqua" || rawContent === "!bỏ qua") {
      if (!isAdmin(message.author.id)) {
        await message.reply("⛔ Chỉ Quản trị viên (Admin) mới có quyền bỏ qua câu đố!").catch(() => {});
        return;
      }
      isRoundTransitioning = false;
      if (!state.active || !state.originalWord) {
        await message.reply("✨ Hiện không có ván chơi nào đang diễn ra!").catch(() => {});
        return;
      }
      const skippedWord = state.originalWord;
      const nextRound = await startScrambleRound();
      const nextEmbed = createScrambleChallengeEmbed(nextRound.scrambledText);
      await sendWebhook(
        webhookUrl || "wordscramble",
        {
          content: `⏩ Admin <@${message.author.id}> đã bỏ qua câu đố! Đáp án của từ vừa rồi là: **"${skippedWord}"**.\n👉 Đã chuyển sang câu đố mới:`,
          embeds: [nextEmbed],
        },
        message.channel
      );
      return;
    }

    // Lệnh !goiy / !goiy_sapxep: Gợi ý chữ cái đầu tiên (Có Cooldown 60s)
    if (
      rawContent === "!goiy" ||
      rawContent === "!gợi ý" ||
      rawContent === "!goiy_sapxep" ||
      rawContent === "!goiy sapxep" ||
      rawContent === "!hint"
    ) {
      if (!state.active || !state.originalWord) {
        await sendWebhook(
          webhookUrl || "wordscramble",
          { content: "✨ Hiện chưa có ván Sắp Xếp Từ nào đang chạy. Gõ `!sapxep` để bắt đầu ván mới nhé!" },
          message.channel
        );
        return;
      }

      const now = Date.now();
      const lastHintTime = scrambleHintCooldowns.get(message.author.id) || 0;
      if (now - lastHintTime < SCRAMBLE_HINT_COOLDOWN_MS) {
        const remainingSec = Math.ceil((SCRAMBLE_HINT_COOLDOWN_MS - (now - lastHintTime)) / 1000);
        await message.reply(`⏳ Bạn cần chờ **${remainingSec}s** nữa để dùng lại lệnh gợi ý!`).catch(() => {});
        return;
      }
      scrambleHintCooldowns.set(message.author.id, now);

      const firstLetter = state.originalWord.charAt(0).toUpperCase();
      await sendWebhook(
        webhookUrl || "wordscramble",
        { content: `💡 <@${message.author.id}> **Gợi ý:** Chữ cái đầu tiên là **"${firstLetter}"**!` },
        message.channel
      );
      return;
    }

    // Lệnh !huongdan / !luatchoi: Hướng dẫn nhanh trò chơi Sắp xếp từ
    if (
      rawContent === "!luatchoi" ||
      rawContent === "!huongdan" ||
      rawContent === "!luật chơi" ||
      rawContent === "!hướng dẫn" ||
      rawContent === "!help"
    ) {
      const guideEmbed = createScrambleHelpEmbed();
      await sendWebhook(webhookUrl || "wordscramble", { embeds: [guideEmbed] }, message.channel);
      return;
    }

    // ====================================================
    // XỬ LÝ ĐOÁN TỪ CỦA NGƯỜI CHƠI
    // ====================================================
    if (!state.active || !state.originalWord || isRoundTransitioning) return;

    // Check if the message looks like a candidate guess (e.g. 2 words hoặc chiều dài tương đương)
    // để tránh thả reaction sai vào các tin nhắn chat bình thường
    const wordsInMsg = rawContent.split(/\s+/);
    const origNoSpaceLen = state.originalWord.replace(/\s+/g, "").length;
    const guessNoSpaceLen = rawContent.replace(/\s+/g, "").length;
    const isLikelyGuess = (wordsInMsg.length === 2) || (Math.abs(guessNoSpaceLen - origNoSpaceLen) <= 2);

    if (!isLikelyGuess) return;

    const msgId = message.id;
    if (processingScramble.has(msgId)) return;

    processingScramble.add(msgId);
    setTimeout(() => processingScramble.delete(msgId), 10000);

    try {
      const isCorrect = await checkGuessAsync(rawContent);
      if (!state.active || isRoundTransitioning) return;

      if (isCorrect) {
        isRoundTransitioning = true;
        state.active = false;

        try {
          // Player solved the puzzle!
          const totalWins = recordScrambleWin(message.author.id, message.author.username);

          // React với icon đúng + icon ăn mừng
          await applySmartMoveReaction(message, true, "scramble_win");

          // Win notification line sent via wordscramble webhook or channel
          const solvedWordDisplay = rawContent !== state.originalWord ? `${rawContent} (${state.originalWord})` : state.originalWord;
          await sendWebhook(
            webhookUrl || "wordscramble",
            {
              content: `🎉 <@${message.author.id}> đã xuất sắc giải đáp chính xác cụm từ **"${solvedWordDisplay}"**! *(+1 điểm ➔ Tổng: **${totalWins}** lần thắng)*`,
            },
            message.channel
          );

          // Start next round automatically directly in Word Scramble channel
          await message.channel.sendTyping();
          const nextRound = await startScrambleRound();
          const nextEmbed = createScrambleChallengeEmbed(nextRound.scrambledText);
          await sendWebhook(webhookUrl || "wordscramble", { embeds: [nextEmbed] }, message.channel);
        } finally {
          isRoundTransitioning = false;
        }
      } else {
        // Đoán SAI: Thả reaction SAI + 1 reaction cà khịa/hài hước
        await applySmartMoveReaction(message, false, "scramble_wrong");
      }
    } catch (err) {
      console.error("❌ Error in onWordScrambleMessage:", err);
    } finally {
      processingScramble.delete(msgId);
    }
  };
}

module.exports = { onWordScrambleMessage };
