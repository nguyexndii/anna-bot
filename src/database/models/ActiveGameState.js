// src/database/models/ActiveGameState.js
const mongoose = require("mongoose");

const activeGameStateSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true }, // "wordchain" or "wordscramble"
    active: { type: Boolean, default: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActiveGameState", activeGameStateSchema);
