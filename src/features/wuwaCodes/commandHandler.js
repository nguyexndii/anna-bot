// src/features/wuwaCodes/commandHandler.js
const {
  checkAndNotifyWuwaCodes,
  addManualCode,
  listManualCodes,
  updateManualCode,
  deleteManualCode,
} = require("./index");
const { createWuwaExpiringSoonEmbed } = require("./embedBuilder");
const { isExpiringWithin24Hours, translateDurationToVN } = require("./wuwaUtils");
const WuwaCodeModel = require("../../database/models/WuwaCode");
const { EmbedBuilder } = require("discord.js");
const { ADMIN_IDS, ADMIN_ID, WUWA_ROLE_ID } = require("../../config/env");

const isAdmin = (userId) => (ADMIN_IDS && ADMIN_IDS.length > 0) ? ADMIN_IDS.includes(userId) : userId === ADMIN_ID;

/**
 * Handle chat commands for Wuthering Waves codes
 * (!testcode, !checkcode, !themcode, !addcode, !testexpire, !testhethan, !danhsachcode, !listcode, !suacode, !xoacode)
 * Restricted to Admins only
 * @param {import("discord.js").Client} client
 */
function onWuwaCodeMessage(client) {
  return async (message) => {
    if (!message.content || message.author.bot) return;

    const content = message.content.trim();
    const lowerContent = content.toLowerCase();

    // Check command prefixes
    const isTestCmd = lowerContent === "!testcode" || lowerContent === "!checkcode";
    const isExpireCmd = lowerContent === "!testexpire" || lowerContent === "!testhethan";
    const isAddCmd = lowerContent.startsWith("!themcode") || lowerContent.startsWith("!addcode");
    const isListCmd = lowerContent === "!danhsachcode" || lowerContent === "!listcode";
    const isEditCmd = lowerContent.startsWith("!suacode") || lowerContent.startsWith("!editcode");
    const isDeleteCmd = lowerContent.startsWith("!xoacode") || lowerContent.startsWith("!deletecode");

    if (!isTestCmd && !isExpireCmd && !isAddCmd && !isListCmd && !isEditCmd && !isDeleteCmd) return;

    // Admin Permission Check
    if (!isAdmin(message.author.id)) {
      return message.reply("⛔ **Bạn không có quyền sử dụng lệnh này!** (Chỉ dành cho Admin)");
    }

    // Command 1: !testcode or !checkcode
    if (isTestCmd) {
      const statusMsg = await message.reply("🔄 **[WuWa Bot]** Đang tiến hành quét kiểm tra code từ Fandom Wiki...").catch(() => null);

      try {
        await checkAndNotifyWuwaCodes(client);
        if (statusMsg) {
          await statusMsg.edit("✅ **[WuWa Bot]** Đã kiểm tra xong! Tất cả code mới nhất trên Fandom Wiki đã được xử lý và thông báo.").catch(() => {});
        }
      } catch (err) {
        console.error("❌ Error in !testcode command:", err);
        if (statusMsg) {
          await statusMsg.edit(`❌ **[WuWa Bot]** Có lỗi xảy ra khi quét code: ${err.message}`).catch(() => {});
        }
      }
      return;
    }

    // Command 2: !testexpire or !testhethan (Scans actual DB codes for 24h expiration with demo fallback)
    if (isExpireCmd) {
      try {
        let activeDocs = [];
        try {
          activeDocs = await WuwaCodeModel.find({ isActive: true });
        } catch (dbErr) {}

        const expiringCodes = [];
        for (const doc of activeDocs) {
          if (isExpiringWithin24Hours(doc.duration)) {
            expiringCodes.push({
              code: doc.code,
              duration: doc.duration,
            });
          }
        }

        const roleMention = WUWA_ROLE_ID ? `<@&${WUWA_ROLE_ID}>` : `<@${message.author.id}>`;

        if (expiringCodes.length > 0) {
          const embed = await createWuwaExpiringSoonEmbed(expiringCodes);
          await message.reply({
            content: `⚠️ Phát hiện **${expiringCodes.length} code trong hệ thống** sắp hết hạn trong 24h!\n${roleMention}`,
            embeds: [embed],
          });
        } else {
          const demoExpiringCodes = [
            { code: "HEARTOFSWORD", duration: "Valid until: August 11, 2026 08:59 (PT)" },
            { code: "ETERNALFLAME", duration: "Valid until: August 11, 2026 08:59 (PT)" },
          ];
          const embed = await createWuwaExpiringSoonEmbed(demoExpiringCodes);
          await message.reply({
            content: `ℹ️ Hiện tại chưa có code nào trong DB sắp hết hạn trong 24h. Gửi tin nhắn mẫu thử nghiệm giao diện:\n${roleMention}`,
            embeds: [embed],
          });
        }
      } catch (err) {
        console.error("❌ Error in !testexpire command:", err);
        await message.reply(`❌ Lỗi khi gửi demo hết hạn: ${err.message}`);
      }
      return;
    }

    // Command 3: !danhsachcode or !listcode (List all saved codes & display CRUD usage guide)
    if (isListCmd) {
      try {
        const codes = await listManualCodes();
        if (codes.length === 0) {
          return message.reply("ℹ️ **Hệ thống chưa lưu trữ mã code nào.** Bạn có thể dùng `!themcode <MÃ_CODE> [Quà] | [Hạn]` để thêm mới!");
        }

        const listLines = codes.map((c) => {
          const rewardsClean = (c.rewardsText || "").replace(/•/g, "").replace(/\n/g, ", ").trim();
          return `**#${c.index}** | Code: \`${c.code}\` | Quà: ${rewardsClean} | Hạn: \`${c.duration}\``;
        });

        const embed = new EmbedBuilder()
          .setTitle("📋 DANH SÁCH TOÀN BỘ CODE TRONG HỆ THỐNG")
          .setColor("#00E5FF")
          .setDescription(
            listLines.join("\n\n") + "\n\n" +
            "─── **📖 HƯỚNG DẪN QUẢN LÝ CODE (ADMIN)** ───\n" +
            "• **Thêm code:** `!themcode <MÃ_CODE> [Phần thưởng] [| Thời hạn]`\n" +
            "  *Ví dụ:* `!themcode NEWGIFT 100 Astrite, 50k Credit | Hạn đến 30/08`\n" +
            "• **Sửa code:** `!suacode <ID_HOẶC_MÃ> <Phần thưởng mới> [| Thời hạn mới]`\n" +
            "  *Ví dụ:* `!suacode 1 200 Astrite | Hạn 15/08` hoặc `!suacode NEWGIFT 200 Astrite`\n" +
            "• **Chỉ sửa thời hạn:** `!suacode <ID_HOẶC_MÃ> | <Thời hạn mới>`\n" +
            "  *Ví dụ:* `!suacode 1 | Hạn 20/08`\n" +
            "• **Xóa code:** `!xoacode <ID_HOẶC_MÃ>`\n" +
            "  *Ví dụ:* `!xoacode 1` hoặc `!xoacode NEWGIFT`"
          )
          .setFooter({ text: "Gõ đúng lệnh và ID tương ứng để quản lý code nhé!" })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } catch (err) {
        console.error("❌ Error in !danhsachcode command:", err);
        return message.reply(`❌ Lỗi khi tải danh sách code: ${err.message}`);
      }
    }

    // Command 4: !suacode or !editcode (Flexible editing for Rewards, Duration, or both)
    if (isEditCmd) {
      const argsStr = content.replace(/^!(suacode|editcode)/i, "").trim();

      if (!argsStr) {
        return message.reply(
          "⚠️ **Cú pháp sử dụng:**\n" +
          "• **Sửa cả quà & hạn:** `!suacode <ID_HOẶC_MÃ> <Quà mới> | <Hạn mới>`\n" +
          "• **Chỉ sửa phần thưởng:** `!suacode <ID_HOẶC_MÃ> <Quà mới>`\n" +
          "• **Chỉ sửa thời hạn:** `!suacode <ID_HOẶC_MÃ> | <Hạn mới>`\n" +
          "**Ví dụ:** `!suacode 1 200 Astrite, 100k Credit | Hạn đến 15/08`"
        );
      }

      const parts = argsStr.split("|");
      const mainPart = parts[0].trim();
      const durationText = parts[1] ? parts[1].trim() : undefined;

      const spaceIdx = mainPart.indexOf(" ");
      let identifier = "";
      let rewardsRaw = "";

      if (spaceIdx === -1) {
        identifier = mainPart;
      } else {
        identifier = mainPart.substring(0, spaceIdx).trim();
        rewardsRaw = mainPart.substring(spaceIdx + 1).trim();
      }

      if (!identifier) {
        return message.reply("❌ Vui lòng nhập ID hoặc Mã code cần sửa!");
      }

      const rewardsText = rewardsRaw ? (rewardsRaw.startsWith("•") ? rewardsRaw : `• ${rewardsRaw}`) : undefined;

      try {
        const result = await updateManualCode(identifier, { rewardsText, duration: durationText });
        if (result.success) {
          const durationVN = await translateDurationToVN(result.codeObj.duration);
          return message.reply(
            `✅ **Thành công!** Đã cập nhật thông tin cho code \`${result.codeObj.code}\`:\n` +
            `🎁 **Phần thưởng mới:** ${result.codeObj.rewardsText || "• Chưa có thông tin phần thưởng"}\n` +
            `⏳ **Thời hạn mới:** \`${durationVN}\``
          );
        } else {
          return message.reply(`❌ ${result.error}`);
        }
      } catch (err) {
        console.error("❌ Error in !suacode command:", err);
        return message.reply(`❌ Lỗi khi sửa code: ${err.message}`);
      }
    }

    // Command 5: !xoacode or !deletecode (Delete code by ID or Code string)
    if (isDeleteCmd) {
      const identifier = content.replace(/^!(xoacode|deletecode)/i, "").trim();

      if (!identifier) {
        return message.reply(
          "⚠️ **Cú pháp chưa đúng!** Vui lòng nhập:\n" +
          "`!xoacode <ID_HOẶC_MÃ_CODE>`\n" +
          "**Ví dụ:** `!xoacode 1` hoặc `!xoacode NEWGIFT`"
        );
      }

      try {
        const result = await deleteManualCode(identifier);
        if (result.success) {
          return message.reply(`🗑️ **Thành công!** Đã xóa code \`${result.deletedCode}\` khỏi hệ thống.`);
        } else {
          return message.reply(`❌ ${result.error}`);
        }
      } catch (err) {
        console.error("❌ Error in !xoacode command:", err);
        return message.reply(`❌ Lỗi khi xóa code: ${err.message}`);
      }
    }

    // Command 6: !themcode or !addcode
    if (isAddCmd) {
      // Syntax: !themcode <CODE> [Phần thưởng] [| Thời hạn]
      const argsStr = content.replace(/^!(themcode|addcode)/i, "").trim();

      if (!argsStr) {
        return message.reply(
          "⚠️ **Cú pháp chưa đúng!** Vui lòng nhập:\n" +
          "`!themcode <MÃ_CODE> [Phần thưởng] [| Thời hạn]`\n" +
          "**Ví dụ:** `!themcode NEWGIFT2026 100 Astrite, 50k Shell Credit | Hạn đến 30/08`"
        );
      }

      // Split by '|' for optional duration
      const parts = argsStr.split("|");
      const codeAndRewards = parts[0].trim();
      const durationText = parts[1] ? parts[1].trim() : "Thêm thủ công";

      // Separate CODE (first word) from Rewards
      const spaceIdx = codeAndRewards.indexOf(" ");
      let code = "";
      let rewardsRaw = "";

      if (spaceIdx === -1) {
        code = codeAndRewards.toUpperCase();
        rewardsRaw = "Chưa có thông tin phần thưởng";
      } else {
        code = codeAndRewards.substring(0, spaceIdx).trim().toUpperCase();
        rewardsRaw = codeAndRewards.substring(spaceIdx + 1).trim() || "Chưa có thông tin phần thưởng";
      }

      if (!code) {
        return message.reply("❌ Không tìm thấy mã code hợp lệ trong câu lệnh!");
      }

      // Format rewards text
      const rewardsText = rewardsRaw.startsWith("•") ? rewardsRaw : `• ${rewardsRaw}`;

      try {
        const result = await addManualCode(client, {
          code,
          server: "All",
          rewards: [{ name: rewardsRaw, quantity: "1", icon: "" }],
          rewardsText,
          duration: durationText,
        });

        if (result.alreadyExisted) {
          return message.reply(`⚠️ Code \`${code}\` **đã tồn tại** trong hệ thống từ trước! Không phát thông báo lặp lại.`);
        }

        if (result.success) {
          return message.reply(`🎉 **Thành công!** Đã thêm và phát thông báo cho code \`${code}\` vào kênh thông báo.`);
        } else {
          return message.reply(`❌ Lỗi khi thêm code: ${result.error || "Không rõ nguyên nhân"}`);
        }
      } catch (err) {
        console.error("❌ Error in !themcode command:", err);
        return message.reply(`❌ Có lỗi xảy ra khi thêm code: ${err.message}`);
      }
    }
  };
}

module.exports = { onWuwaCodeMessage };
