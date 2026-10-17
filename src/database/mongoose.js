// src/database/mongoose.js
const mongoose = require("mongoose");
const { recordSuccess, recordError } = require("../utils/healthTracker");

/**
 * Connect to MongoDB Atlas Database
 */
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("ℹ️ MONGODB_URI chưa được cài trong .env -> Sử dụng file JSON làm Backend dự phòng.");
    recordError("mongodb", "MONGODB_URI chưa được cấu hình");
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("🍃 Đã kết nối thành công tới MongoDB Atlas Database!");
    recordSuccess("mongodb");
    return true;
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB Atlas:", err.message);
    console.log("⚠️ Chuyển sang sử dụng file JSON làm Backend dự phòng.");
    recordError("mongodb", err.message);
    return false;
  }
}

module.exports = { connectDatabase };
