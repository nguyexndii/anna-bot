// src/utils/webhook.service.js
const { WebhookClient } = require("discord.js");
const { WEBHOOKS, WEBHOOK_WORDCHAIN } = require("../config/env");

// Initialize webhook client for wordchain if URL exists
let wordchainWebhookClient = null;
const wordchainUrl = WEBHOOK_WORDCHAIN || (WEBHOOKS && WEBHOOKS.WORDCHAIN);
if (wordchainUrl) {
  try {
    wordchainWebhookClient = new WebhookClient({ url: wordchainUrl });
  } catch (err) {
    console.warn("⚠️ Invalid WEBHOOK_WORDCHAIN URL:", err.message);
  }
}

/**
 * Send message via webhook (with fallback support)
 * @param {string} type - 'wordchain'
 * @param {object} options - Message options
 * @param {object} channel - Optional Discord Channel for fallback sending
 * @returns {Promise<Message|null>}
 */
async function sendWebhook(type, options, channel = null) {
  if (type === "wordchain" && wordchainWebhookClient) {
    try {
      const message = await wordchainWebhookClient.send(options);
      return message;
    } catch (error) {
      console.warn(`⚠️ Webhook ${type} error, falling back to channel:`, error.message);
    }
  }

  // Fallback to sending via normal channel message if channel provided
  if (channel) {
    try {
      return await channel.send(options);
    } catch (err) {
      console.error(`❌ Channel send fallback failed:`, err.message);
    }
  }

  return null;
}

module.exports = {
  sendWebhook,
};
