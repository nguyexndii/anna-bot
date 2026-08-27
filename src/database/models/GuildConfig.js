const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  wordchainEnabled: { type: Boolean, default: false },
  wordchainChannelId: { type: String, default: "" },
  wordchainHintCooldownMs: { type: Number, default: 120000 },
  wordchainAutoPlaySec: { type: Number, default: 60 },
  wordscrambleEnabled: { type: Boolean, default: false },
  wordscrambleChannelId: { type: String, default: "" },
  wordscrambleRoundSec: { type: Number, default: 60 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GuildConfig", guildConfigSchema);
