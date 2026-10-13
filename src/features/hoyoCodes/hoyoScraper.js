// src/features/hoyoCodes/hoyoScraper.js
const axios = require("axios");
const cheerio = require("cheerio");

const { EMOJIS } = require("../../config/ids");

const GAME_CONFIG = {
  genshin: {
    name: "Genshin Impact",
    fandomUrl: "https://genshin-impact.fandom.com/api.php?action=parse&page=Promotional_Code&format=json",
    apiUrl: "https://hoyo-codes.seria.moe/codes?game=genshin",
    redeemBaseUrl: "https://genshin.hoyoverse.com/en/gift?code=",
    color: "#E6A23C",
    icon: `https://cdn.discordapp.com/emojis/${EMOJIS.GENSHIN_LOGO || "1559502726985949184"}.png`,
    banner: "https://fastcdn.hoyoverse.com/mi18n/genshin/banners/ys_pc_1920x1080.jpg",
    streamEn: "https://www.youtube.com/@GenshinImpact",
    streamJp: "https://www.youtube.com/@Genshin_JP",
    hoyolabUid: "1015537",
  },
  hsr: {
    name: "Honkai: Star Rail",
    fandomUrl: "https://honkai-star-rail.fandom.com/api.php?action=parse&page=Redemption_Code&format=json",
    apiUrl: "https://hoyo-codes.seria.moe/codes?game=hkrpg",
    redeemBaseUrl: "https://hsr.hoyoverse.com/gift?code=",
    color: "#9C27B0",
    icon: `https://cdn.discordapp.com/emojis/${EMOJIS.HSR_LOGO || "1559502723148415096"}.png`,
    banner: "https://fastcdn.hoyoverse.com/mi18n/hsr/banners/hkrpg_pc_1920x1080.jpg",
    streamEn: "https://www.youtube.com/@HonkaiStarRail",
    streamJp: "https://www.youtube.com/@Houkaistarrail_JP",
    hoyolabUid: "172534910",
  },
  zzz: {
    name: "Zenless Zone Zero",
    fandomUrl: "https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Redemption_Code&format=json",
    apiUrl: "https://hoyo-codes.seria.moe/codes?game=nap",
    redeemBaseUrl: "https://zenless.hoyoverse.com/redemption?code=",
    color: "#FF9800",
    icon: `https://cdn.discordapp.com/emojis/${EMOJIS.ZZZ_LOGO || "1559502720879173633"}.png`,
    banner: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/07/04/b530c33fb355dbfc65ee3d1bfef0bc94_1064619992036495240.png",
    streamEn: "https://www.youtube.com/@ZenlessZoneZero",
    streamJp: "https://www.youtube.com/@ZZZ_JP",
    hoyolabUid: "219270333",
  },
};

// Cache banner livestream để tối ưu tốc độ và tránh spam API
const bannerCache = new Map();

/**
 * Lấy ảnh banner Special Program / Livestream chính thức từ HoYoLAB
 * @param {string} gameKey
 * @param {boolean} onlyToday - Nếu true, chỉ lấy các bài viết/livestream được đăng từ hôm nay trở đi
 * @returns {Promise<string|null>}
 */
async function fetchLivestreamBanner(gameKey, onlyToday = false) {
  const cached = bannerCache.get(gameKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    if (!onlyToday || cached.isToday) return cached.banner;
  }

  const config = GAME_CONFIG[gameKey];
  if (!config || !config.hoyolabUid) return null;

  try {
    const url = `https://bbs-api-os.hoyolab.com/community/post/wapi/userPost?uid=${config.hoyolabUid}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "x-rpc-client_type": "4",
      },
      timeout: 8000,
    });

    const now = new Date();
    // Mốc thời gian 00:00:00 của ngày hôm nay (epoch seconds)
    const startOfTodaySeconds = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);

    const posts = res.data?.data?.list || [];
    for (const item of posts.slice(0, 10)) {
      const postCreatedAt = item.post?.created_at || 0;
      if (onlyToday && postCreatedAt < startOfTodaySeconds) {
        continue; // Bỏ qua nếu bài viết đăng trước ngày hôm nay
      }

      const subject = item.post?.subject?.toLowerCase() || "";
      if (
        subject.includes("special program") ||
        subject.includes("livestream") ||
        subject.includes("intel report") ||
        (subject.includes("version") && (subject.includes("program") || subject.includes("overview") || subject.includes("preview")))
      ) {
        const cover = item.post?.cover_list?.[0]?.url || item.post?.images?.[0];
        if (cover) {
          bannerCache.set(gameKey, { banner: cover, isToday: postCreatedAt >= startOfTodaySeconds, timestamp: Date.now() });
          return cover;
        }

        if (item.post?.post_id) {
          const detailUrl = `https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=${item.post.post_id}`;
          const detailRes = await axios.get(detailUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "x-rpc-client_type": "4",
            },
            timeout: 8000,
          });
          const p = detailRes.data?.data?.post;
          const detailCover = p?.cover_list?.[0]?.url || p?.image_list?.[0]?.url;
          if (detailCover) {
            bannerCache.set(gameKey, { banner: detailCover, isToday: postCreatedAt >= startOfTodaySeconds, timestamp: Date.now() });
            return detailCover;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Hoyo Scraper] Không thể lấy banner livestream ${gameKey}:`, err.message);
  }

  return null;
}

