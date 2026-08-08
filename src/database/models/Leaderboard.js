// src/database/models/Leaderboard.js
const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema(
  {
    game: { type: String, required: true }, // "wordchain" or "wordscramble"
    userId: { type: String, required: true },
    username: { type: String, required: true },
    wins: { type: Number, default: 0 },
  },
  { timestamps: true }
);

leaderboardSchema.index({ game: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
