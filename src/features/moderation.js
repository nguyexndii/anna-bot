// src/features/moderation.js - Bot Discord 2
const { PermissionsBitField } = require("discord.js");
const { rawBannedWords } = require("../data/bannedWords");

// Normalize text for comparison
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Process banned words for efficient checking
const processedBannedWords = rawBannedWords.map((raw) => {
  const norm = normalize(raw).trim();
  const compact = norm.replace(/\s+/g, "");
  const isPhrase = norm.includes(" ");
  const isShortToken = !isPhrase && norm.length <= 3;
  return { raw, norm, compact, isPhrase, isShortToken };
});

// Check if text contains banned word
function containsBannedWord(text) {
  const norm = normalize(text);
  const normNoSpace = norm.replace(/\s+/g, "");

  for (const bw of processedBannedWords) {
    if (bw.isPhrase) {
      if (norm.includes(bw.norm)) return true;
      if (normNoSpace.includes(bw.compact)) return true;
      continue;
    }

    if (bw.isShortToken) {
      const pattern = `\\b${escapeRegex(bw.norm)}\\b`;
      const re = new RegExp(pattern, "i");
      if (re.test(norm)) return true;
      continue;
    }

    if (norm.includes(bw.norm)) return true;
    if (normNoSpace.includes(bw.compact)) return true;
  }

  return false;
}

// Check if member is moderator
function isModerator(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// ====== VIOLATIONS & TIMEOUT ======
const userViolations = new Map();
const VIOLATION_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
const MUTE_DURATION_MS = 1 * 60 * 1000; // 1 minute per violation
const MUTE_THRESHOLD = 5; // Mute from 5th violation onwards

// Compute penalty based on violation count
function computePenalty(count) {
  if (count >= MUTE_THRESHOLD) {
    // 5th violation and onwards: mute
    return {
      timeoutMs: MUTE_DURATION_MS,
      currentStep: { threshold: MUTE_THRESHOLD, durationMs: MUTE_DURATION_MS },
      nextStep: null,
    };
  } else {
    // 1-4 violations: warning only
    return {
      timeoutMs: 0,
      currentStep: null,
      nextStep: { threshold: MUTE_THRESHOLD, durationMs: MUTE_DURATION_MS },
    };
  }
}

// Handle violation
async function handleViolation(message, options) {
  const {
    isHardKeyword = false,
    baseReason = 'Một số từ bạn dùng hơi "mạnh" quá so với nội quy server 😅',
    sourceTag = "UNKNOWN",
  } = options || {};

  const user = message.author;
  const channel = message.channel;
  const userId = user.id;

  let count = 0;
  let remaining = null;
  let penaltyInfo = { timeoutMs: 0, currentStep: null, nextStep: null };

  if (isHardKeyword) {
    const now = Date.now();
    const record = userViolations.get(userId) || { count: 0, lastAt: 0 };

    if (record.lastAt && now - record.lastAt > VIOLATION_WINDOW_MS) {
      record.count = 0;
    }

    record.count += 1;
    record.lastAt = now;
    userViolations.set(userId, record);

    count = record.count;
    penaltyInfo = computePenalty(count);
    remaining = penaltyInfo.nextStep
      ? penaltyInfo.nextStep.threshold - count
      : 0;

    console.log(
      `⚠️ HARD VIOLATION ${user.tag} (${sourceTag}) – count=${count}`
    );
  }

  // Delete the message
  try {
    await message.delete();
  } catch {}

  // Apply timeout if needed (from 5th violation onwards)
  if (isHardKeyword && penaltyInfo.timeoutMs > 0) {
    const member = message.member;
    if (member && member.moderatable) {
      try {
        await member.timeout(
          penaltyInfo.timeoutMs,
          `Auto-timeout: từ ngữ nặng (${sourceTag}, ${count} lần)`
        );
        const minutes = Math.round(penaltyInfo.timeoutMs / 60000);

        // Send mute notification
        const muteMsg = await channel.send(
          `🔇 Xử lý: Đã bịt miệng <@${userId}> trong ${minutes} phút. Hết cứu!`
        );

        // Auto-delete after 10 seconds
        setTimeout(() => {
          muteMsg.delete().catch(() => {});
        }, 10000);
      } catch {}
    }
  } else if (isHardKeyword) {
    // Send warning message only (violations 1-4)
    try {
      const warningMsg = await channel.send(
        `⚠️ Cảnh báo: Ngôn từ không phù hợp. Nhắc nhẹ!`
      );

      // Auto-delete after 10 seconds
      setTimeout(() => {
        warningMsg.delete().catch(() => {});
      }, 10000);
    } catch {}
  }
}

// Message create handler
function onMessageCreate(client) {
  return async (message) => {
    try {
      // Ignore DMs
      if (!message.guild) return;

      // Ignore bot messages
      if (message.author.bot) return;

      const content = message.content.trim();
      if (!content) return;

      // Auto-reply for "alo"
      if (content.toLowerCase() === "alo") {
        await message.channel.send(
          "Tổng đài 1800 xin nghe, vui lòng nói bé thôi"
        );
        return;
      }

      // Check for banned words
      if (containsBannedWord(content)) {
        await handleViolation(message, {
          isHardKeyword: true,
          baseReason:
            "Một số từ trong tin nhắn hơi quá đà, đang nằm trong danh sách hạn chế.",
          sourceTag: "LIST_HARD",
        });
      }
    } catch (err) {
      console.error("Lỗi messageCreate:", err);
    }
  };
}

module.exports = { onMessageCreate, isModerator };
