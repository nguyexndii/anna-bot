// src/features/wuwaCodes/wuwaScraper.js
const axios = require("axios");
const cheerio = require("cheerio");

const FANDOM_API_URL = "https://wutheringwaves.fandom.com/api.php?action=parse&page=Redemption_Code&format=json";
const REDDIT_BACKUP_URL = "https://www.reddit.com/r/wutheringwavescodes/new.json?limit=20";
const REDDIT_MAIN_URL = "https://www.reddit.com/r/WutheringWaves/new.json?limit=25";

/**
 * Primary Scraper: Fandom Wiki MediaWiki API
 */
async function scrapeFandomWiki() {
  try {
    const response = await axios.get(FANDOM_API_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
      },
      timeout: 12000,
    });

    const htmlText = response.data?.parse?.text?.["*"];
    if (!htmlText) return [];

    const $ = cheerio.load(htmlText);
    const codesList = [];

    let activeTable = $("#tpt-acticodes");
    if (!activeTable.length) {
      activeTable = $("h3 #Active").closest("h3").nextAll("table").first();
    }
    if (!activeTable.length) {
      activeTable = $("table.wikitable").first();
    }

    activeTable.find("tr").each((_, element) => {
      const codeElement = $(element).find("td code").first();
      if (!codeElement.length) return;

      const codeStr = codeElement.text().trim();
      if (!codeStr) return;

      const cells = $(element).find("td");
      let serverStr = "All";
      let rewardsCell = null;
      let durationCell = null;

      if (cells.length >= 5) {
        serverStr = $(cells[2]).text().trim() || "All";
        rewardsCell = $(cells[3]);
        durationCell = $(cells[4]);
      } else if (cells.length >= 4) {
        serverStr = $(cells[1]).text().trim() || "All";
        rewardsCell = $(cells[2]);
        durationCell = $(cells[3]);
      }

      const rewards = [];
      const rewardLines = [];

      if (rewardsCell && rewardsCell.length) {
        const containers = rewardsCell.find(".card-container");
        if (containers.length > 0) {
          containers.each((_, card) => {
            const img = $(card).find("img");
            let itemName = img.attr("alt") || $(card).find("a").attr("title") || "";
            itemName = itemName.replace(/^Item\s+/i, "").trim();

            const quantity = $(card).find(".card-text").text().trim() || "1";
            let iconUrl = img.attr("data-src") || img.attr("src") || "";
            if (iconUrl.startsWith("data:image")) {
              iconUrl = img.attr("data-src") || "";
            }

            if (itemName) {
              rewards.push({ name: itemName, quantity, icon: iconUrl });
              rewardLines.push(`• **${itemName}** x${quantity}`);
            }
          });
        } else {
          const textContent = rewardsCell.text().trim();
          if (textContent) {
            rewardLines.push(`• ${textContent}`);
            rewards.push({ name: textContent, quantity: "1", icon: "" });
          }
        }
      }

      let durationStr = "Valid until: Unknown";
      if (durationCell && durationCell.length) {
        durationCell.find("br").replaceWith(" | ");
        durationStr = durationCell.text().trim().replace(/\s+/g, " ");
      }

      codesList.push({
        code: codeStr,
        server: serverStr,
        rewards,
        rewardsText: rewardLines.join("\n") || "• Không rõ phần thưởng",
        duration: durationStr,
        source: "Fandom Wiki",
      });
    });

    return codesList;
  } catch (err) {
    console.error("⚠️ [Scraper] Fandom Wiki primary scraper error:", err.message);
    return [];
  }
}

const { ADMIN_ID } = require("../../config/env");
const { sendAdminDM } = require("../../utils/statusNotifier");

let currentWwplusUrl = "https://wwplus.net/tong-hop-code-wuthering-waves-moi-nhat/";
let lastWwplusAlertTs = 0;

/**
 * Tự động quét trang chủ wwplus.net để tìm link danh sách code mới nhất nếu URL cũ bị đổi
 */
