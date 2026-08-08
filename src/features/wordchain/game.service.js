// src/features/wordchain/game.service.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const LeaderboardModel = require("../../database/models/Leaderboard");
const { getEasyStartPhrase } = require("./wordPairs.service");
const { lastKey, normalize } = require("../../utils/textUtils");

const WORDCHAIN_DATA_FILE = path.join(__dirname, "../../data/leaderboard_wordchain.json");

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
  if (!gameState) return;

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
}

/**
 * Record a win for a player
 * @param {string} userId
 * @param {string} username
 * @returns {number} Total wins for this player
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
      { upsert: true, new: true }
    ).catch((err) => console.error("❌ Error updating MongoDB Atlas wordchain leaderboard:", err.message));
  }

  console.log(`🏆 Win recorded for ${username} (${userId}). Total wins: ${player.wins}`);
  return player.wins;
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
};
