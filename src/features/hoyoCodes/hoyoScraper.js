// src/features/hoyoCodes/hoyoScraper.js
const axios = require("axios");
const cheerio = require("cheerio");

const GAME_CONFIG = {
  genshin: {
    name: "Genshin Impact",
    fandomUrl: "https://genshin-impact.fandom.com/api.php?action=parse&page=Promotional_Code&format=json",
    redeemBaseUrl: "https://genshin.hoyoverse.com/en/gift?code=",
    color: "#E6A23C",
    icon: "https://static.wikia.nocookie.net/gensin-impact/images/d/d4/Item_Primogem.png/revision/latest/scale-to-width-down/150",
  },
  hsr: {
    name: "Honkai: Star Rail",
    fandomUrl: "https://honkai-star-rail.fandom.com/api.php?action=parse&page=Redemption_Code&format=json",
    redeemBaseUrl: "https://hsr.hoyoverse.com/gift?code=",
    color: "#9C27B0",
    icon: "https://static.wikia.nocookie.net/houkai-star-rail/images/c/ca/Item_Stellar_Jade.png/revision/latest/scale-to-width-down/150",
  },
  zzz: {
    name: "Zenless Zone Zero",
    fandomUrl: "https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Redemption_Code&format=json",
    redeemBaseUrl: "https://zenless.hoyoverse.com/redemption?code=",
    color: "#FF9800",
    icon: "https://static.wikia.nocookie.net/zenless-zone-zero/images/3/30/Item_Polychrome.png/revision/latest/scale-to-width-down/150",
  },
};

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
      let server = "All";
      let rewards = "Primogem & Vật phẩm game";
      let duration = "Còn hiệu lực";

      if (tds.length >= 4) {
        server = $(tds[1]).text().trim() || "All";
        rewards = $(tds[2]).text().trim().replace(/\s+/g, " ");
        duration = $(tds[3]).text().trim().replace(/\s+/g, " ");
      } else if (tds.length >= 3) {
        server = $(tds[1]).text().trim() || "All";
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

      const server = $(tds[1]).text().trim() || "All";
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
      const server = $(tds[1]).text().trim() || "All";
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
 * Quét toàn bộ mã code của cả 3 game HoYoverse
 */
async function scrapeAllHoyoCodes() {
  const [genshin, hsr, zzz] = await Promise.allSettled([
    scrapeGenshinCodes(),
    scrapeHsrCodes(),
    scrapeZzzCodes(),
  ]);

  const results = {
    genshin: genshin.status === "fulfilled" ? genshin.value : [],
    hsr: hsr.status === "fulfilled" ? hsr.value : [],
    zzz: zzz.status === "fulfilled" ? zzz.value : [],
  };

  console.log(
    `🔍 [Scraper Hoyo] Đã lấy: ${results.genshin.length} code Genshin, ${results.hsr.length} code HSR, ${results.zzz.length} code ZZZ.`
  );

  return results;
}

module.exports = {
  GAME_CONFIG,
  scrapeGenshinCodes,
  scrapeHsrCodes,
  scrapeZzzCodes,
  scrapeAllHoyoCodes,
};
