// src/features/adminCommands.js
const { ADMIN_IDS, ADMIN_ID } = require("../config/env");

/**
 * Kiểm tra người dùng có quyền quản trị/quản lý tin nhắn hay không
 * @param {import("discord.js").Message} message
 * @returns {boolean}
 */
function hasManageMessagesPermission(message) {
  if (!message.guild || !message.member) return false;

  const authorId = message.author.id;
  // 1. Thuộc danh sách Admin IDs tối cao
  if ((Array.isArray(ADMIN_IDS) && ADMIN_IDS.includes(authorId)) || authorId === ADMIN_ID) return true;

  // 2. Chủ sở hữu server (Guild Owner)
  if (message.guild.ownerId === authorId) return true;

  // 3. Có quyền Administrator hoặc ManageMessages
  if (message.member.permissions?.has?.("Administrator") || message.member.permissions?.has?.("ManageMessages")) {
    return true;
  }

  return false;
}

/**
 * Xử lý lệnh !clear <x> hoặc !xoa <x>
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").Message} message
 */
async function handleClearCommand(client, message) {
  const content = message.content.trim();
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (command !== "!clear" && command !== "!xoa") return false;

  // 1. Kiểm tra phân quyền an toàn
  if (!hasManageMessagesPermission(message)) {
    const reply = await message.reply("⛔ Bạn không có quyền sử dụng lệnh này (Cần quyền Quản Lý Tin Nhắn hoặc Quản Trị Viên)!").catch(() => null);
    if (reply) {
      setTimeout(() => reply.delete().catch(() => {}), 4000);
      setTimeout(() => message.delete().catch(() => {}), 4000);
    }
    return true;
  }

  // 2. Kiểm tra tham số số lượng tin nhắn
  const countArg = parts[1];
  const count = parseInt(countArg, 10);

  if (isNaN(count) || count < 1 || count > 100) {
    const reply = await message.reply("⚠️ Vui lòng nhập số lượng tin nhắn hợp lệ từ **1** đến **100**!\nVí dụ: `!clear 5` hoặc `!clear 50`.").catch(() => null);
    if (reply) {
      setTimeout(() => reply.delete().catch(() => {}), 4000);
      setTimeout(() => message.delete().catch(() => {}), 4000);
    }
    return true;
  }

  // 3. Thực hiện bulkDelete an toàn
  try {
    // Xóa số tin nhắn yêu cầu + chính tin nhắn lệnh !clear (tối đa 100 theo giới hạn Discord API)
    const toDelete = Math.min(count + 1, 100);
    const deletedMessages = await message.channel.bulkDelete(toDelete, true);

    const actualCount = Math.max(deletedMessages.size - 1, 0);
    const notice = await message.channel.send(`🧹 Đã dọn dẹp thành công **${actualCount}** tin nhắn theo yêu cầu của <@${message.author.id}>!`);

    // Tự động xóa tin nhắn thông báo sau 4 giây
    setTimeout(() => {
      notice.delete().catch(() => {});
    }, 4000);
  } catch (err) {
    console.error("❌ [Admin Clear Error]:", err.message);
    const errNotice = await message.channel.send(`❌ Không thể xóa tin nhắn: ${err.message}`).catch(() => null);
    if (errNotice) {
      setTimeout(() => errNotice.delete().catch(() => {}), 4000);
    }
  }

  return true;
}

module.exports = {
  handleClearCommand,
  hasManageMessagesPermission,
};
