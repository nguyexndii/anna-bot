// src/features/wordchain/game.service.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const LeaderboardModel = require("../../database/models/Leaderboard");
const ActiveGameStateModel = require("../../database/models/ActiveGameState");
const { getEasyStartPhrase } = require("./wordPairs.service");
const { lastKey, normalize } = require("../../utils/textUtils");

const WORDCHAIN_DATA_FILE = path.join(__dirname, "../../data/leaderboard_wordchain.json");
const ACTIVE_WORDCHAIN_FILE = path.join(__dirname, "../../data/active_wordchain.json");

/**
 * Load wordchain leaderboard from file
 */
function loadWordChainScores() {
  try {
    if (fs.existsSync(WORDCHAIN_DATA_FILE)) {
      const raw = fs.readFileSync(WORDCHAIN_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const map = new Map();
      Object.entries(parsed).forEach(([id, data]) => {
        map.set(id, data);
      });
      return map;
    }
  } catch (err) {
    console.error("❌ Error loading wordchain leaderboard file:", err.message);
  }
  return new Map();
}

/**
 * Save wordchain leaderboard to file
 */
function saveWordChainScores(scoresMap) {
  try {
    const dir = path.dirname(WORDCHAIN_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(scoresMap.entries());
    fs.writeFileSync(WORDCHAIN_DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Error saving wordchain leaderboard file:", err.message);
  }
}

// Game state (in-memory)
let gameState = null;

// Player scores (persistent file-backed Map)
const playerScores = loadWordChainScores();

/**
 * Serialize game state for MongoDB / JSON file storage
 */
function serializeGameState(state) {
  if (!state) return null;
  return {
    currentWord: state.currentWord,
    normalizedWord: state.normalizedWord,
    expectedKey: state.expectedKey,
    usedWords: Array.from(state.usedWords || []),
    recentPairs: state.recentPairs || [],
    startedAt: state.startedAt,
    startedBy: state.startedBy,
    moveCount: state.moveCount || 0,
    sessionScores: Array.from((state.sessionScores || new Map()).entries()),
  };
}

/**
 * Deserialize game state from MongoDB / JSON file storage
 */
function deserializeGameState(data) {
  if (!data || !data.currentWord) return null;
  return {
    currentWord: data.currentWord,
    normalizedWord: data.normalizedWord,
    expectedKey: data.expectedKey,
    usedWords: new Set(data.usedWords || []),
    recentPairs: data.recentPairs || [],
    startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
    startedBy: data.startedBy,
    moveCount: data.moveCount || 0,
    sessionScores: new Map(data.sessionScores || []),
  };
}

/**
 * Save active game state to MongoDB Atlas and local backup file
 */
async function saveActiveGameState(isActive = true) {
  try {
    const serialized = serializeGameState(gameState);
    const active = Boolean(isActive && gameState && gameState.currentWord);

    // 1. Save to local JSON backup
    try {
      const dir = path.dirname(ACTIVE_WORDCHAIN_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        ACTIVE_WORDCHAIN_FILE,
        JSON.stringify({ active, data: serialized, lastUpdated: new Date() }, null, 2),
        "utf-8"
      );
    } catch (fsErr) {
      console.error("❌ Error saving local active wordchain file:", fsErr.message);
    }

    // 2. Save to MongoDB Atlas Database
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await ActiveGameStateModel.findOneAndUpdate(
        { gameId: "wordchain" },
        {
          active,
          data: serialized,
          lastUpdated: new Date(),
        },
        { upsert: true, returnDocument: "after" }
      ).catch((dbErr) => console.error("❌ Error saving active wordchain state to DB:", dbErr.message));
    }
  } catch (err) {
    console.error("❌ Error in saveActiveGameState:", err.message);
  }
}

/**
 * Restore active game state from MongoDB Atlas or local JSON file upon bot restart
 * @param {import("discord.js").TextBasedChannel} [chainChannel]
 * @returns {Promise<{restored: boolean, state: object|null}>}
 */
async function restoreWordChainState(chainChannel = null) {
  try {
    let savedData = null;

    // 1. Try to load from MongoDB Atlas first
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await ActiveGameStateModel.findOne({ gameId: "wordchain" }).lean();
        if (doc && doc.active && doc.data && doc.data.currentWord) {
          savedData = doc.data;
        }
      } catch (dbErr) {
        console.warn("⚠️ Cannot read wordchain state from MongoDB:", dbErr.message);
      }
    }

    // 2. Fallback to local JSON file if DB has nothing
    if (!savedData && fs.existsSync(ACTIVE_WORDCHAIN_FILE)) {
      try {
        const raw = fs.readFileSync(ACTIVE_WORDCHAIN_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.active && parsed.data && parsed.data.currentWord) {
          savedData = parsed.data;
        }
      } catch (fileErr) {
        console.warn("⚠️ Cannot read local active wordchain file:", fileErr.message);
      }
    }

    // 3. Cross-check with recent messages in chainChannel to ensure round isn't already finished
    if (chainChannel && chainChannel.isTextBased()) {
      try {
        const messages = await chainChannel.messages.fetch({ limit: 10 }).catch(() => null);
        if (messages && messages.size > 0) {
          const recentArr = Array.from(messages.values());
          const lastMsg = recentArr[0];

          // Check if latest message is a win embed or win announcement
          const hasWinEmbed =
            lastMsg.embeds &&
            lastMsg.embeds.some((e) => e.title && e.title.includes("CHIẾN THẮNG"));
          if (hasWinEmbed) {
            console.log("ℹ️ Ván trước đã có người chiến thắng, sẽ bắt đầu ván mới.");
            return { restored: false, state: null };
          }
        }
      } catch (chanErr) {
        console.warn("⚠️ Warning checking channel messages for WordChain:", chanErr.message);
      }
    }

    if (savedData && savedData.currentWord) {
      gameState = deserializeGameState(savedData);
      console.log(
        `🔄 Khôi phục ván Nối Từ dở dang thành công! Từ hiện tại: "${gameState.currentWord}" (Chữ tiếp theo: "${gameState.expectedKey}"), lượt đã đi: ${gameState.moveCount}`
      );
      return { restored: true, state: gameState };
    }

    return { restored: false, state: null };
  } catch (err) {
    console.error("❌ Lỗi khi khôi phục ván Nối Từ:", err.message);
    return { restored: false, state: null };
  }
}