async function discoverWwplusCodeUrl() {
  try {
    const res = await axios.get("https://wwplus.net/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 8000,
    });
    if (!res.data) return null;
    const $ = cheerio.load(res.data);
    let foundUrl = null;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim().toLowerCase();
      if (href && (href.includes("code") || text.includes("code game") || text.includes("giftcode"))) {
        if (!foundUrl) foundUrl = href;
      }
    });

    if (foundUrl && !foundUrl.startsWith("http")) {
      foundUrl = new URL(foundUrl, "https://wwplus.net/").toString();
    }
    return foundUrl;
  } catch (err) {
    return null;
  }
}

/**
 * Gửi tin nhắn DM cảnh báo cho Admin khi WWPlus bị lỗi hoặc đổi URL mà bot không tự tìm lại được
 */
async function notifyAdminScraperFailure(client, errorDetail) {
  if (!client || !ADMIN_ID) return;
  const now = Date.now();
  // Giới hạn tần suất: Chỉ gửi DM 1 lần mỗi 6 tiếng nếu lỗi tiếp diễn
  if (now - lastWwplusAlertTs < 6 * 60 * 60 * 1000) return;
  lastWwplusAlertTs = now;

  await sendAdminDM(client, ADMIN_ID, {
    title: "⚠️ CẢNH BÁO: NGUỒN CÀO CODE WWPLUS BỊ LỖI",
    description: "Bot không thể lấy dữ liệu Giftcode từ **WWPlus.net**. Website có thể đã đổi URL hoặc thay đổi cấu trúc bảng.\n\n" +
      `📌 **Chi tiết lỗi:** \`${errorDetail}\`\n` +
      `🔗 **URL đang cào:** ${currentWwplusUrl}\n` +
      "💡 **Hành động:** Bạn vui lòng vào kiểm tra lại `wwplus.net` xem đường dẫn bài viết code mới để cập nhật nhé.",
    color: "#FFA500",
  });
}

/**
 * Bóc tách code từ một URL cụ thể của WWPlus
 */
async function scrapeWwplusFromUrl(targetUrl) {
  const response = await axios.get(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 10000,
  });

  if (!response.data) return [];
  const $ = cheerio.load(response.data);
  const codesList = [];

  $("table.editor-table tr").each((_, tr) => {
    const btn = $(tr).find("button.editor-giftcode-button");
    const codeStr = (btn.attr("data-gift-code") || btn.text()).trim().toUpperCase();
    if (!codeStr) return;

    const tds = $(tr).find("td");
    const rewardStr = $(tds[1]).text().trim() || "Astrite & Vật phẩm game";
    const durationStr = $(tds[2]).text().trim() || "Còn hiệu lực";

    codesList.push({
      code: codeStr,
      server: "All",
      rewards: [{ name: rewardStr, quantity: "1", icon: "" }],
      rewardsText: `• **${rewardStr}**`,
      duration: durationStr,
      source: "WWPlus.net",
    });
  });

  return codesList;
}

/**
 * Nguồn 1: WWPlus.net (Có cơ chế Auto-Discovery URL và cảnh báo DM Admin)
 */
async function scrapeWwplus(client = null) {
  let codes = [];
  let errorMsg = "";

  // 1. Thử URL hiện tại
  try {
    codes = await scrapeWwplusFromUrl(currentWwplusUrl);
  } catch (err) {
    errorMsg = err.message;
  }

  // 2. Nếu URL hiện tại không có code hoặc bị lỗi (VD đổi sang slug tháng mới):
  // Tự động vào trang chủ wwplus.net để quét menu tìm URL mới
  if (!codes || codes.length === 0) {
    console.log("⚠️ [Scraper] URL hiện tại của WWPlus không có code hoặc đổi link, đang tự động quét trang chủ...");
    const discoveredUrl = await discoverWwplusCodeUrl();

    if (discoveredUrl && discoveredUrl !== currentWwplusUrl) {
      console.log(`🧭 [Scraper] Đã tự động phát hiện URL mới của WWPlus: ${discoveredUrl}`);
      try {
        codes = await scrapeWwplusFromUrl(discoveredUrl);
        if (codes && codes.length > 0) {
          currentWwplusUrl = discoveredUrl;
        }
      } catch (discErr) {
        errorMsg = discErr.message;
      }
    }
  }

  // 3. Nếu vẫn không thể lấy được code (cả URL hiện tại lẫn trang chủ đều thất bại)
  if (!codes || codes.length === 0) {
    console.error("❌ [Scraper] Không thể cào dữ liệu từ WWPlus.net:", errorMsg || "Không tìm thấy bảng code");
    if (client) {
      await notifyAdminScraperFailure(client, errorMsg || "Không tìm thấy bảng mã code trên trang");
    }
    return [];
  }

  // Cào thành công: Reset cooldown cảnh báo
  lastWwplusAlertTs = 0;
  return codes;
}