/**
 * Cào mã code từ API hoyo-codes đã được validate
 */
async function fetchCodesFromApi(gameKey) {
  const config = GAME_CONFIG[gameKey];
  if (!config || !config.apiUrl) return [];
  try {
    const res = await axios.get(config.apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 8000,
    });
    const list = res.data?.codes || [];
    return list
      .filter((c) => c.status === "OK" && c.code)
      .map((c) => ({
        game: gameKey,
        code: c.code.trim().toUpperCase(),
        server: "Tất cả",
        rewardsText: c.rewards ? `• ${c.rewards.replace(/;/g, "\n• ")}` : "• Quà tặng vật phẩm game",
        duration: "Còn hiệu lực",
        redeemUrl: `${config.redeemBaseUrl}${c.code.trim().toUpperCase()}`,
        source: "Hoyo Codes API",
      }));
  } catch (err) {
    return [];
  }
}

/**
 * Cào mã code Genshin Impact từ Fandom Wiki
 */
async function scrapeGenshinCodes() {
  try {
    const res = await axios.get(GAME_CONFIG.genshin.fandomUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const html = res.data?.parse?.text?.["*"];
    if (!html) return [];
    const $ = cheerio.load(html);
    const codes = [];

    // Tìm bảng nằm dưới heading Active Codes
    let activeTable = $("h2, h3").filter((_, el) => $(el).text().toLowerCase().includes("active codes")).first().nextAll("table").first();
    if (!activeTable.length) activeTable = $("table.wikitable").first();

    activeTable.find("tr").each((_, tr) => {
      const codeEl = $(tr).find("td code").first();
      const code = codeEl.text().trim().toUpperCase();
      if (!code) return;

      const tds = $(tr).find("td");
      let server = "Tất cả";
      let rewards = "Primogem & Vật phẩm game";
      let duration = "Còn hiệu lực";

      if (tds.length >= 4) {
        const rawServer = $(tds[1]).text().trim();
        server = (!rawServer || rawServer.toLowerCase() === "all") ? "Tất cả" : rawServer;
        rewards = $(tds[2]).text().trim().replace(/\s+/g, " ");
        duration = $(tds[3]).text().trim().replace(/\s+/g, " ");
      } else if (tds.length >= 3) {
        const rawServer = $(tds[1]).text().trim();
        server = (!rawServer || rawServer.toLowerCase() === "all") ? "Tất cả" : rawServer;
        rewards = $(tds[2]).text().trim().replace(/\s+/g, " ");
      }

      codes.push({
        game: "genshin",
        code,
        server,
        rewardsText: `• ${rewards}`,
        duration: duration || "Còn hiệu lực",
        redeemUrl: `${GAME_CONFIG.genshin.redeemBaseUrl}${code}`,
      });
    });

    return codes;
  } catch (err) {
    console.error("⚠️ [Scraper Genshin] Lỗi cào code:", err.message);
    return [];
  }
}

/**
 * Cào mã code Honkai: Star Rail từ Fandom Wiki
 */
async function scrapeHsrCodes() {
  try {
    const res = await axios.get(GAME_CONFIG.hsr.fandomUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const html = res.data?.parse?.text?.["*"];
    if (!html) return [];
    const $ = cheerio.load(html);
    const codes = [];

    $("table.wikitable tr").each((_, tr) => {
      const codeEl = $(tr).find("td code").first();
      const code = codeEl.text().trim().toUpperCase();
      if (!code) return;

      const tds = $(tr).find("td");
      const durationCell = $(tds[3] || tds[2]);
      const durationText = durationCell.text().replace(/\s+/g, " ").trim();

      // Bỏ qua các code đã hết hạn
      if (durationText.toLowerCase().includes("expired:")) return;

      const rawServer = $(tds[1]).text().trim();
      const server = (!rawServer || rawServer.toLowerCase() === "all") ? "Tất cả" : rawServer;
      const rewards = $(tds[2]).text().trim().replace(/\s+/g, " ") || "Stellar Jade & Vật phẩm game";

      codes.push({
        game: "hsr",
        code,
        server,
        rewardsText: `• ${rewards}`,
        duration: durationText.includes("Valid until:") ? durationText.split("Valid until:")[1].trim() : "Còn hiệu lực",
        redeemUrl: `${GAME_CONFIG.hsr.redeemBaseUrl}${code}`,
      });
    });

    return codes;
  } catch (err) {
    console.error("⚠️ [Scraper HSR] Lỗi cào code:", err.message);
    return [];
  }
}

/**
 * Cào mã code Zenless Zone Zero từ Fandom Wiki
 */
async function scrapeZzzCodes() {
  try {
    const res = await axios.get(GAME_CONFIG.zzz.fandomUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const html = res.data?.parse?.text?.["*"];
    if (!html) return [];
    const $ = cheerio.load(html);
    const codes = [];

    $("table.wikitable tr").each((_, tr) => {
      const codeEl = $(tr).find("td code").first();
      const code = codeEl.text().trim().toUpperCase();
      if (!code) return;

      const tds = $(tr).find("td");
      const rawServer = $(tds[1]).text().trim();
      const server = (!rawServer || rawServer.toLowerCase() === "all") ? "Tất cả" : rawServer;
      const rewards = $(tds[2]).text().trim().replace(/\s+/g, " ") || "Polychrome & Vật phẩm game";

      codes.push({
        game: "zzz",
        code,
        server,
        rewardsText: `• ${rewards}`,
        duration: "Còn hiệu lực",
        redeemUrl: `${GAME_CONFIG.zzz.redeemBaseUrl}${code}`,
      });
    });

    return codes;
  } catch (err) {
    console.error("⚠️ [Scraper ZZZ] Lỗi cào code:", err.message);
    return [];
  }
}

/**
 * Quét toàn bộ mã code của cả 3 game HoYoverse (Hợp nhất API + Fandom Wiki)
 */
async function scrapeAllHoyoCodes() {
  const [apiGenshin, apiHsr, apiZzz, fandomGenshin, fandomHsr, fandomZzz] = await Promise.allSettled([
    fetchCodesFromApi("genshin"),
    fetchCodesFromApi("hsr"),
    fetchCodesFromApi("zzz"),
    scrapeGenshinCodes(),
    scrapeHsrCodes(),
    scrapeZzzCodes(),
  ]);

  const mergeGameCodes = (apiRes, fandomRes) => {
    const map = new Map();
    const apiCodes = apiRes.status === "fulfilled" ? apiRes.value : [];
    const fandomCodes = fandomRes.status === "fulfilled" ? fandomRes.value : [];

    // Nạp Fandom trước
    for (const c of fandomCodes) {
      if (c && c.code) map.set(c.code.toUpperCase(), c);
    }
    // Ghi đè / bổ sung từ API
    for (const c of apiCodes) {
      if (c && c.code) {
        const key = c.code.toUpperCase();
        const existing = map.get(key) || {};
        map.set(key, { ...existing, ...c });
      }
    }
    return Array.from(map.values());
  };

  const results = {
    genshin: mergeGameCodes(apiGenshin, fandomGenshin),
    hsr: mergeGameCodes(apiHsr, fandomHsr),
    zzz: mergeGameCodes(apiZzz, fandomZzz),
  };

  console.log(
    `🔍 [Scraper Hoyo Đa Nguồn] Tổng cộng: ${results.genshin.length} code Genshin, ${results.hsr.length} code HSR, ${results.zzz.length} code ZZZ.`
  );

  return results;
}

module.exports = {
  GAME_CONFIG,
  fetchLivestreamBanner,
  scrapeGenshinCodes,
  scrapeHsrCodes,
  scrapeZzzCodes,
  scrapeAllHoyoCodes,
};
