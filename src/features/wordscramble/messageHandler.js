// src/features/wordscramble/messageHandler.js
const {
  startScrambleRound,
  checkGuess,
  recordScrambleWin,
  getScrambleLeaderboard,
  getScrambleState,
} = require("./scramble.service");
const {
  createScrambleChallengeEmbed,
  createScrambleWinEmbed,
  createScrambleLeaderboardEmbed,
} = require("./embedBuilder");
const { applySmartMoveReaction, getRandomEmotionEmoji } = require("../../utils/emojiManager");
const { sendWebhook } = require("../../utils/webhook.service");

// Track processed guess messages
const processingScramble = new Set();

/**
 * Handle messages for Word Scramble Game
 */
function onWordScrambleMessage(client) {
  return async (message) => {
    if (!message.guild || message.author.bot) return;

    const rawContent = message.content.trim().toLowerCase();
    const state = getScrambleState();

    // ====================================================
    // LỆNH SẮP XẾP TỪ
    // ====================================================

    // Lệnh !sapxep / !daotu: Bắt đầu ván chơi Sắp xếp từ mới
    if (rawContent === "!sapxep" || rawContent === "!daotu" || rawContent === "!đảo từ") {
      await message.channel.sendTyping();
      const round = await startScrambleRound();
      const embed = createScrambleChallengeEmbed(round.scrambledText, round.hintText);
      await sendWebhook("wordchain", { embeds: [embed] }, message.channel);
      return;
    }

    // Lệnh !bxh_sapxep: Bảng xếp hạng
    if (rawContent === "!bxh_sapxep" || rawContent === "!bxh sapxep") {
      const leaderboard = getScrambleLeaderboard();
      const embed = createScrambleLeaderboardEmbed(leaderboard);
      await sendWebhook("wordchain", { embeds: [embed] }, message.channel);
      return;
    }

    // Lệnh !goiy_sapxep: Gợi ý chữ cái đầu tiên
    if (rawContent === "!goiy_sapxep" || rawContent === "!goiy sapxep") {
      if (!state.active || !state.originalWord) {
        await message.channel.send("✨ Hiện chưa có ván Sắp Xếp Từ nào đang chạy. Gõ `!sapxep` để bắt đầu ván mới nhé!");
        return;
      }
      const firstLetter = state.originalWord.charAt(0).toUpperCase();
      await message.channel.send(`💡 **Gợi ý:** Chữ cái đầu tiên của từ là chữ **"${firstLetter}"**.`);
      return;
    }

    // ====================================================
    // XỬ LÝ ĐOÁN TỪ CỦA NGƯỜI CHƠI
    // ====================================================
    if (!state.active || !state.originalWord) return;

    const msgId = message.id;
    if (processingScramble.has(msgId)) return;

    processingScramble.add(msgId);
    setTimeout(() => processingScramble.delete(msgId), 10000);

    try {
      const isCorrect = checkGuess(rawContent);

      if (isCorrect) {
        // Player solved the puzzle!
        const totalWins = recordScrambleWin(message.author.id, message.author.username);

        // React with custom correct emoji + COOL emotion emoji
        await applySmartMoveReaction(message, true, false);
        const coolEmoji = getRandomEmotionEmoji("COOL");
        await message.react(coolEmoji).catch(() => {});

        // Send Win embed
        const winEmbed = createScrambleWinEmbed(
          message.author.username,
          state.originalWord,
          totalWins
        );
        await sendWebhook("wordchain", { embeds: [winEmbed] }, message.channel);

        // Start next round automatically
        await message.channel.sendTyping();
        const nextRound = await startScrambleRound();
        const nextEmbed = createScrambleChallengeEmbed(nextRound.scrambledText, nextRound.hintText);
        await sendWebhook("wordchain", { embeds: [nextEmbed] }, message.channel);
      }
    } catch (err) {
      console.error("❌ Error in onWordScrambleMessage:", err);
    } finally {
      processingScramble.delete(msgId);
    }
  };
}

module.exports = { onWordScrambleMessage };
