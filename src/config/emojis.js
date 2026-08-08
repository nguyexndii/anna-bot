// src/config/emojis.js
// Quản lý tập trung toàn bộ Custom Emoji của Application Anna Yanami

module.exports = {
  // Reaction mặc định khi gõ ĐÚNG hoặc SAI
  DEFAULT_REACTIONS: {
    WRONG: "1535702563855536280", // Icon mặc định khi gõ SAI (figurinha3068)
    CORRECT: [
      "1535703901029007400",    // Icon mặc định ĐÚNG lựa chọn 1
      "1535703899275788450",    // Icon mặc định ĐÚNG lựa chọn 2
    ],
  },

  // Reaction cảm xúc ngẫu nhiên (Tỷ lệ 15-20%)
  REACTION_GROUPS: {
    // Trả lời ngu ngu quá
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

    // 💪 Siêu ngầu / Đỉnh cao / Đắc thắng
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
