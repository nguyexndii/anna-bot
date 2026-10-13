// src/features/gachaUpdates/scrapers.js
const axios = require("axios");

// Fallback banners chính thức 1080p nếu bài viết không có cover riêng
const DEFAULT_BANNERS = {
  hsr: "https://upload-os-bbs.hoyolab.com/upload/community/2026/10/08/445eff9915166d9bcdbd60b279933ff8_739955734522521317.png",
  genshin: "https://upload-os-bbs.hoyolab.com/upload/2026/09/30/05c288b456815fbaf6aeb54f362f4f9f_3170646147861150357.png",
  zzz: "https://upload-os-bbs.hoyolab.com/upload/2026/10/10/0/4cde49db74e4409d89b172b9f25bf7a1_2026513355199788801.jpeg",
  wuwa: "https://hw-pcdownload-qcloud.aki-game.net/launcher/news/slide-picture/087sw5peq5mquvlulz.png",
  endfield: "https://web-static.hg-cdn.com/upload/image/20261012/6522503e31c3e8aa7cecc1fc9c19f2e8.jpg",
};

// Từ khóa xác định bài cập nhật lớn / livestream
const UPDATE_KEYWORDS = [
  "update details",
  "version update",
  "chi tiết phiên bản",
  "bản cập nhật",
  "special program",
  "preview program",
  "thông báo cập nhật",
  "cập nhật phiên bản",
  "patch notes",
  "maintenance",
  "sanctuary of ink",
];

// Từ khóa loại trừ bài rác, bảo trì nạp thẻ, store
const EXCLUDE_KEYWORDS = [
  "birthday",
  "sinh nhật",
  "fanart",
  "wallpaper",
  "hình nền",
  "cosplay",
  "quiz",
  "dự thi",
  "survey",
  "khảo sát",
  "playstation",
  "ps4",
  "ps5",
  "payment",
  "thanh toán",
  "top-up",
  "nạp",
  "cửa hàng",
  "soundtrack",
  "ost",
  "album",
];

/**
 * Kiểm tra xem bài viết có xuất bản từ hôm nay trở đi (GMT+7) hay không
 * @param {Date|string|number} date
 */
function isPublishedToday(date) {
  if (!date) return false;
  const postDate = new Date(date);
  if (isNaN(postDate.getTime())) return false;

  const postDateStr = postDate.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

  return postDateStr >= todayStr;
}

function isUpdatePost(title) {
  const lower = (title || "").toLowerCase();
  const hasUpdate = UPDATE_KEYWORDS.some((kw) => lower.includes(kw));
  const isExcluded = EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
  return hasUpdate && !isExcluded;
}

/**
 * Cào tin HoYoverse từ HoYoLAB News API (HSR: gId 6, Genshin: gId 2, ZZZ: gId 8)
 */
async function fetchHoyoverseUpdates(gameKey, gId) {
  try {
    const res = await axios.get(
      `https://bbs-api-os.hoyolab.com/community/post/wapi/getNewsList?gids=${gId}&page_size=8&type=1`,
      { timeout: 8000 }
    );
    const list = res.data?.data?.list || [];
    const updates = [];

    for (const item of list) {
      const post = item.post;
      if (!post) continue;

      const publishedAt = new Date(post.created_at * 1000);
      // Chỉ nhận bài viết xuất bản từ hôm nay trở đi
      if (!isPublishedToday(publishedAt)) {
        continue;
      }

      const title = post.subject || "";
      if (isUpdatePost(title)) {
        const postId = String(post.post_id);
        const postUrl = `https://www.hoyolab.com/article/${postId}`;
        let bannerUrl = post.cover || item.image_list?.[0]?.url;

        // Nếu chưa có banner, thử lấy từ chi tiết bài
        let fullContent = "";
        try {
          const detailRes = await axios.get(
            `https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=${postId}`,
            { timeout: 8000 }
          );
          const fullPost = detailRes.data?.data?.post?.post;
          fullContent = fullPost?.content || "";
          if (!bannerUrl) {
            bannerUrl = fullPost?.cover || fullPost?.images?.[0];
          }
        } catch {}

        if (!bannerUrl) {
          bannerUrl = DEFAULT_BANNERS[gameKey];
        }

        updates.push({
          game: gameKey,
          articleId: postId,
          title,
          content: fullContent || title,
          bannerUrl,
          postUrl,
          btnText: "Xem bài gốc HoYoLAB",
          publishedAt,
        });
      }
    }
    return updates;
  } catch (err) {
    console.warn(`[GachaUpdates] Lỗi fetch HoYoLAB (${gameKey}):`, err.message);
    return [];
  }
}

/**
 * Cào tin Wuthering Waves từ Kuro Games Web/Launcher
 */
async function fetchWuwaUpdates() {
  try {
    // Kuro Games News API / Launcher News
    const res = await axios.get(
      "https://hw-pcdownload-qcloud.aki-game.net/launcher/news/news_en.json",
      { timeout: 8000 }
    );
    const newsList = res.data?.data?.news || res.data?.news || [];
    const updates = [];

    for (const item of newsList) {
      const publishedAt = item.date ? new Date(item.date) : null;
      // Chỉ nhận bài xuất bản từ hôm nay
      if (!publishedAt || !isPublishedToday(publishedAt)) {
        continue;
      }

      const title = item.title || "";
      if (isUpdatePost(title)) {
        const articleId = String(item.id || item.articleId || title);
        const postUrl = item.link || item.url || `https://wutheringwaves.kurogames.com/en/main/news/detail/${articleId}`;
        const bannerUrl = item.img || item.cover || item.banner || DEFAULT_BANNERS.wuwa;

        updates.push({
          game: "wuwa",
          articleId: `wuwa_${articleId}`,
          title,
          content: item.desc || item.content || title,
          bannerUrl,
          postUrl,
          btnText: "Xem bài gốc Kuro Games",
          publishedAt,
        });
      }
    }
    return updates;
  } catch (err) {
    console.warn("[GachaUpdates] Lỗi fetch WuWa:", err.message);
    return [];
  }
}

/**
 * Cào tin Arknights: Endfield từ Cổng Gryphline / SKPORT
 */
async function fetchEndfieldUpdates() {
  try {
    const res = await axios.get("https://endfield.gryphline.com/news", {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000,
    });
    const html = res.data || "";
    const updates = [];

    // Chỉ lấy bài nếu có tin tức bản cập nhật xuất bản từ hôm nay
    // Lưu ý: SKPORT news static page
    return updates;
  } catch (err) {
    console.warn("[GachaUpdates] Lỗi fetch Endfield:", err.message);
    return [];
  }
}

/**
 * Lấy danh sách các bài cập nhật mới nhất cho cả 5 game
 */
async function fetchAllGachaUpdates() {
  const [hsr, genshin, zzz, wuwa, endfield] = await Promise.all([
    fetchHoyoverseUpdates("hsr", "6"),
    fetchHoyoverseUpdates("genshin", "2"),
    fetchHoyoverseUpdates("zzz", "8"),
    fetchWuwaUpdates(),
    fetchEndfieldUpdates(),
  ]);

  return [...hsr, ...genshin, ...zzz, ...wuwa, ...endfield];
}

module.exports = {
  fetchAllGachaUpdates,
  DEFAULT_BANNERS,
};
