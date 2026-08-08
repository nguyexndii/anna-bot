// src/features/wordscramble/scramble.service.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const LeaderboardModel = require("../../database/models/Leaderboard");
const { callGeminiApi } = require("../wordchain/aiValidator.service");
const { normalize } = require("../../utils/textUtils");

const SCRAMBLE_DATA_FILE = path.join(__dirname, "../../data/leaderboard_scramble.json");

/**
 * Load scramble leaderboard from file
 */
function loadScrambleScores() {
  try {
    if (fs.existsSync(SCRAMBLE_DATA_FILE)) {
      const raw = fs.readFileSync(SCRAMBLE_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const map = new Map();
      Object.entries(parsed).forEach(([id, data]) => {
        map.set(id, data);
      });
      return map;
    }
  } catch (err) {
    console.error("❌ Error loading scramble leaderboard file:", err.message);
  }
  return new Map();
}

/**
 * Save scramble leaderboard to file
 */
function saveScrambleScores(scoresMap) {
  try {
    const dir = path.dirname(SCRAMBLE_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(scoresMap.entries());
    fs.writeFileSync(SCRAMBLE_DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Error saving scramble leaderboard file:", err.message);
  }
}

// Track used words to prevent repetition in the same playing session
const usedScrambleWords = new Set();

// Game State for Word Scramble
let scrambleState = {
  active: false,
  originalWord: "",        // e.g. "yêu thương"
  scrambledText: "",       // e.g. "N / Ê / Y / H / Ư / G / T / Ơ / U"
  hintText: "",            // e.g. "Cảm xúc / Tình cảm"
  startTime: null,
  scores: loadScrambleScores(),
};

// Rich backup pool of 40+ diverse Vietnamese 2-word phrases
const BACKUP_WORDS = [
  "hạnh phúc", "bình an", "yêu thương", "trí tuệ", "thành công",
  "kiên trì", "sáng tạo", "phát triển", "tự do", "dũng cảm",
  "đoàn kết", "trách nhiệm", "khiêm tốn", "trung thực", "nhiệt huyết",
  "khát vọng", "tương lai", "hy vọng", "bảo vệ", "xây dựng",
  "giao lưu", "thưởng thức", "kỷ niệm", "nguy hiểm", "thử thách",
  "chiến thắng", "nỗ lực", "vinh quang", "tự hào", "đam đam",
  "lý tưởng", "nghệ thuật", "kiến thức", "kinh nghiệm", "kỹ năng"
];

/**
 * Scramble letters of a phrase with slash formatting e.g. "A / B / C"
 */
function scramblePhrase(text) {
  const letters = text.replace(/\s+/g, "").split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  if (letters.join("") === text.replace(/\s+/g, "")) {
    letters.reverse();
  }
  return letters.map(l => l.toUpperCase()).join(" / ");
}

/**
 * Generate a random new Vietnamese target phrase using Gemini 3.1 Flash Lite
 */
async function generateWordWithAI() {
  const TOPICS = ["Thiên nhiên", "Đời sống", "Tri thức", "Tình cảm", "Cảm xúc", "Ý chí", "Nghệ thuật", "Thể thao", "Xã hội", "Gia đình", "Học tập"];
  const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  const prompt = `Bạn là Trò chơi Sắp Xếp Từ Tiếng Việt.
Hãy tạo ngẫu nhiên 1 cụm từ tiếng Việt 2 tiếng thuộc chủ đề "${randomTopic}" có nghĩa, phổ biến, nghiêm túc.
Kèm theo 1 gợi ý ngắn 3-5 từ về chủ đề đó.

Bắt buộc trả về đúng định dạng JSON:
{
  "word": "cụm từ 2 tiếng",
  "hint": "Gợi ý chủ đề ngắn"
}`;

  try {
    const data = await callGeminiApi(prompt, 0.9);
    if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanText);

      if (parsed.word && parsed.word.trim().split(/\s+/).length === 2) {
        const candidateWord = parsed.word.trim().toLowerCase();
        if (!usedScrambleWords.has(candidateWord)) {
          usedScrambleWords.add(candidateWord);
          if (usedScrambleWords.size > 50) usedScrambleWords.clear();

          return {
            word: candidateWord,
            hint: parsed.hint || `Thuộc chủ đề ${randomTopic}`
          };
        }
      }
    }
  } catch (err) {
    console.error("❌ Lỗi sinh từ Sắp Xếp từ AI:", err.message);
  }

  // Backup fallback
  const unusedBackups = BACKUP_WORDS.filter(w => !usedScrambleWords.has(w));
  const pool = unusedBackups.length > 0 ? unusedBackups : BACKUP_WORDS;
  const randomWord = pool[Math.floor(Math.random() * pool.length)];
  usedScrambleWords.add(randomWord);

  return {
    word: randomWord,
    hint: "Cụm từ tiếng Việt thông dụng"
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

  console.log(`🧩 AI generated new Scramble word: "${generated.word}" (Scrambled: ${scrambled})`);

  return {
    originalWord: generated.word,
    scrambledText: scrambled,
    hintText: generated.hint
  };
}

/**
 * Check player guess against original word (with AI flexible validation for anagrams like "thương yêu" vs "yêu thương")
 */
async function checkGuessAsync(guessText) {
  if (!scrambleState.active || !scrambleState.originalWord) return false;

  const normalizedGuess = normalize(guessText);
  const normalizedOriginal = normalize(scrambleState.originalWord);

  // 1. Direct exact match
  if (normalizedGuess === normalizedOriginal) return true;

  // 2. Check if letters match (ignoring spaces)
  const guessLetters = normalizedGuess.replace(/\s+/g, "").split("").sort().join("");
  const origLetters = normalizedOriginal.replace(/\s+/g, "").split("").sort().join("");

  if (guessLetters === origLetters) {
    // 3. Ask AI if this alternative combination (e.g. "thương yêu" vs "yêu thương") is a valid meaningful phrase
    const prompt = `Bạn là chuyên gia ngôn ngữ Tiếng Việt.
Hãy kiểm tra xem cụm từ "${guessText}" có phải là 1 cụm từ tiếng Việt 2 tiếng có nghĩa, đúng ngữ pháp và hợp lý không.

Bắt buộc trả về đúng định dạng JSON:
{
  "isValid": true/false
}`;

    try {
      const data = await callGeminiApi(prompt, 0.2);
      if (data && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        const cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanText);
        if (parsed.isValid === true) {
          console.log(`✨ AI validated flexible scramble guess: "${guessText}" is valid for original "${scrambleState.originalWord}"`);
          return true;
        }
      }
    } catch (err) {
      console.error("❌ Lỗi AI kiểm tra từ đảo Sắp Xếp:", err.message);
    }
  }

  return false;
}

/**
 * Record player win (+1 win) and save to MongoDB Atlas or local JSON file
 */
function recordScrambleWin(userId, username) {
  const currentData = scrambleState.scores.get(userId) || { username, wins: 0 };
  currentData.wins += 1;
  currentData.username = username;
  scrambleState.scores.set(userId, currentData);

  // Save to local JSON file
  saveScrambleScores(scrambleState.scores);

  // Save to MongoDB Atlas if connected
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    LeaderboardModel.findOneAndUpdate(
      { game: "wordscramble", userId },
      { $inc: { wins: 1 }, $set: { username } },
      { upsert: true, new: true }
    ).catch(err => console.error("❌ Error updating MongoDB Atlas scramble leaderboard:", err.message));
  }

  return currentData.wins;
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
  checkGuessAsync,
  recordScrambleWin,
  getScrambleLeaderboard,
  getScrambleState,
};