/**
 * Start or restart the game
 * @param {string} userId - User/Bot who started the game
 * @param {string} username - Username (optional)
 * @returns {object} New game state
 */
function startGame(userId, username = "Bot") {
  const startPhrase = getEasyStartPhrase();
  const normalized = normalize(startPhrase);

  gameState = {
    currentWord: startPhrase,
    normalizedWord: normalized,
    expectedKey: lastKey(startPhrase),
    usedWords: new Set([normalized]),
    recentPairs: [],
    startedAt: new Date(),
    startedBy: userId,
    moveCount: 0,
    sessionScores: new Map(), // Scores for current game session only
  };

  console.log(`🎮 Game started by ${username} (${userId}). Initial phrase: "${startPhrase}"`);
  saveActiveGameState(true);
  return gameState;
}

/**
 * Check if game is currently active
 * @returns {boolean}
 */
function isGameActive() {
  return gameState !== null;
}

/**
 * Get current game state
 * @returns {object|null}
 */
function getCurrentState() {
  return gameState;
}

/**
 * Check if word has been used in current game
 * @param {string} normalizedWord
 * @returns {boolean}
 */
function checkDuplicate(normalizedWord) {
  if (!gameState) return false;
  return gameState.usedWords.has(normalizedWord);
}

/**
 * Check if user is spamming reversal (e.g. A-B then B-A repeatedly)
 * @param {string} normalizedWord
 * @returns {boolean}
 */
function checkReversal(normalizedWord) {
  if (!gameState || !gameState.recentPairs) return false;
  return gameState.recentPairs.includes(normalizedWord);
}

