// src/features/wordscramble/scramble.service.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const LeaderboardModel = require("../../database/models/Leaderboard");
const ActiveGameStateModel = require("../../database/models/ActiveGameState");
const { callGeminiApi } = require("../wordchain/aiValidator.service");
const { normalize } = require("../../utils/textUtils");

const SCRAMBLE_DATA_FILE = path.join(__dirname, "../../data/leaderboard_scramble.json");
const ACTIVE_SCRAMBLE_FILE = path.join(__dirname, "../../data/active_scramble.json");

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

/**
 * Serialize scramble state for MongoDB / JSON file storage
 */
function serializeScrambleState(state) {
  if (!state) return null;
  return {
    active: state.active,
    originalWord: state.originalWord,
    scrambledText: state.scrambledText,
    hintText: state.hintText,
    startTime: state.startTime,
  };
}

/**
 * Save active scramble state to MongoDB Atlas and local backup file
 */
async function saveActiveScrambleState(isActive = true) {
  try {
    const serialized = serializeScrambleState(scrambleState);
    const active = Boolean(isActive && scrambleState.active && scrambleState.originalWord);
    serialized.active = active;

    // 1. Save to local JSON backup
    try {
      const dir = path.dirname(ACTIVE_SCRAMBLE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        ACTIVE_SCRAMBLE_FILE,
        JSON.stringify({ active, data: serialized, lastUpdated: new Date() }, null, 2),
        "utf-8"
      );
    } catch (fsErr) {
      console.error("❌ Error saving local active scramble file:", fsErr.message);
    }

    // 2. Save to MongoDB Atlas Database
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await ActiveGameStateModel.findOneAndUpdate(
        { gameId: "wordscramble" },
        {
          active,
          data: serialized,
          lastUpdated: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      ).catch((dbErr) => console.error("❌ Error saving active scramble state to DB:", dbErr.message));
    }
  } catch (err) {
    console.error("❌ Error in saveActiveScrambleState:", err.message);
  }
}

/**
 * Restore active scramble state from MongoDB Atlas or local JSON file upon bot restart
 * @param {import("discord.js").TextBasedChannel} [scrambleChannel]
 * @returns {Promise<{restored: boolean, state: object|null}>}
 */
async function restoreScrambleState(scrambleChannel = null) {
  try {
    let savedData = null;

    // 1. Try to load from MongoDB Atlas first
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await ActiveGameStateModel.findOne({ gameId: "wordscramble" }).lean();
        if (doc && doc.active && doc.data && doc.data.originalWord) {
          savedData = doc.data;
        }
      } catch (dbErr) {
        console.warn("⚠️ Cannot read scramble state from MongoDB:", dbErr.message);
      }
    }

    // 2. Fallback to local JSON file if DB has nothing
    if (!savedData && fs.existsSync(ACTIVE_SCRAMBLE_FILE)) {
      try {
        const raw = fs.readFileSync(ACTIVE_SCRAMBLE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.active && parsed.data && parsed.data.originalWord) {
          savedData = parsed.data;
        }
      } catch (fileErr) {
        console.warn("⚠️ Cannot read local active scramble file:", fileErr.message);
      }
    }

    // 3. Cross-check with recent messages in scrambleChannel
    if (scrambleChannel && scrambleChannel.isTextBased()) {
      try {
        const messages = await scrambleChannel.messages.fetch({ limit: 5 }).catch(() => null);
        if (messages && messages.size > 0) {
          const recentArr = Array.from(messages.values());
          const lastMsg = recentArr[0];

          // If the last message is a win message, then this puzzle was already solved!
          if (lastMsg.content && lastMsg.content.includes("đã xuất sắc giải đáp chính xác")) {
            console.log("ℹ️ Câu đố Sắp Xếp Từ trước đã được giải đáp, sẽ tạo câu đố mới.");
            return { restored: false, state: null };
          }
        }
      } catch (chanErr) {
        console.warn("⚠️ Warning checking channel messages for WordScramble:", chanErr.message);
      }
    }

    if (savedData && savedData.originalWord && savedData.scrambledText) {
      scrambleState.active = true;
      scrambleState.originalWord = savedData.originalWord;
      scrambleState.scrambledText = savedData.scrambledText;
      scrambleState.hintText = savedData.hintText || "";
      scrambleState.startTime = savedData.startTime || Date.now();

      console.log(
        `🧩 Khôi phục câu đố Sắp Xếp Từ dở dang thành công! Từ gốc: "${scrambleState.originalWord}" (Scrambled: ${scrambleState.scrambledText})`
      );
      return { restored: true, state: scrambleState };
    }

    return { restored: false, state: null };
  } catch (err) {
    console.error("❌ Lỗi khi khôi phục Sắp Xếp Từ:", err.message);
    return { restored: false, state: null };
  }
}

