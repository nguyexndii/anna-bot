// src/features/endfieldCodes/endfieldScraper.js
const axios = require("axios");

/**
 * Danh sách Giftcode mặc định / ban đầu của Arknights: Endfield
 */
const DEFAULT_ENDFIELD_CODES = [
  {
    code: "ENDFIELDGIFT",
    rewardsText: "• 150 Oroberyl\n• 10,000 T-Creds\n• 20 Intermediate Combat Records\n• 20 Arms INSP Kits",
    duration: "Còn hiệu lực",
    source: "Official Launch Gift",
  },
  {
    code: "AKENDFIELDSUB",
    rewardsText: "• 100 Oroberyl",
    duration: "Còn hiệu lực",
    source: "Social Milestone",
  },
  {
    code: "ENDFIELDRENEW",
    rewardsText: "• 71,600 T-Creds\n• 1 Safety Helmet Sticker",
    duration: "Còn hiệu lực",
    source: "Community Event",
  },
  {
    code: "ENDFIELD4PC",
    rewardsText: "• 13,000 T-Creds\n• 2 Advanced Combat Records\n• 2 Arms INSP Kits",
    duration: "Còn hiệu lực (PC Client)",
    source: "PC Exclusive",
  },
];

/**
 * Thu thập giftcode Arknights: Endfield từ các nguồn cộng đồng
 * @returns {Promise<Array>}
 */
async function scrapeEndfieldCodes() {
  try {
    // Có thể bổ sung scraping từ Reddit r/Endfield hoặc webfeed
    const res = await axios.get("https://www.reddit.com/r/Endfield/new.json?limit=25", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 8000,
    }).catch(() => null);

    const mergedMap = new Map();

    // Nạp code mặc định trước
    for (const c of DEFAULT_ENDFIELD_CODES) {
      mergedMap.set(c.code.toUpperCase(), c);
    }

    if (res && res.data?.data?.children) {
      const posts = res.data.data.children;
      for (const p of posts) {
        const title = p.data?.title || "";
        const codeMatch = title.match(/\b[A-Z0-9]{6,16}\b/);
        if (codeMatch && (title.toLowerCase().includes("code") || title.toLowerCase().includes("oroberyl") || title.toLowerCase().includes("redeem"))) {
          const code = codeMatch[0];
          if (!["ENDFIELD", "REDDIT", "TWITTER", "DISCORD"].includes(code) && !mergedMap.has(code)) {
            mergedMap.set(code, {
              code,
              rewardsText: "• Oroberyl & Vật phẩm game (Nguồn cộng đồng)",
              duration: "Còn hiệu lực",
              source: "Reddit Community",
            });
          }
        }
      }
    }

    return Array.from(mergedMap.values());
  } catch (err) {
    console.warn("⚠️ [Endfield Scraper] Lỗi khi cào code:", err.message);
    return DEFAULT_ENDFIELD_CODES;
  }
}

/**
 * Lấy thông tin Livestream Special Program gần nhất của Endfield
 */
async function fetchEndfieldLivestreamInfo() {
  return {
    version: "1.6",
    title: "Sanctuary of Ink - Special Program",
    bannerUrl: "https://c4.wallpaperflare.com/wallpaper/844/563/830/arknights-endfield-game-cg-hd-wallpaper-preview.jpg",
    streamYoutube: "https://www.youtube.com/@ArknightsEndfield",
    officialPortal: "https://endfield.gryphline.com/",
    time: "Phát sóng trước thềm cập nhật Bản 1.6",
    codes: [
      {
        code: "RETURNOFALL",
        rewardsText: "• 150 Oroberyl\n• 10,000 T-Creds",
        duration: "Đã hết hạn",
      },
      {
        code: "ALLFIELD",
        rewardsText: "• 150 Oroberyl\n• 5 Intermediate Combat Records",
        duration: "Đã hết hạn",
      },
      {
        code: "SANCTUARYINK",
        rewardsText: "• 150 Oroberyl\n• 1 Advanced Combat Record",
        duration: "Đã hết hạn",
      },
    ],
  };
}

module.exports = {
  scrapeEndfieldCodes,
  fetchEndfieldLivestreamInfo,
  DEFAULT_ENDFIELD_CODES,
};
