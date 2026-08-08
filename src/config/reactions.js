// src/config/reactions.js
// Quản lý tập trung toàn bộ Reaction Custom Emoji để tái sử dụng cho tất cả các trò chơi & tính năng sau này

module.exports = {
  // Tỷ lệ xuất hiện reaction cảm xúc ngẫu nhiên (20%)
  EMOTION_CHANCE: 0.20,

  // Reaction Mặc định khi gõ ĐÚNG hoặc SAI
  DEFAULT_REACTIONS: {
    WRONG: "1535702563855536280", // Icon mặc định khi gõ SAI (figurinha3068)
    CORRECT: [
      "1535703901029007400",    // Icon mặc định ĐÚNG 1
      "1535703899275788450",    // Icon mặc định ĐÚNG 2
    ],
  },

  // Phân loại các Nhóm Reaction Cảm Xúc để tái sử dụng
  REACTION_GROUPS: {
    // 🔨 Trả lời ngu ngu / Sai vần
    SUPER_DUMB: ["1535702546478530610"], // bonk

    // 🗿 Bruh / Bó tay / Cạn lời
    BRUH: [
      "1535702548286275684", // bruh
      "1535702553457725440", // dilucspeechless
      "1535702571430318181", // noreaction
      "1535702568960004137", // kuruunamused
    ],

    // 🤡 Hề hước / Chơi ngu
    CLOWN: [
      "1535702550857384047", // clown
      "1535702573414354954", // pepeclownwave
      "1535702556465041551", // dumb
    ],

    // 🤨 Ủa / Bất ngờ
    SURPRISED: [
      "1535695600601931797", // 668900wellthen
      "1535702583543463936", // unamusedchamber3
    ],

    // 😭 Cay đắng / Khóc thét
    CRY: [
      "1535702585670111353", // v17cryingking
      "1535702544444162079", // aquasob
      "1535702536500289536", // 192akcry
      "1535702532192469052", // 1crywaifu65
    ],

    // 💀 Xỉu / Gục ngã
    SKULL: [
      "1535702578908631080", // skullstatusicon
    ],

    // 💪 Siêu ngầu / Đắc thắng
    COOL: [
      "1535695595883462716", // 249299strongpepe
      "1535702581492318359", // tomhehe
      "1535702566468452362", // kirbyjam94
      "1535697932723167364", // Anime
    ],

    // 🤐 Bớt mồm / Im lặng
    SHUT: [
      "1535694953563431022", // 861449shutseagullmeme
      "1535695602699210953", // 893425gooby
    ],

    // 😺 Chill
    CHILL: [
      "1535695598764822598", // 400561drollingcat
      "1535702561590480998", // emoji
    ],
  },
};
