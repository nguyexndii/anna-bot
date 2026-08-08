// src/utils/webhook.service.js
const { WebhookClient } = require("discord.js");
const { WEBHOOKS, WEBHOOK_WORDCHAIN, WEBHOOK_WORDSCRAMBLE } = require("../config/env");

// Initialize webhook client for wordchain
let wordchainWebhookClient = null;
const wordchainUrl = WEBHOOK_WORDCHAIN || (WEBHOOKS && WEBHOOKS.WORDCHAIN);
if (wordchainUrl) {
  try {
    wordchainWebhookClient = new WebhookClient({ url: wordchainUrl });
  } catch (err) {
    console.warn("⚠️ Invalid WEBHOOK_WORDCHAIN URL:", err.message);
  }
}

// Initialize webhook client for wordscramble
let wordscrambleWebhookClient = null;
const wordscrambleUrl = WEBHOOK_WORDSCRAMBLE || (WEBHOOKS && WEBHOOKS.WORDSCRAMBLE);
if (wordscrambleUrl) {
  try {
    wordscrambleWebhookClient = new WebhookClient({ url: wordscrambleUrl });
  } catch (err) {
    console.warn("⚠️ Invalid WEBHOOK_WORDSCRAMBLE URL:", err.message);
  }
}

/**
 * Send message via webhook (with channel fallback support)
 * @param {string} type - 'wordchain' | 'wordscramble'
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

  if (type === "wordscramble" && wordscrambleWebhookClient) {
    try {
      const message = await wordscrambleWebhookClient.send(options);
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
