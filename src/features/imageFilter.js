/**
 * Filter images in general chat channel
 */

const { GENERAL_CHAT_CHANNEL_ID, IMAGE_UPLOAD_CHANNEL_ID } = require("../config/env");

/**
 * Handle image filtering logic
 * @param {Message} message - Discord message
 */
async function handleImageFilter(message) {
  try {
    // Check if message is in General Chat channel
    if (message.channelId !== GENERAL_CHAT_CHANNEL_ID) return false;

    // Check if message has image attachments
    const hasImage = message.attachments.some(attachment => 
      attachment.contentType && attachment.contentType.startsWith("image/")
    );

    if (hasImage) {
      // 1. Delete original message
      await message.delete().catch(() => {});

      // 2. Notify user
      const warningMsg = await message.channel.send(
        `<@${message.author.id}> Vui lòng gửi ảnh tại <#${IMAGE_UPLOAD_CHANNEL_ID}>.`
      );

      // 3. Auto-delete notification after 5 seconds
      setTimeout(() => {
        warningMsg.delete().catch(() => {});
      }, 5000);

      return true; // Image was filtered
    }
  } catch (error) {
    console.error("❌ Error in handleImageFilter:", error);
  }
  return false;
}

module.exports = { handleImageFilter };
