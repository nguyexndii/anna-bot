// src/features/wordchain/wordPairs.service.js
const wordPairs = require("../../data/wordPairs.json");
const { normalize } = require("../../utils/textUtils");
const { verifyWordWithAI } = require("./aiValidator.service");

/**
 * Check if two words can connect according to wordPairs.json
 * @param {string} fromWord - The word to connect from
 * @param {string} toWord - The word to connect to
 * @returns {boolean}
 */
function canConnect(fromWord, toWord) {
  const normalizedFrom = normalize(fromWord);
  const normalizedTo = normalize(toWord);

  const nextWords = wordPairs[normalizedFrom] || [];
  const canConnectResult = nextWords.includes(normalizedTo);

  console.log(
    `🔗 canConnect("${fromWord}", "${toWord}") => ${canConnectResult}`
  );

  return canConnectResult;
}

/**
 * Check if two words can connect (Dictionary first, AI Fallback second using gemini-3.1-flash-lite)
 * @param {string} fromWord 
 * @param {string} toWord 
 * @returns {Promise<{connect: boolean, source: string, explanation?: string}>}
 */
async function canConnectWithAI(fromWord, toWord) {
  if (canConnect(fromWord, toWord)) {
    return { connect: true, source: "dictionary" };
  }

  console.log(`🤖 Từ "${fromWord} ${toWord}" không có trong từ điển tĩnh, đang thẩm định qua AI Gemini 3.1 Flash Lite...`);
  const aiResult = await verifyWordWithAI(fromWord, toWord);
  if (aiResult.valid) {
    return { connect: true, source: "ai", explanation: aiResult.explanation };
  }

  return { connect: false, source: "none", explanation: aiResult.explanation };
}

/**
 * Check if a word has any possible next words
 * @param {string} word
 * @returns {boolean}
 */
function hasNextWords(word) {
  const normalized = normalize(word);
  const nextWords = wordPairs[normalized] || [];

  return nextWords.length > 0;
}

/**
 * Get all possible next words for a given word
 * @param {string} word
 * @returns {string[]}
 */
function getNextWords(word) {
  const normalized = normalize(word);
  return wordPairs[normalized] || [];
}

/**
 * Get a random word from wordPairs to start the game
 * @returns {string}
 */
function getRandomWord() {
  const keys = Object.keys(wordPairs);
  const validKeys = keys.filter((key) => wordPairs[key].length > 0);

  if (validKeys.length === 0) {
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return randomKey;
  }

  const randomKey = validKeys[Math.floor(Math.random() * validKeys.length)];
  return randomKey;
}

/**
 * Get a random 2-word phrase to start the game
 * @returns {string} - Format: "word1 word2"
 */
function getRandomStartPhrase() {
  const firstWord = getRandomWord();
  const nextWords = getNextWords(firstWord);

  if (nextWords.length === 0) {
    return getRandomStartPhrase();
  }

  const secondWord = nextWords[Math.floor(Math.random() * nextWords.length)];
  return `${firstWord} ${secondWord}`;
}

/**
 * Get an easy 2-word phrase to start the game
 * Uses a curated list of common Vietnamese phrases
 * @returns {string} - Format: "word1 word2"
 */
function getEasyStartPhrase() {
  const { easyWordPairs } = require("../../data/easyWordPairs");

  for (let attempt = 0; attempt < 30; attempt++) {
    const phrase =
      easyWordPairs[Math.floor(Math.random() * easyWordPairs.length)];
    const words = phrase.split(" ");

    if (words.length !== 2) {
      continue;
    }

    if (canConnect(words[0], words[1])) {
      console.log(`✨ Easy start phrase: "${phrase}"`);
      return phrase;
    }
  }

  console.warn("⚠️ No easy phrase validated after 30 attempts, using random");
  return getRandomStartPhrase();
}

module.exports = {
  canConnect,
  canConnectWithAI,
  hasNextWords,
  getNextWords,
  getRandomWord,
  getRandomStartPhrase,
  getEasyStartPhrase,
};
