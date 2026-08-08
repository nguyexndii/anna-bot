// src/utils/emojiManager.js
const { DEFAULT_REACTIONS, REACTION_GROUPS, EMOTION_CHANCE } = require("../config/reactions");

/**
 * Lấy Emoji Mặc Định khi gõ ĐÚNG (ngẫu nhiên 1 trong 2 icon)
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
 * @param {string} category - 'SUPER_DUMB' | 'BRUH' | 'CLOWN' | 'SURPRISED' | 'CRY' | 'SKULL' | 'COOL' | 'SHUT' | 'CHILL'
 * @returns {string} Emoji ID
 */
function getRandomEmotionEmoji(category = "COOL") {
  const group = REACTION_GROUPS[category] || REACTION_GROUPS.COOL;
  return group[Math.floor(Math.random() * group.length)];
}

/**
 * Thả Reaction thông minh vào tin nhắn với tỷ lệ 20% ngẫu nhiên
 * @param {object} message - Discord Message
 * @param {boolean} isCorrect - Trạng thái từ đúng hay sai
 * @param {boolean} isSuperDumb - Trạng thái nếu gõ quá ngu ngu
 */
async function applySmartMoveReaction(message, isCorrect, isSuperDumb = false) {
  try {
    if (isCorrect) {
      // 1. Thả icon ĐÚNG mặc định
      const correctEmoji = getDefaultCorrectEmoji();
      await message.react(correctEmoji);

      // 2. Tỷ lệ 20% ngẫu nhiên thả thêm 1 icon cảm xúc ngầu / đắc thắng / chill
      if (Math.random() < EMOTION_CHANCE) {
        const categories = ["COOL", "CHILL", "SURPRISED"];
        const chosenCategory = categories[Math.floor(Math.random() * categories.length)];
        const extraEmoji = getRandomEmotionEmoji(chosenCategory);
        await message.react(extraEmoji).catch(() => {});
      }
    } else {
      // 1. Thả icon SAI mặc định (figurinha3068)
      const wrongEmoji = getDefaultWrongEmoji();
      await message.react(wrongEmoji);

      // 2. Tỷ lệ 20% ngẫu nhiên thả thêm 1 icon cảm xúc
      if (Math.random() < EMOTION_CHANCE) {
        let chosenCategory = "CLOWN";
        if (isSuperDumb) {
          chosenCategory = "SUPER_DUMB"; // Bonk!
        } else {
          const categories = ["SUPER_DUMB", "BRUH", "CLOWN", "CRY", "SKULL"];
          chosenCategory = categories[Math.floor(Math.random() * categories.length)];
        }
        const extraEmoji = getRandomEmotionEmoji(chosenCategory);
        await message.react(extraEmoji).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`❌ Error in applySmartMoveReaction to ${message.id}:`, err.message);
  }
}

module.exports = {
  getDefaultCorrectEmoji,
  getDefaultWrongEmoji,
  getRandomEmotionEmoji,
  applySmartMoveReaction,
};
