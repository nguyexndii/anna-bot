// src/features/helpCommand.js
const { EmbedBuilder } = require("discord.js");
const {
  WUWA_EMOJI_ID,
  WORDCHAIN_CHANNEL_ID,
  WORDSCRAMBLE_CHANNEL_ID,
  WUWA_CODES_CHANNEL_ID,
  HOYO_CODES_CHANNEL_ID,
  ENDFIELD_CODES_CHANNEL_ID,
  GACHA_UPDATE_FORUM_CHANNEL_ID,
} = require("../config/env");

/**
 * Creates the master Help / Commands Embed listing all bot commands & channels
 * @returns {EmbedBuilder}
 */
function createMasterHelpEmbed() {
  const wuwaEmoji = `<:wuwa:${WUWA_EMOJI_ID || "1536322393411424286"}>`;

  const embed = new EmbedBuilder()
    .setTitle(`🤖 BẢNG HƯỚNG DẪN & DANH SÁCH TOÀN BỘ LỆNH CỦA BOT`)
    .setDescription(
      "Dưới đây là tổng hợp toàn bộ các tính năng, lệnh tương tác và kênh hoạt động của bot.\n" +
      "💡 *Để tránh trùng với các bot khác trong server, bạn có thể dùng lệnh phụ độc quyền: **`!annahelp`**, **`!ahelp`**, hoặc **`!annalenh`**!*"
    )
    .setColor("#FFD700")
    .addFields(
      {
        name: "🎁 MÃ QUÀ TẶNG & TIN TỨC GACHA (5 TỰA GAME)",
        value:
          `📌 **Hỗ trợ 5 tựa game:** Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves, Arknights: Endfield.\n` +
          `• \`!testlive [zzz|hsr|gi|wuwa|ef]\` *(Admin)* ➔ Gửi mẫu Livestream Special Program (Gửi ngay tại kênh bạn chat).\n` +
          `• \`!testhoyo [hsr|gi|zzz]\` *(Admin)* ➔ Gửi mẫu Code HoYoverse thường ngày (Gửi tại kênh chat).\n` +
          `• \`!testwuwa\` *(Admin)* ➔ Gửi mẫu Code Wuthering Waves 1 chạm sao chép (Gửi tại kênh chat).\n` +
          `• \`!testendfield\` *(Admin)* ➔ Gửi mẫu Code Arknights: Endfield (Gửi tại kênh chat).\n` +
          `• \`!testgacha [hsr|gi|zzz|wuwa|ef]\` *(Admin)* ➔ Xem trước bài tóm tắt cập nhật AI cho diễn đàn.\n` +
          `• \`!checkhoyo\` *(Admin)* ➔ Quét và gửi mã code HoYoverse mới tức thì.\n` +
          `• **Kênh Bảng tin Diễn đàn:** <#${GACHA_UPDATE_FORUM_CHANNEL_ID || "1559612707605319710"}> (Tự động tóm tắt bản cập nhật từ hôm nay).`,
        inline: false,
      },
      {
        name: `${wuwaEmoji} QUẢN LÝ CODE WUTHERING WAVES (ADMIN)`,
        value:
          `📌 **Kênh nhận code:** <#${WUWA_CODES_CHANNEL_ID || "1528768068581457930"}>\n` +
          `• \`!testcode\` / \`!checkcode\` ➔ Quét trang Fandom Wiki tìm code WuWa mới ngay lập tức.\n` +
          `• \`!danhsachcode\` / \`!listcode\` ➔ Xem toàn bộ code trong cơ sở dữ liệu.\n` +
          `• \`!themcode <CODE> [Quà] [\| Hạn]\` ➔ Thêm mã code thủ công vào bot.\n` +
          `• \`!suacode <ID/MÃ> <Quà mới> [\| Hạn mới]\` ➔ Chỉnh sửa thông tin code.\n` +
          `• \`!xoacode <ID/MÃ>\` ➔ Xóa code khỏi hệ thống.`,
        inline: false,
      },
      {
        name: "🔤 GAME NỐI TỪ (WORD CHAIN)",
        value:
          `📌 **Kênh tham gia:** <#${WORDCHAIN_CHANNEL_ID || "1450065511231520778"}>\n` +
          `• \`!goiy\` / \`!gợi ý\` ➔ Xin bot gợi ý từ tiếp theo (Cooldown 2 phút).\n` +
          `• \`!bxh\` / \`!bangxephang\` ➔ Xem Bảng xếp hạng cao thủ Nối từ.\n` +
          `• \`!luatchoi\` / \`!huongdan\` ➔ Đọc luật chơi và thể lệ tính điểm.\n` +
          `• \`!batdau\` *(Admin)* ➔ Khởi động lại ván chơi mới.`,
        inline: false,
      },
      {
        name: "🧩 GAME SẮP XẾP TỪ (WORD SCRAMBLE)",
        value:
          `📌 **Kênh tham gia:** <#${WORDSCRAMBLE_CHANNEL_ID || "1535705241620717720"}>\n` +
          `• \`!goiy\` / \`!gợi ý\` ➔ Mở khóa chữ cái đầu tiên của câu đố.\n` +
          `• \`!bxh\` / \`!bangxephang\` ➔ Xem Bảng xếp hạng Sắp xếp từ.\n` +
          `• \`!skip\` / \`!bỏ qua\` ➔ Bỏ qua câu đố hiện tại để chuyển câu mới.\n` +
          `• \`!luatchoi\` / \`!huongdan\` ➔ Hướng dẫn cách tham gia.`,
        inline: false,
      },
      {
        name: "⚙️ HỆ THỐNG & QUẢN TRỊ (TOÀN BỘ KÊNH)",
        value:
          `• \`!status\` / \`!health\` / \`!astatus\` *(Admin)* ➔ Bảng điều khiển giám sát sức khỏe toàn bộ API & Endpoint.\n` +
          `• \`!clear <1-100>\` / \`!xoa <1-100>\` *(Admin/Quản lý)* ➔ Xóa nhanh hàng loạt tin nhắn.\n` +
          `• \`!annahelp\` / \`!ahelp\` / \`!annalenh\` / \`!alenh\` ➔ Lệnh phụ xem bảng trợ giúp (không trùng bot khác).\n` +
          `• \`!lenh\` / \`!help\` / \`!command\` / \`!menu\` ➔ Các lệnh trợ giúp chuẩn.\n` +
          `• \`alo\` ➔ Gọi thử bot kiểm tra kết nối.`,
        inline: false,
      }
    )
    .setFooter({ text: "Anna Yanami Bot • Gõ !ahelp hoặc !annahelp bất cứ khi nào bạn cần nhé!" })
    .setTimestamp();

  return embed;
}

