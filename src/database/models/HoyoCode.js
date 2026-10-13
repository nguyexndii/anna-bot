// src/database/models/HoyoCode.js
const mongoose = require("mongoose");

const hoyoCodeSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz"],
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    server: {
      type: String,
      default: "All",
    },
    rewardsText: {
      type: String,
      default: "• Chưa rõ phần thưởng",
    },
    duration: {
      type: String,
      default: "Còn hiệu lực",
    },
    redeemUrl: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Đảm bảo không trùng cặp (game, code)
hoyoCodeSchema.index({ game: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("HoyoCode", hoyoCodeSchema);
