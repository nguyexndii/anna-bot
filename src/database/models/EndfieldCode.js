// src/database/models/EndfieldCode.js
const mongoose = require("mongoose");

const endfieldCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    rewardsText: {
      type: String,
      default: "• Chưa có thông tin phần thưởng",
    },
    duration: {
      type: String,
      default: "Còn hiệu lực",
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

module.exports = mongoose.model("EndfieldCode", endfieldCodeSchema);
