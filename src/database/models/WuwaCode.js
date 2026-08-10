// src/database/models/WuwaCode.js
const mongoose = require("mongoose");

const wuwaCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    server: { type: String, default: "All" },
    rewards: [
      {
        name: { type: String, required: true },
        quantity: { type: String, required: true },
        icon: { type: String, default: "" },
      },
    ],
    rewardsText: { type: String, default: "" },
    duration: { type: String, default: "Valid until: Unknown" },
    isActive: { type: Boolean, default: true },
    notified: { type: Boolean, default: false },
    notifiedExpiringSoon: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WuwaCode", wuwaCodeSchema);
