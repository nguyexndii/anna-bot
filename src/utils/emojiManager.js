// src/utils/emojiManager.js
const { DEFAULT_REACTIONS, REACTION_GROUPS, REACTION_CHANCE } = require("../config/reactions");

/**
 * Thả reaction an toàn kèm fallback sang Unicode emoji nếu custom emoji gặp lỗi
 * @param {object} message - Discord Message
 * @param {string} emoji - Custom Emoji ID hoặc Unicode
 * @param {string} fallbackUnicode - Icon Unicode dự phòng
 */
async function safeReact(message, emoji, fallbackUnicode = "❓") {
  try {
    await message.react(emoji);
  } catch (err) {
    if (fallbackUnicode) {
      await message.react(fallbackUnicode).catch(() => {});
    }
  }
}

/**
 * Lấy Emoji Mặc Định khi gõ ĐÚNG
 * @returns {string} Emoji ID
 */
function getDefaultCorrectEmoji() {
  const options = DEFAULT_REACTIONS.CORRECT;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Lấy Emoji Mặc Định khi gõ SAI
 * @returns {string} Emoji ID
 */
function getDefaultWrongEmoji() {
  return DEFAULT_REACTIONS.WRONG;
}

/**
 * Lấy Emoji Cảm xúc ngẫu nhiên theo nhóm
 * @param {string} category
 * @returns {string} Emoji ID
 */
function getRandomEmotionEmoji(category = "COOL") {
  const group = REACTION_GROUPS[category] || REACTION_GROUPS.COOL;
  return group[Math.floor(Math.random() * group.length)];
}

/**
 * Thả Reaction ngẫu nhiên & hài hước vào tin nhắn:
 * Không phải tin nào cũng react! Chỉ ngẫu nhiên ~30% mới thả reaction tạo bất ngờ vui nhộn.
 * Trừ khi thắng ván (win) thì luôn luôn react cúp chúc mừng.
 * @param {object} message - Discord Message
 * @param {boolean} isCorrect - Trạng thái từ đúng hay sai
 * @param {string|boolean} [reasonOrDumb] - 'wrong_spelling' | 'duplicate' | 'reversal' | 'not_in_dict' | 'scramble_wrong' | 'win' | 'scramble_win' | 'normal' | boolean
 */
async function applySmartMoveReaction(message, isCorrect, reasonOrDumb = false) {
  try {
    const isWin = reasonOrDumb === "win" || reasonOrDumb === "scramble_win";

    // Không phải tin nào cũng react: Chỉ ~30% ngẫu nhiên mới thả reaction (trừ khi thắng ván thì luôn thả cúp)
    if (!isWin && Math.random() > (REACTION_CHANCE || 0.30)) {
      return;
    }

    if (isCorrect) {
      if (isWin) {
        await safeReact(message, "🏆", "🎉");
      } else {
        // Thả 1 icon ngẫu nhiên khen ngợi / ngầu / vui mừng
        const categories = ["COOL", "CHILL", "SURPRISED"];
        const chosenCategory = categories[Math.floor(Math.random() * categories.length)];
        const extraEmoji = getRandomEmotionEmoji(chosenCategory);
        await safeReact(message, extraEmoji, "🎉");
      }
    } else {
      // Khi SAI: Thả 1 icon hài hước / cà khịa / troll tùy theo tình huống
      let chosenCategory;
      let fallbackEmoji = "🤡";

      if (reasonOrDumb === "wrong_spelling" || reasonOrDumb === true) {
        // Sai vần / gõ sai chữ đầu -> Bonk, NOOB, dumb, pepecringe
        chosenCategory = "SUPER_DUMB";
        fallbackEmoji = "🤦‍♂️";
      } else if (reasonOrDumb === "duplicate") {
        // Lặp từ cũ -> Bruh, Cạn lời
        chosenCategory = "BRUH";
        fallbackEmoji = "🗿";
      } else if (reasonOrDumb === "reversal") {
        // Bắt bài lặp từ vừa đảo -> stfu, bớt mồm
        chosenCategory = "SHUT";
        fallbackEmoji = "🤨";
      } else if (reasonOrDumb === "not_in_dict") {
        // Chế từ / không có trong từ điển -> who_tf, Hề, Cười nhạo
        const options = ["SURPRISED", "CLOWN", "SUPER_DUMB", "CRY"];
        chosenCategory = options[Math.floor(Math.random() * options.length)];
        fallbackEmoji = "🤣";
      } else if (reasonOrDumb === "scramble_wrong") {
        // Đoán sai sắp xếp từ -> Hề hước, NOOB, who_tf
        const options = ["SUPER_DUMB", "CLOWN", "SURPRISED"];
        chosenCategory = options[Math.floor(Math.random() * options.length)];
        fallbackEmoji = "🤡";
      } else {
        // Mặc định chung cho các lỗi khác
        const categories = ["SUPER_DUMB", "BRUH", "CLOWN", "SURPRISED", "CRY", "SHUT"];
        chosenCategory = categories[Math.floor(Math.random() * categories.length)];
        fallbackEmoji = "💀";
      }

      const extraEmoji = getRandomEmotionEmoji(chosenCategory);
      await safeReact(message, extraEmoji, fallbackEmoji);
    }
  } catch (err) {
    console.error(`❌ Error in applySmartMoveReaction to ${message.id}:`, err.message);
  }
}

module.exports = {
  safeReact,
  getDefaultCorrectEmoji,
  getDefaultWrongEmoji,
  getRandomEmotionEmoji,
  applySmartMoveReaction,
};
