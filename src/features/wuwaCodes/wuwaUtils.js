// src/features/wuwaCodes/wuwaUtils.js
const axios = require("axios");
const { GEMINI_API_KEYS, GEMINI_MODEL_URL } = require("../../config/env");

const MONTH_MAP = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12"
};

/**
 * Parse Expiry Date from duration string
 * Supports both Wiki English format and Vietnamese manual format (DD/MM/YYYY)
 * @param {string} durationStr
 * @returns {Date|null}
 */
function parseExpiryDate(durationStr) {
  if (!durationStr) return null;

  // Wiki English format
  const match = durationStr.match(/Valid until:\s*([A-Za-z]+)\s+(\d+),\s+(\d{4})\s*(\d{2}:\d{2})?\s*\(([^)]+)\)?/i);
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const timeStr = match[4] || "23:59";
    const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n, 10));

    const monthIdx = Object.keys(MONTH_MAP).indexOf(monthStr.toLowerCase());
    if (monthIdx !== -1) {
      return new Date(Date.UTC(year, monthIdx, day, hours + 7, minutes));
    }
  }

  // Manual Vietnamese format (DD/MM or DD/MM/YYYY)
  const vnMatch = durationStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const monthIdx = parseInt(vnMatch[2], 10) - 1;
    const currentYear = new Date().getFullYear();
    const year = vnMatch[3] ? parseInt(vnMatch[3].length === 2 ? `20${vnMatch[3]}` : vnMatch[3], 10) : currentYear;

    return new Date(year, monthIdx, day, 23, 59, 59);
  }

  return null;
}

/**
 * Check if a code is expired
 * @param {string} durationStr
 * @returns {boolean}
 */
function isCodeExpired(durationStr) {
  const expiryDate = parseExpiryDate(durationStr);
  if (!expiryDate) return false;
  return Date.now() > expiryDate.getTime();
}

/**
 * Check if a code is expiring within 24 hours
 * @param {string} durationStr
 * @returns {boolean}
 */
function isExpiringWithin24Hours(durationStr) {
  const expiryDate = parseExpiryDate(durationStr);
  if (!expiryDate) return false;

  const now = Date.now();
  const expiryTime = expiryDate.getTime();
  const diffMs = expiryTime - now;

  // Expiring within 24 hours (86,400,000 ms)
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
}

/**
 * Translates duration/validity string into ultra-lightweight clean Vietnamese
 * @param {string} durationStr
 * @returns {Promise<string>}
 */
async function translateDurationToVN(durationStr) {
  if (!durationStr) return "Hạn dùng: Vô thời hạn";

  if (isCodeExpired(durationStr)) {
    return "🔴 Trạng thái: Đã hết hạn (Expired)";
  }

  const lower = durationStr.toLowerCase().trim();

  // Pattern 1: Unknown / Permanent / Vô thời hạn
  if (lower.includes("unknown") || lower.includes("permanent") || lower.includes("vô thời hạn")) {
    const discMatch = durationStr.match(/Discovered:\s*([A-Za-z]+)\s+(\d+),\s+(\d{4})/i);
    if (discMatch) {
      const month = MONTH_MAP[discMatch[1].toLowerCase()] || discMatch[1];
      const day = discMatch[2].padStart(2, "0");
      const year = discMatch[3];
      return `Phát hiện: ${day}/${month}/${year} | Hạn dùng: Vô thời hạn`;
    }
    return "Hạn dùng: Vô thời hạn (Còn hiệu lực)";
  }

  // Pattern 2: Discovered date + Valid until date
  // Example: "Discovered: August 7, 2026 | Valid until: August 9, 2026 08:59 (PT)"
  const fullMatch = durationStr.match(/(?:Discovered:\s*([A-Za-z]+)\s+(\d+),\s+(\d{4})\s*\|?\s*)?Valid until:\s*([A-Za-z]+)\s+(\d+),\s+(\d{4})\s*(\d{2}:\d{2})\s*\(([^)]+)\)/i);
  if (fullMatch) {
    const dMonth = fullMatch[1] ? MONTH_MAP[fullMatch[1].toLowerCase()] : null;
    const dDay = fullMatch[2] ? fullMatch[2].padStart(2, "0") : null;
    const dYear = fullMatch[3];

    const vMonth = MONTH_MAP[fullMatch[4].toLowerCase()] || fullMatch[4];
    const vDay = fullMatch[5].padStart(2, "0");
    const vYear = fullMatch[6];
    const vTime = fullMatch[7];
    const vTz = fullMatch[8] || "PT";

    const discPart = (dMonth && dDay && dYear) ? `Phát hiện: ${dDay}/${dMonth}/${dYear} | ` : "";
    return `${discPart}Hạn dùng: ${vTime} ngày ${vDay}/${vMonth}/${vYear} (${vTz})`;
  }

  // Pattern 3: Simple date without time e.g. "Valid until: August 9, 2026"
  const dateMatch = durationStr.match(/Valid until:\s*([A-Za-z]+)\s+(\d+),\s+(\d{4})/i);
  if (dateMatch) {
    const vMonth = MONTH_MAP[dateMatch[1].toLowerCase()] || dateMatch[1];
    const vDay = dateMatch[2].padStart(2, "0");
    const vYear = dateMatch[3];
    return `Hạn dùng: Ngày ${vDay}/${vMonth}/${vYear}`;
  }

  // Pattern 4: Vietnamese manual format e.g. "hạn 11/08" or "hạn 11/08/2026"
  const vnMatch = durationStr.match(/(?:hạn|han|expires?|hết hạn|het han)?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i);
  if (vnMatch) {
    const day = vnMatch[1].padStart(2, "0");
    const month = vnMatch[2].padStart(2, "0");
    const currentYear = new Date().getFullYear();
    const year = vnMatch[3] ? (vnMatch[3].length === 2 ? `20${vnMatch[3]}` : vnMatch[3]) : currentYear;
    return `Hạn dùng: Ngày ${day}/${month}/${year}`;
  }

  // Fallback to Gemini AI if API key is configured
  if (GEMINI_API_KEYS && GEMINI_API_KEYS[0]) {
    try {
      const apiKey = GEMINI_API_KEYS[0];
      const prompt = `Chỉ định dạng ngắn gọn thông tin thời hạn code sau sang Tiếng Việt theo mẫu "Hạn dùng: ...", tuyệt đối không giải thích hay chào hỏi: "${durationStr}"`;
      const res = await axios.post(`${GEMINI_MODEL_URL}${apiKey}`, {
        contents: [{ parts: [{ text: prompt }] }],
      }, { timeout: 5000 });

      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim().replace(/[*"`]/g, "").replace(/\n/g, " ");
    } catch (err) {}
  }

  // Basic fallback
  return durationStr
    .replace(/Discovered:/gi, "Phát hiện:")
    .replace(/Valid until:/gi, "Hạn dùng:")
    .replace(/Unknown/gi, "Vô thời hạn");
}

module.exports = {
  translateDurationToVN,
  parseExpiryDate,
  isExpiringWithin24Hours,
  isCodeExpired,
};