/**
 * Update game state with valid move
 * @param {string} originalWord - Original text (e.g., "dự đoán")
 * @param {string} normalizedWord - Normalized text (e.g., "du doan")
 * @param {string} userId - Player's Discord ID
 * @param {string} username - Player's username
 */
function updateState(originalWord, normalizedWord, userId, username) {
  if (!gameState) {
    return { sessionScore: 0, currentWord: originalWord, expectedKey: "", moveCount: 0 };
  }

  gameState.currentWord = originalWord;
  gameState.normalizedWord = normalizedWord;
  gameState.expectedKey = lastKey(originalWord);
  gameState.usedWords.add(normalizedWord);
  gameState.moveCount++;

  if (!gameState.recentPairs) {
    gameState.recentPairs = [];
  }
  gameState.recentPairs.push(normalizedWord);
  if (gameState.recentPairs.length > 10) {
    gameState.recentPairs.shift();
  }

  if (!gameState.sessionScores.has(userId)) {
    gameState.sessionScores.set(userId, { username, correctWords: 0 });
  }
  const userScore = gameState.sessionScores.get(userId);
  userScore.correctWords++;
  userScore.username = username;

  console.log(
    `✅ State updated: word="${originalWord}", expectedKey="${gameState.expectedKey}", moves=${gameState.moveCount}, ${username}: ${userScore.correctWords} words`
  );

  saveActiveGameState(true);

  return {
    sessionScore: userScore.correctWords,
    currentWord: originalWord,
    expectedKey: gameState.expectedKey,
    moveCount: gameState.moveCount,
  };
}

/**
 * Record a win for a player
 * @param {string} userId
 * @param {string} username
 * @returns {{wins: number, sessionScore: number}}
 */
function recordWin(userId, username) {
  if (!playerScores.has(userId)) {
    playerScores.set(userId, { id: userId, username, wins: 0 });
  }

  const player = playerScores.get(userId);
  player.wins++;
  player.username = username;

  // 1. Save to local JSON backup
  saveWordChainScores(playerScores);

  // 2. Save beautifully to MongoDB Atlas Database
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    LeaderboardModel.findOneAndUpdate(
      { game: "wordchain", userId },
      { $inc: { wins: 1 }, $set: { username } },
      { upsert: true, returnDocument: 'after' }
    ).catch((err) => console.error("❌ Error updating MongoDB Atlas wordchain leaderboard:", err.message));
  }

  // 3. Mark active game state as finished
  saveActiveGameState(false);

  const sessionScore = (gameState && gameState.sessionScores && gameState.sessionScores.get(userId))
    ? gameState.sessionScores.get(userId).correctWords
    : 1;

  console.log(`🏆 Win recorded for ${username} (${userId}). Total wins: ${player.wins}`);
  return {
    wins: player.wins,
    sessionScore,
  };
}

/**
 * Get overall leaderboard sorted by wins
 * @returns {Array<{id: string, username: string, wins: number}>}
 */
function getLeaderboard() {
  return Array.from(playerScores.values())
    .sort((a, b) => b.wins - a.wins);
}

/**
 * Get session scoreboard sorted by correct words
 * @returns {Array<{userId: string, username: string, correctWords: number}>}
 */
function getSessionScoreboard() {
  if (!gameState || !gameState.sessionScores) return [];

  return Array.from(gameState.sessionScores.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.correctWords - a.correctWords);
}

/**
 * Skip current game (create new game with new word)
 * @param {string} userId
 * @param {string} username
 * @returns {object} New game state
 */
function skipGame(userId, username) {
  console.log(`⏩ Game skipped by ${username} (${userId})`);
  return startGame(userId, username);
}

function getWordChainScoresMap() {
  return playerScores;
}

module.exports = {
  startGame,
  isGameActive,
  getCurrentState,
  checkDuplicate,
  checkReversal,
  updateState,
  recordWin,
  getLeaderboard,
  getSessionScoreboard,
  skipGame,
  getWordChainScoresMap,
  restoreWordChainState,
};