/**
 * Backup: Reddit Community Feed
 */
async function scrapeRedditBackup() {
  try {
    const backupCodes = [];
    const urls = [REDDIT_BACKUP_URL, REDDIT_MAIN_URL];

    for (const url of urls) {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        timeout: 8000,
      }).catch(() => null);

      if (!response || !response.data) continue;

      const posts = response.data?.data?.children || [];
      for (const post of posts) {
        const title = post.data?.title || "";
        const codeMatch = title.match(/\b[A-Z0-9]{6,15}\b/);
        if (codeMatch && (title.toLowerCase().includes("code") || title.toLowerCase().includes("astrite") || title.toLowerCase().includes("redeem"))) {
          const code = codeMatch[0];
          if (!["WUTHERINGWAVES", "REDDIT", "SERVER", "TWITTER"].includes(code)) {
            backupCodes.push({
              code,
              server: "All",
              rewards: [],
              rewardsText: "• Astrite & Vật phẩm game (Nguồn Reddit)",
              duration: "Valid until: N/A (Reddit Feed)",
              source: "Reddit Community",
            });
          }
        }
      }
    }
    return backupCodes;
  } catch (err) {
    return [];
  }
}

/**
 * Main Scrape function with Multi-Source Aggregation (WWPlus.net + Fandom Wiki)
 */
async function scrapeWuwaCodes(client = null) {
  const results = await Promise.allSettled([
    scrapeWwplus(client),
    scrapeFandomWiki(),
  ]);

  const wwplusCodes = results[0].status === "fulfilled" ? results[0].value : [];
  const fandomCodes = results[1].status === "fulfilled" ? results[1].value : [];

  console.log(`🔍 [Scraper WuWa] Thu thập được ${wwplusCodes.length} code từ WWPlus.net, ${fandomCodes.length} code từ Fandom Wiki.`);

  const mergedMap = new Map();

  // Nạp từ Fandom Wiki
  for (const c of fandomCodes) {
    if (c.code) mergedMap.set(c.code.toUpperCase(), c);
  }

  // Nạp từ WWPlus.net (hợp nhất và bổ sung các code mới nhất)
  for (const c of wwplusCodes) {
    const codeKey = c.code.toUpperCase();
    if (mergedMap.has(codeKey)) {
      const existing = mergedMap.get(codeKey);
      mergedMap.set(codeKey, {
        ...existing,
        ...c,
        rewards: (existing.rewards && existing.rewards.length > 0) ? existing.rewards : c.rewards,
        rewardsText: (existing.rewardsText && existing.rewardsText.includes("• **")) ? existing.rewardsText : c.rewardsText,
      });
    } else {
      mergedMap.set(codeKey, c);
    }
  }

  // Fallback qua Reddit nếu cả 2 nguồn trên đều không có dữ liệu
  if (mergedMap.size === 0) {
    console.log("⚠️ [Scraper WuWa] Cả 2 nguồn chính đều không có dữ liệu, thử nguồn dự phòng Reddit...");
    const redditCodes = await scrapeRedditBackup();
    for (const c of redditCodes) {
      if (c.code) mergedMap.set(c.code.toUpperCase(), c);
    }
  }

  const mergedCodes = Array.from(mergedMap.values());
  console.log(`✨ [Scraper WuWa] Tổng cộng sau khi hợp nhất: ${mergedCodes.length} code.`);
  return mergedCodes;
}

module.exports = { scrapeWuwaCodes, scrapeWwplus, scrapeFandomWiki, discoverWwplusCodeUrl };
