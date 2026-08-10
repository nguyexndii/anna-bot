// src/config/ids.js
// Quản lý tập trung toàn bộ ID (Admin, Channels, Roles) để dễ chỉnh sửa & tái sử dụng

module.exports = {
  // Danh sách ID Admin có quyền quản trị tối cao (!start, reset...)
  ADMIN_IDS: [
    process.env.ADMIN_ID || "875358286487097395", // Duy Ngựa
  ],

  // ID các Kênh Discord (Channels)
  CHANNELS: {
    WORDCHAIN: process.env.WORDCHAIN_CHANNEL_ID || "1450065511231520778", // Kênh game Nối Từ
    WORDSCRAMBLE: "1535705241620717720",                                 // Kênh game Sắp Xếp Từ
    RULES: "1450073214620405903",                                        // Kênh Luật chơi / Hướng dẫn
    GENERAL_CHAT: "1389842864594227270",                                 // Kênh chat chung
    IMAGE_UPLOAD: "1389842916725231626",                                 // Kênh gửi ảnh
    AI_CHAT: ["1490235696118497280", "1447095306079698984"],             // Các kênh chat AI
    WUWA_CODES: process.env.WUWA_CHANNEL_ID || "1528768068581457930",    // Kênh thông báo Code WuWa chính thức
  },

  // Emoji IDs
  EMOJIS: {
    WUWA_ICON: "1536322393411424286",
  },

  // ID các Vai trò/Chức vụ (Roles)
  ROLES: {
    TEMP_ROLE: "1389839793264787476",       // Role Tạm trú
    PERMANENT_ROLE: "1389837526742863913",  // Role Thường trú
    WUWA_ROLE: process.env.WUWA_ROLE_ID || "1528768731873017896", // Role WuWa
  },
};
