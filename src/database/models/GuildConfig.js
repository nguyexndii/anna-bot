const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  wordchainEnabled: { type: Boolean, default: false },
  wordchainChannelId: { type: String, default: "" },
  wordchainWebhookUrl: { type: String, default: "" },
  wordchainHintCooldownMs: { type: Number, default: 120000 },
  wordchainAutoPlaySec: { type: Number, default: 60 },
  wordscrambleEnabled: { type: Boolean, default: false },
  wordscrambleChannelId: { type: String, default: "" },
  wordscrambleWebhookUrl: { type: String, default: "" },
  wordscrambleRoundSec: { type: Number, default: 60 },
  wuwaEnabled: { type: Boolean, default: false },
  wuwaChannelId: { type: String, default: "" },
  wuwaWebhookUrl: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GuildConfig", guildConfigSchema);
