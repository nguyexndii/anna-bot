// src/features/helpCommand.js
const { EmbedBuilder } = require("discord.js");
const { WUWA_EMOJI_ID, WORDCHAIN_CHANNEL_ID, WORDSCRAMBLE_CHANNEL_ID, WUWA_CODES_CHANNEL_ID } = require("../config/env");

/**
 * Creates the master Help / Commands Embed listing all bot commands & channels
 * @returns {EmbedBuilder}
 */
function createMasterHelpEmbed() {
  const wuwaEmoji = `<:wuwa:${WUWA_EMOJI_ID || "1536322393411424286"}>`;

  const embed = new EmbedBuilder()
    .setTitle(`🤖 DANH SÁCH TOÀN BỘ LỆNH CỦA BOT`)
    .setDescription("Dưới đây là tổng hợp tất cả các lệnh bot đang hỗ trợ và vị trí kênh tương ứng:")
    .setColor("#FFD700")
    .addFields(
      {
        name: `${wuwaEmoji} WUTHERING WAVES CODES`,
        value:
          `📌 **Kênh sử dụng:** Kênh thông báo Code (<#${WUWA_CODES_CHANNEL_ID || "1528768068581457930"}>)\n` +
          `• \`!testcode\` / \`!checkcode\` *(Admin)* ➔ Quét trang Fandom Wiki tìm code mới ngay lập tức.\n` +
          `• \`!danhsachcode\` / \`!listcode\` *(Admin)* ➔ Xem danh sách toàn bộ code + Hướng dẫn Quản lý.\n` +
          `• \`!themcode <CODE> [Phần thưởng] [\| Hạn]\` *(Admin)* ➔ Thêm code thủ công & thông báo ngay.\n` +
          `• \`!suacode <ID_HOẶC_MÃ> <Quà mới> [\| Hạn mới]\` *(Admin)* ➔ Sửa thông tin code đã lưu.\n` +
          `• \`!xoacode <ID_HOẶC_MÃ>\` *(Admin)* ➔ Xóa code khỏi hệ thống.\n` +
          `• \`!testexpire\` *(Admin)* ➔ Thử nghiệm gửi tin nhắn cảnh báo code sắp hết hạn trong 24h.`,
        inline: false,
      },
      {
        name: "🔤 GAME NỐI TỪ (WORD CHAIN)",
        value:
          `📌 **Kênh sử dụng:** Kênh Nối Từ (<#${WORDCHAIN_CHANNEL_ID || "1450065511231520778"}>)\n` +
          `• \`!goiy\` / \`!gợi ý\` ➔ Xin gợi ý từ tiếp theo từ AI (Cooldown 2 phút).\n` +
          `• \`!bxh\` / \`!bangxephang\` ➔ Xem Bảng xếp hạng người chơi Nối từ xuất sắc.\n` +
          `• \`!luatchoi\` / \`!huongdan\` ➔ Xem chi tiết luật chơi Nối từ.\n` +
          `• \`!batdau\` *(Admin)* ➔ Khởi tạo ván chơi Nối từ mới.`,
        inline: false,
      },
      {
        name: "🧩 GAME SẮP XẾP TỪ (WORD SCRAMBLE)",
        value:
          `📌 **Kênh sử dụng:** Kênh Sắp Xếp Từ (<#${WORDSCRAMBLE_CHANNEL_ID || "1535705241620717720"}>)\n` +
          `• \`!goiy\` / \`!gợi ý\` ➔ Mở khóa gợi ý chữ cái mở đầu của từ đố.\n` +
          `• \`!bxh\` / \`!bangxephang\` ➔ Xem Bảng xếp hạng điểm số Sắp xếp từ.\n` +
          `• \`!skip\` / \`!bỏ qua\` ➔ Bỏ qua câu đố khó hiện tại để đổi câu mới.\n` +
          `• \`!luatchoi\` / \`!huongdan\` ➔ Xem luật chơi Sắp xếp từ.`,
        inline: false,
      },
      {
        name: "⚙️ HỆ THỐNG & TRỢ GIÚP CHUNG",
        value:
          `📌 **Kênh sử dụng:** Tất cả các kênh trong server\n` +
          `• \`!lenhanna\` ➔ Xem bảng danh sách toàn bộ lệnh bot.\n` +
          `• \`alo\` ➔ Gọi tổng đài bot phản hồi vui.`,
        inline: false,
      }
    )
    .setFooter({ text: "Bot Discord • Hãy gõ đúng lệnh vào đúng kênh tương ứng nhé!" })
    .setTimestamp();

  return embed;
}

/**
 * Handle master help message command (!lenhanna)
 * @param {import("discord.js").Client} client
 */
function onHelpMessage(client) {
  return async (message) => {
    if (!message.content || message.author.bot) return;

    const lower = message.content.trim().toLowerCase();

    if (lower === "!lenhanna") {
      try {
        const helpEmbed = createMasterHelpEmbed();
        await message.reply({ embeds: [helpEmbed] });
      } catch (err) {
        console.error("❌ Error sending master help embed:", err);
      }
    }
  };
}

module.exports = { createMasterHelpEmbed, onHelpMessage };
