// src/database/models/GachaForumPost.js
const mongoose = require("mongoose");

const gachaForumPostSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["hsr", "genshin", "zzz", "wuwa", "endfield"],
      index: true,
    },
    articleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    postUrl: {
      type: String,
      default: "",
    },
    bannerUrl: {
      type: String,
      default: "",
    },
    threadId: {
      type: String,
      default: "",
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GachaForumPost", gachaForumPostSchema);