// Rich backup pool of challenging Vietnamese 2-word phrases with contextual definition hints
const BACKUP_CHALLENGES = [
  // Từ láy tượng hình & tâm trạng sâu sắc
  { word: "khắc khoải", hint: "Tâm trạng bồn chồn, lo lắng day dứt khôn nguôi." },
  { word: "bàng hoàng", hint: "Cảm giác sững sờ, kinh ngạc trước biến cố bất ngờ." },
  { word: "chông chênh", hint: "Ở thế không vững vàng, dễ nghiêng ngả chao đảo." },
  { word: "nghiệt ngã", hint: "Khắc nghiệt, cay đắng và không khoan nhượng." },
  { word: "quạnh quẽ", hint: "Cảnh tượng vắng vẻ, cô đơn và trống trải đến nao lòng." },
  { word: "huyễn hoặc", hint: "Mơ hồ, hão huyền và dễ khiến người ta mê muội." },
  { word: "xao xuyến", hint: "Cảm giác bâng khuâng, rung động êm dịu trong lòng." },
  { word: "thao thức", hint: "Trằn trọc không ngủ được vì suy nghĩ miên man." },
  { word: "chập chùng", hint: "Nhấp nhô nối tiếp nhau lớp này đến lớp khác." },
  { word: "rạo rực", hint: "Cảm xúc hưng phấn, sôi nổi dâng trào trong lòng." },
  { word: "bâng khuâng", hint: "Nỗi niềm man mác, ngơ ngẩn khó tả thành lời." },
  { word: "hoang hoải", hint: "Cảm giác trống vắng, mơ hồ và buồn miên man." },
  { word: "liêu xiêu", hint: "Dáng vẻ xiêu vẹo, không đứng vững trước gió bão." },
  { word: "lênh đênh", hint: "Trôi nổi phiêu dạt trên mặt nước vô định." },
  { word: "chới với", hint: "Vung vẫy trong thế mất thăng bằng, bất lực." },
  { word: "ngập ngừng", hint: "Lưỡng lự, do dự chưa dứt khoát đưa ra hành động." },
  { word: "day dứt", hint: "Nỗi đau âm ỉ, áy náy khôn nguôi trong tâm can." },
  { word: "rêu phong", hint: "Dấu tích của thời gian phủ lên cảnh vật xưa cũ." },
  { word: "tiều tụy", hint: "Vẻ ngoài xơ xác, gầy gò vì mệt mỏi và gian truân." },
  { word: "bạc bẽo", hint: "Lòng dạ thay đổi nhanh chóng, không trọn vẹn tình nghĩa." },
  { word: "mênh mang", hint: "Rộng lớn bao la đến ngút ngàn tầm mắt." },
  { word: "hắt hiu", hint: "Thổi nhè nhẹ từng cơn buồn bã, gợi sự cô đơn." },
  { word: "hun hút", hint: "Sâu hoặc xa tít tắp, tạo cảm giác vô tận rợn ngợp." },
  { word: "ngút ngàn", hint: "Trải dài vượt xa tầm mắt, vô cùng tận." },
  { word: "hụt hẫng", hint: "Cảm giác mất chỗ dựa bất ngờ, hụt chân về mặt cảm xúc." },

  // Từ Hán - Việt thâm thúy & Phẩm chất
  { word: "uyên bác", hint: "Học vấn sâu rộng, am hiểu tinh thông mọi sự." },
  { word: "khảng khái", hint: "Hào hiệp, thẳng thắn và không toan tính nhỏ nhen." },
  { word: "phù phiếm", hint: "Hào nhoáng bề ngoài nhưng rỗng tuếch, vô nghĩa." },
  { word: "tịch mịch", hint: "Yên lặng, tĩnh mịch đến mức u tịch cô quạnh." },
  { word: "trầm mặc", hint: "Trầm ngâm, tĩnh lặng và suy tư sâu sắc." },
  { word: "can trường", hint: "Gan dạ, dũng cảm và kiên cường trước nguy nan." },
  { word: "bất khuất", hint: "Không chịu khuất phục trước uy quyền hay hiểm nguy." },
  { word: "mẫn tiệp", hint: "Nhanh nhẹn, thông minh và sắc sảo trong nhận thức." },
  { word: "tiêu dao", hint: "Thong dong tự tại, không vướng bận sự đời." },
  { word: "huyên náo", hint: "Ồn ào, rộn rã và náo nhiệt với nhiều âm thanh." },
  { word: "ngạo nghễ", hint: "Ngẩng cao đầu đầy kiêu hãnh và bất cần." },
  { word: "thâm sâu", hint: "Sâu sắc và khó dò xét đến tận cùng bản chất." },
  { word: "vi diệu", hint: "Màu nhiệm, tinh tế và huyền bí khó giải thích." },
  { word: "kiên định", hint: "Vững vàng không lay chuyển trước mọi khó khăn." },
  { word: "hoài bão", hint: "Khát vọng lớn lao muốn vươn tới trong cuộc đời." },
  { word: "nghiệt duyên", hint: "Mối lương duyên trắc trở, oan trái và đau buồn." },
  { word: "tao nhã", hint: "Thanh lịch, trang nhã và đượm chất nghệ thuật." },
  { word: "cố chấp", hint: "Khư khư giữ lấy định kiến, không chịu lắng nghe." },
  { word: "ảo vọng", hint: "Hy vọng hão huyền vào những điều không có thật." },
  { word: "tuyệt mỹ", hint: "Vẻ đẹp hoàn hảo, tinh tế không tì vết." },
  { word: "chính trực", hint: "Ngay thẳng, công minh và không tư lợi cá nhân." },
  { word: "nghịch cảnh", hint: "Hoàn cảnh trớ trêu, trắc trở và đầy gian nan." },
  { word: "huyết mạch", hint: "Mạch máu cốt lõi truyền đời của dòng giống." },
  { word: "thiên lương", hint: "Bản tính lương thiện trời phú trong tâm hồn." },
  { word: "hóa thạch", hint: "Di tích sinh vật cổ xưa biến thành đá qua hàng triệu năm." },

  // Thiên nhiên & Hiện tượng kỳ thú
  { word: "nguyệt thực", hint: "Hiện tượng thiên văn khi Mặt Trăng đi vào vùng bóng Trái Đất." },
  { word: "nhật thực", hint: "Hiện tượng thiên văn khi Mặt Trời bị Mặt Trăng che khuất." },
  { word: "tinh vân", hint: "Đám mây bụi khí khổng lồ phát sáng lộng lẫy ngoài vũ trụ." },
  { word: "băng đăng", hint: "Tác phẩm điêu khắc nghệ thuật tinh xảo từ khối băng tuyết." },
  { word: "thủy triều", hint: "Hiện tượng nước biển dâng lên và hạ xuống tuần hoàn theo chu kỳ." },
  { word: "bão cát", hint: "Cơn lốc cuộn tung cát bụi mù trời nơi sa mạc khô hạn." },
  { word: "hỏa hoạn", hint: "Thảm họa cháy dữ dội gây tổn thất to lớn." },
  { word: "hắc ám", hint: "Bóng tối bao trùm u ám, lạnh lẽo và đáng sợ." },
  { word: "huyễn cảnh", hint: "Cảnh tượng hư ảo, đẹp lung linh tựa như trong cõi mộng." },
  { word: "hoàng hôn", hint: "Khoảnh khắc cuối ngày khi vầng dương chìm dần vào bóng tối." },
  { word: "bình minh", hint: "Thời khắc những tia nắng đầu ngày hé rạng xua tan đêm đen." },
  { word: "sơn hà", hint: "Núi sông gấm vóc, bờ cõi thiêng liêng của một đất nước." },
  { word: "địa cầu", hint: "Hành tinh xanh bao la nơi muôn loài cùng sinh sôi." },
  { word: "thác đổ", hint: "Dòng nước lao dốc từ vách núi cao tung bọt trắng xóa." },
  { word: "phù sa", hint: "Lớp đất màu mỡ lắng đọng bồi đắp đôi bờ sông lớn." }
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
    "Từ láy tượng hình / tượng thanh đặc sắc",
    "Tâm trạng & Cảm xúc sâu sắc",
    "Từ Hán - Việt uyên bác & thâm thúy",
    "Phẩm chất, Ý chí & Khí phách can trường",
    "Thiên nhiên hùng vĩ & Hiện tượng bí ẩn",
    "Triết lý, Đời sống & Nhân sinh quan",
    "Nghệ thuật, Văn học & Ngôn từ tao nhã",
    "Khái niệm trừu tượng & Không gian thời gian"
  ];
  const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  const prompt = `Bạn là Trọng tài Trò chơi Sắp Xếp Từ Tiếng Việt cấp độ Thử Thách Trí Tuệ (Intermediate - Hard).
Nhiệm vụ của bạn là tạo ngẫu nhiên 1 cụm từ tiếng Việt 2 tiếng thuộc chủ đề: "${randomTopic}".

YÊU CẦU ĐỘ KHÓ & TỪ VỰNG:
1. Cụm từ BẮT BUỘC có đúng 2 tiếng (2 từ đơn ghép lại).
2. TỪ VỰNG PHẢI ĐẶC SẮC, GIÀU TÍNH THỬ THÁCH, CẤU TRÚC PHỨC TẠP:
   - Ưu tiên từ láy giàu hình tượng hoặc cảm xúc (ví dụ: "khắc khoải", "bàng hoàng", "chông chênh", "quạnh quẽ", "xao xuyến", "thao thức", "nghiệt ngã", "huyễn hoặc", "chập chùng", "rạo rực", "liêu xiêu", "lênh đênh", "bâng khuâng", "hoang hoải").
   - Hoặc từ Hán-Việt thâm thúy, tinh tế (ví dụ: "uyên bác", "khảng khái", "phù phiếm", "tịch mịch", "trầm mặc", "can trường", "kiên định", "bất khuất", "mẫn tiệp", "ngạo nghễ", "tiêu dao", "huyên náo", "thâm sâu").
   - Hoặc hiện tượng tự nhiên/khái niệm kỳ thú (ví dụ: "nguyệt thực", "nhật thực", "tinh vân", "thủy triều", "băng đăng", "hóa thạch", "huyễn cảnh").
3. TUYỆT ĐỐI KHÔNG chọn các từ quá đơn giản, phổ thông hàng ngày như: "cây cối", "học tập", "gia đình", "bàn học", "sách vở", "bữa cơm", "bình an", "vui vẻ".
4. Gợi ý (hint) PHẢI LÀ 1 CÂU GIẢI NGHĨA TỪ ĐIỂN HOẶC CÂU ĐỐ NGHĨA BÓNG NGẮN GỌN (khoảng 8-15 từ), KHÔNG ĐƯỢC nói toẹt tên chủ đề hay nhắc đến các chữ cái trong từ!

Bắt buộc trả về đúng định dạng JSON:
{
  "word": "cụm từ 2 tiếng độ khó cao",
  "hint": "Câu giải nghĩa ẩn dụ hoặc định nghĩa ngắn gọn"
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
  const unusedBackups = BACKUP_CHALLENGES.filter(c => !usedScrambleWords.has(c.word));
  const pool = unusedBackups.length > 0 ? unusedBackups : BACKUP_CHALLENGES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  usedScrambleWords.add(picked.word);
  if (usedScrambleWords.size > 500) usedScrambleWords.clear();

  return {
    word: picked.word,
    hint: picked.hint
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
  saveActiveScrambleState(true);

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
      { upsert: true, returnDocument: 'after' }
    ).catch(err => console.error("❌ Error updating MongoDB Atlas scramble leaderboard:", err.message));
  }

  // 3. Mark active scramble state as solved/inactive
  saveActiveScrambleState(false);

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
  restoreScrambleState,
};
