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

// Track used words to prevent repetition in playing sessions (up to 500 words)
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

// Rich backup pool of 100+ diverse Vietnamese 2-word phrases
const BACKUP_WORDS = [
  // Cảm xúc & Tâm lý
  "hạnh phúc", "bình an", "yêu thương", "trí tuệ", "thành công",
  "kiên trì", "sáng tạo", "phát triển", "tự do", "dũng cảm",
  "đoàn kết", "trách nhiệm", "khiêm tốn", "trung thực", "nhiệt huyết",
  "khát vọng", "tương lai", "hy vọng", "bảo vệ", "xây dựng",
  "giao lưu", "thưởng thức", "kỷ niệm", "nguy hiểm", "thử thách",
  "chiến thắng", "nỗ lực", "vinh quang", "tự hào", "đam đam",
  "lý tưởng", "nghệ thuật", "kiến thức", "kinh nghiệm", "kỹ năng",
  "thân thiện", "lạc quan", "vui vẻ", "hào hứng", "trân trọng",
  "bình tĩnh", "tự tin", "quyết tâm", "bao dung", "nhân ái",
  "khiêm nhường", "thành thật", "tình cảm", "gắn kết", "chia sẻ",

  // Thiên nhiên & Vũ trụ
  "mặt trời", "mặt trăng", "ngôi sao", "vũ trụ", "hành tinh",
  "bão táp", "nắng sớm", "mưa rào", "hoàng hôn", "bình minh",
  "dòng sông", "biển cả", "ngọn núi", "rừng xanh", "cánh đồng",
  "thung lũng", "thác nước", "đám mây", "làn gió", "tuyết trắng",
  "sương mù", "sấm sét", "cầu vồng", "thủy triều", "san hô",
  "đảo ngọc", "hang động", "sa mạc", "thảo nguyên", "suối mát",

  // Đời sống & Con người
  "gia đình", "bạn bè", "thầy cô", "mái trường", "quê hương",
  "đất nước", "con người", "sức khỏe", "tuổi trẻ", "thanh xuân",
  "ước mơ", "hoài bão", "nụ cười", "ánh mắt", "kỷ luật",
  "văn hóa", "truyền thống", "lịch sử", "văn học", "âm nhạc",
  "hội họa", "nhiếp ảnh", "điện ảnh", "du lịch", "khám phá",
  "trải nghiệm", "thực tế", "đổi mới", "chiến lược", "kế hoạch",

  // Xã hội & Công nghệ
  "phát minh", "công nghệ", "nghiên cứu", "kỹ thuật", "khoa học",
  "giáo dục", "học tập", "tài năng", "sản xuất", "kinh doanh",
  "đầu tư", "hợp tác", "giao tiếp", "lãnh đạo", "quản lý",
  "mục tiêu", "thành tựu", "bứt phá", "cơ hội", "tiềm năng",
  "giá trị", "sứ mệnh", "tầm nhìn", "hiệu quả", "văn minh",

  // Cuộc sống hàng ngày & Vật thể
  "bức tranh", "cuốn sách", "cây đàn", "bàn học", "chiếc xe",
  "con đường", "góc phố", "tiệm trà", "bữa cơm", "mái nhà",
  "khung hình", "trang sách", "giai điệu", "vần thơ", "câu chuyện",
  "lời ca", "tiếng cười", "kỷ vật", "chiếc lá", "bông hoa",
  "ngọn nến", "hơi thở", "nhịp đập", "giấc mơ", "ánh sáng",
  "bóng râm", "bình hoa", "ấm trà", "đồng hồ", "chuyến đi"
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
  const TOPICS = [
    "Thiên nhiên", "Đời sống", "Tri thức", "Tình cảm", "Cảm xúc",
    "Ý chí", "Nghệ thuật", "Thể thao", "Xã hội", "Gia đình", "Học tập",
    "Khoa học", "Văn hóa", "Vũ trụ", "Công nghệ", "Âm nhạc", "Văn học"
  ];
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
          if (usedScrambleWords.size > 500) usedScrambleWords.clear();

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

  // Backup fallback with random selection from unused pool
  const unusedBackups = BACKUP_WORDS.filter(w => !usedScrambleWords.has(w));
  const pool = unusedBackups.length > 0 ? unusedBackups : BACKUP_WORDS;
  const randomWord = pool[Math.floor(Math.random() * pool.length)];
  usedScrambleWords.add(randomWord);
  if (usedScrambleWords.size > 500) usedScrambleWords.clear();

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
