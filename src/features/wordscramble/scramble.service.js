// src/features/wordscramble/scramble.service.js
const { callGeminiApi } = require("../wordchain/aiValidator.service");
const { normalize } = require("../../utils/textUtils");

// Game State for Word Scramble
let scrambleState = {
  active: false,
  originalWord: "",        // e.g. "bình an"
  scrambledText: "",       // e.g. "n / a / h / b / ì / n"
  hintText: "",            // e.g. "Cảm xúc / Trạng thái"
  startTime: null,
  scores: new Map(),       // userId -> wins count
};

// Fallback backup words if AI is offline
const BACKUP_WORDS = [
  "hạnh phúc", "bình an", "yêu thương", "trí tuệ", "thành công",
  "kiên trì", "sáng tạo", "phát triển", "tự do", "dũng cảm",
  "đoàn kết", "trách nhiệm", "khiêm tốn", "trung thực", "nhiệt huyết"
];

/**
 * Scramble letters of a phrase while preserving or showing character count
 * @param {string} text 
 * @returns {string} Scrambled text e.g. "n • a • h • b • ì • n"
 */
function scramblePhrase(text) {
  const letters = text.replace(/\s+/g, "").split("");
  
  // Shuffle array
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }

  // If shuffle accidentally produced original text, reverse it
  if (letters.join("") === text.replace(/\s+/g, "")) {
    letters.reverse();
  }

  return letters.map(l => `\`${l}\``).join(" • ");
}

/**
 * Generate a new Vietnamese target phrase using Gemini 3.1 Flash Lite
 * @returns {Promise<{word: string, hint: string}>}
 */
async function generateWordWithAI() {
  const prompt = `Bạn là Trò chơi Sắp Xếp Từ Tiếng Việt.
Hãy tạo 1 cụm từ tiếng Việt 2 tiếng có nghĩa, phổ biến, nghiêm túc (ví dụ: "hạnh phúc", "bình an", "phát triển").
Kèm theo 1 gợi ý ngắn 3-5 từ về chủ đề của từ đó.

Bắt buộc trả về đúng định dạng JSON:
{
  "word": "cụm từ 2 tiếng",
  "hint": "Gợi ý chủ đề ngắn"
}`;

  try {
    const data = await callGeminiApi(prompt, 0.7);
    if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      if (parsed.word && parsed.word.trim().split(/\s+/).length === 2) {
        return {
          word: parsed.word.trim().toLowerCase(),
          hint: parsed.hint || "Cụm từ 2 tiếng thông dụng"
        };
      }
    }
  } catch (err) {
    console.error("❌ Lỗi sinh từ Sắp Xếp từ AI:", err.message);
  }

  // Backup fallback
  const randomWord = BACKUP_WORDS[Math.floor(Math.random() * BACKUP_WORDS.length)];
  return {
    word: randomWord,
    hint: "Cụm từ tiếng Việt có nghĩa"
  };
}

/**
 * Start a new Word Scramble round
 */
async function startScrambleRound() {
  const generated = await generateWordWithAI();
  const scrambled = scramblePhrase(generated.word);

  scrambleState.active = true;
  scrambleState.originalWord = generated.word;
  scrambleState.scrambledText = scrambled;
  scrambleState.hintText = generated.hint;
  scrambleState.startTime = Date.now();

  return {
    originalWord: generated.word,
    scrambledText: scrambled,
    hintText: generated.hint
  };
}

/**
 * Check player guess against original word
 */
function checkGuess(guessText) {
  if (!scrambleState.active) return false;
  return normalize(guessText) === normalize(scrambleState.originalWord);
}

/**
 * Record player win
 */
function recordScrambleWin(userId, username) {
  const currentWins = scrambleState.scores.get(userId) || { username, wins: 0 };
  currentWins.wins += 1;
  currentWins.username = username;
  scrambleState.scores.set(userId, currentWins);
  return currentWins.wins;
}

/**
 * Get Scramble Leaderboard
 */
function getScrambleLeaderboard() {
  return Array.from(scrambleState.scores.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.wins - a.wins);
}

function getScrambleState() {
  return scrambleState;
}

module.exports = {
  startScrambleRound,
  checkGuess,
  recordScrambleWin,
  getScrambleLeaderboard,
  getScrambleState,
};
