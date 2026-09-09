// src/utils/webhook.service.js
const { WebhookClient } = require("discord.js");
const { WEBHOOKS, WEBHOOK_WORDCHAIN, WEBHOOK_WORDSCRAMBLE, IS_TEST_MODE } = require("../config/env");

// Initialize webhook client for wordchain
let wordchainWebhookClient = null;
const wordchainUrl = WEBHOOK_WORDCHAIN || (WEBHOOKS && (WEBHOOKS.WORDCHAIN || WEBHOOKS.WEBHOOK_WORDCHAIN));
if (wordchainUrl) {
  try {
    wordchainWebhookClient = new WebhookClient({ url: wordchainUrl });
  } catch (err) {
    console.warn("⚠️ Invalid WEBHOOK_WORDCHAIN URL:", err.message);
  }
}

// Initialize webhook client for wordscramble
let wordscrambleWebhookClient = null;
const wordscrambleUrl = WEBHOOK_WORDSCRAMBLE || (WEBHOOKS && (WEBHOOKS.WORDSCRAMBLE || WEBHOOKS.WEBHOOK_WORDSCRAMBLE));
if (wordscrambleUrl) {
  try {
    wordscrambleWebhookClient = new WebhookClient({ url: wordscrambleUrl });
  } catch (err) {
    console.warn("⚠️ Invalid WEBHOOK_WORDSCRAMBLE URL:", err.message);
  }
}

/**
 * Send message via Webhook with bulletproof fallback to standard Discord channel sending
 * @param {string} webhookUrlOrType - Custom Webhook URL 'https://discord.com/api/webhooks/...' or type 'wordchain' | 'wordscramble'
 * @param {object} options - Message options (content, embeds, etc.)
 * @param {object} channel - Optional Discord Channel for fallback sending
 * @returns {Promise<Message|null>}
 */
async function sendWebhook(webhookUrlOrType, options, channel = null) {
  // Case 0: When in TEST MODE, send directly to the designated test channel so messages don't hit production webhooks
  if (IS_TEST_MODE && channel && typeof channel.send === "function") {
    try {
      return await channel.send(options);
    } catch (err) {
      console.error("❌ Test channel send failed:", err.message);
    }
  }

  // Case 1: Custom Webhook URL provided
  if (webhookUrlOrType && typeof webhookUrlOrType === "string" && webhookUrlOrType.startsWith("http")) {
    try {
      const client = new WebhookClient({ url: webhookUrlOrType });
      const message = await client.send(options);
      return message;
    } catch (error) {
      console.warn(`⚠️ Custom Webhook error (${error.message}), falling back to standard channel.send...`);
    }
  }

  // Case 2: Preconfigured type webhook (wordchain)
  if (webhookUrlOrType === "wordchain" && wordchainWebhookClient) {
    try {
      const message = await wordchainWebhookClient.send(options);
      return message;
    } catch (error) {
      console.warn(`⚠️ Webhook wordchain error (${error.message}), falling back to standard channel.send...`);
    }
  }

  // Case 3: Preconfigured type webhook (wordscramble)
  if (webhookUrlOrType === "wordscramble" && wordscrambleWebhookClient) {
    try {
      const message = await wordscrambleWebhookClient.send(options);
      return message;
    } catch (error) {
      console.warn(`⚠️ Webhook wordscramble error (${error.message}), falling back to standard channel.send...`);
    }
  }

  // Case 4: Standard Channel Send (Default / Fallback)
  if (channel && typeof channel.send === "function") {
    try {
      return await channel.send(options);
    } catch (err) {
      console.error(`❌ Standard Channel send fallback failed:`, err.message);
    }
  }

  return null;
}

module.exports = {
  sendWebhook,
};
