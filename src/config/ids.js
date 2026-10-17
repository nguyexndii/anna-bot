// src/config/ids.js
// Quản lý tập trung toàn bộ ID (Admin, Channels, Roles) để dễ chỉnh sửa & tái sử dụng

module.exports = {
  // Danh sách ID Admin có quyền quản trị tối cao (!start, reset...)
  ADMIN_IDS: [
    process.env.ADMIN_ID || "875358286487097395", // Duy Ngựa
  ],

  // ID Bot Nhạc chính thức (Anna Music)
  MUSIC_BOT_ID: process.env.MUSIC_BOT_ID || "1542863465335492640",

  // ID các Kênh Discord (Channels)
  CHANNELS: {
    WORDCHAIN: process.env.WORDCHAIN_CHANNEL_ID || "1450065511231520778", // Kênh game Nối Từ
    WORDSCRAMBLE: "1535705241620717720",                                 // Kênh game Sắp Xếp Từ
    RULES: "1450073214620405903",                                        // Kênh Luật chơi / Hướng dẫn
    WUWA_CODES: process.env.WUWA_CHANNEL_ID || "1528768068581457930",    // Kênh thông báo Code WuWa chính thức
    HOYO_CODES: process.env.HOYO_CODES_CHANNEL_ID || "1528768068581457930", // Kênh thông báo Code HoYoverse chính thức
    ENDFIELD_CODES: process.env.ENDFIELD_CODES_CHANNEL_ID || "1528768068581457930", // Kênh thông báo Code Endfield chính thức
    ERROR_LOG: process.env.ERROR_LOG_CHANNEL_ID || "1547449482835394640", // Kênh log lỗi hệ thống & cảnh báo (a_log-error)
  },

  // Emoji IDs (Application Emojis)
  EMOJIS: {
    WUWA_ICON: "1536322393411424286",
    GENSHIN_LOGO: "1559502726985949184",
    GENSHIN_PRIMO: "1559502712343896205",
    HSR_LOGO: "1559502723148415096",
    HSR_JADE: "1559502715564982292",
    ZZZ_LOGO: "1559502720879173633",
    ZZZ_POLY: "1559502718584750121",
    ENDFIELD_LOGO: "1559559318309969970",
    ENDFIELD_OROBERYL: "1559559314652528770",
  },

  // ID các Vai trò/Chức vụ (Roles)
  ROLES: {
    WUWA_ROLE: process.env.WUWA_ROLE_ID || "1528768731873017896", // Role WuWa (🍚Diện Nhận Trợ Cấp)
    HOYO_ROLE: process.env.HOYO_ROLE_ID || "1454449657588748401", // Role Hoyo (Hoyo Buddy)
    ENDFIELD_ROLE: process.env.ENDFIELD_ROLE_ID || "1528768731873017896", // Role Endfield (🍚Diện Nhận Trợ Cấp)
  },
};