const MASTER_HELP_COMMANDS = [
  // Lệnh phụ độc quyền chống trùng bot khác
  "!annahelp",
  "!ahelp",
  "!annalenh",
  "!alenh",
  "!anna",
  "!annabot",
  "!annamenu",
  ".annahelp",
  ".ahelp",
  ".annalenh",
  ".help",
  ".lenh",

  // Lệnh phổ biến
  "!lenh",
  "!lenhanna",
  "!help",
  "!command",
  "!commands",
  "!comment",
  "!comments",
  "!menu",
  "!trogiup",
  "!bot",
];

function isMasterHelpCommand(text) {
  if (!text || typeof text !== "string") return false;
  const cleaned = text.trim().toLowerCase();
  return MASTER_HELP_COMMANDS.includes(cleaned);
}

/**
 * Handle master help message command (!lenh, !help, !annahelp, !ahelp...)
 * @param {import("discord.js").Client} client
 */
function onHelpMessage(client) {
  return async (message) => {
    if (!message.content || message.author.bot) return;

    if (isMasterHelpCommand(message.content)) {
      try {
        const helpEmbed = createMasterHelpEmbed();
        await message.reply({ embeds: [helpEmbed] });
      } catch (err) {
        console.error("❌ Error sending master help embed:", err);
      }
    }
  };
}

module.exports = { createMasterHelpEmbed, onHelpMessage, isMasterHelpCommand };
