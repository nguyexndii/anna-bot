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
const { checkVulgarAndMute } = require("../../utils/moderation");
const { sendWebhook } = require("../../utils/webhook.service");
const { WORDSCRAMBLE_CHANNEL_ID } = require("../../config/env");

// Track processed guess messages
const processingScramble = new Set();

/**
 * Handle messages for Word Scramble Game
 */
function onWordScrambleMessage(client) {
  return async (message) => {
    if (!message.guild || message.author.bot) return;

    // Check for vulgar language and Mute 3 minutes if detected
    const isMuted = await checkVulgarAndMute(message);
    if (isMuted) return;

    const rawContent = message.content.trim().toLowerCase();
    const state = getScrambleState();
    const webhookUrl = null;

    // ====================================================
    // LỆNH SẮP XẾP TỪ
    // ====================================================

    // Lệnh !sapxep / !daotu: Bắt đầu ván chơi Sắp xếp từ mới
    if (rawContent === "!sapxep" || rawContent === "!daotu" || rawContent === "!đảo từ") {
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

    // Lệnh !goiy / !goiy_sapxep: Gợi ý chữ cái đầu tiên
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
      const sentMsg = await sendWebhook(webhookUrl || "wordscramble", { embeds: [guideEmbed] }, message.channel);
      if (sentMsg && typeof sentMsg.delete === "function") {
        setTimeout(() => sentMsg.delete().catch(() => {}), 60000);
      }
      setTimeout(() => message.delete().catch(() => {}), 5000);
      return;
    }

    // ====================================================
    // XỬ LÝ ĐOÁN TỪ CỦA NGƯỜI CHƠI
    // ====================================================
    if (!state.active || !state.originalWord) return;

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

      if (isCorrect) {
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
