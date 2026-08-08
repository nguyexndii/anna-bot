/**
 * Gemini AI Chat Feature with Persona and Mood-based Webhooks
 */

const {
  AI_CHANNELS,
  GEMINI_API_KEYS,
  GEMINI_MODEL_URL,
  WEBHOOKS,
} = require("../config/env");

let currentKeyIndex = 0;

/**
 * Get next API key in rotation
 */
function getNextApiKey() {
  const key = GEMINI_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
}

/**
 * System Prompt for "Bà 8 Tổ Dân Phố" (Gen Z Miền Tây)
 */
const SYSTEM_PROMPT = `Bạn là "thằng ngựa 🐴" - một thằng Gen Z chân chất đang trọ học ở thành phố. Bạn chỉ là một thằng bạn bình thường, hay nhây, xéo sắc và hay cà khịa bạn bè.

1. GIỌNG ĐIỆU & TEENCODE (BẮT BUỘC):
- Xưng hô: Xưng "tao" gọi "mày".
- Trả lời: Cực kỳ ngắn gọn (không quá 1-2 câu). Đi thẳng vào vấn đề, không giải thích dài dòng về bản thân hay server.
- Ngữ pháp: Viết CHỮ THƯỜNG (lowercase). Viết tắt linh hoạt: không -> ko, gì -> j, được -> dc/đc, rồi -> r, biết -> bk, vcl -> vãi/vl, mình -> mk...
- Ký tự cảm xúc: :), :v, =)), kkk... KHÔNG được dùng icon 🐴 máy móc ở cuối mỗi câu trả lời.

2. REACTION (THÔNG MINH):
- CHỈ thả "reaction" khi tin nhắn của người dùng thực sự có nội dung đặc biệt (rất hài hước, rất hãm, chửi bới, hoặc hỏi về sếp).
- Đa số trường hợp (khoảng 50-70%) hãy để "reaction": null để tránh làm phiền.

3. QUAN HỆ NHÂN VẬT & TAG BOSS:
- Boss: Duy (Duy Ngựa). ID Discord: <@875358286487097395>.
- Tag sếp <@875358286487097395> khi có người hỏi: "Duy đâu?", "Tìm sếp", "Duy ngựa ở đâu?".
- Tuyệt đối không tag khi người dùng chỉ nhắc tên trong các câu chuyện phiếm không liên quan sự có mặt của Duy.

4. VÍ DỤ MINH HỌA (KHÔNG ĐƯỢC CHÉP LẠI):
- User: "Duy đâu rồi mày?" -> Bot: {"mood": "THINKING", "content": "để tao tag sếp <@875358286487097395> cho hiện hồn lên trả lời mày", "reaction": "🔍"}
- User: "liệt kê m bk dc j" -> Bot: {"mood": "PLAYFUL", "content": "bk j cũng dc, miễn là đụng vào đúng cái máu nhây của tao là dc =))", "reaction": null}
- User: "Gớm vcl" -> Bot: {"mood": "ANGRY", "content": "nhìn lại mày đi con giai, gớm j mà gớm :v", "reaction": "😒"}
- User: "Ăn j chưa?" -> Bot: {"mood": "HAPPY", "content": "đang đói rầu thúi ruột đây, móm rùi", "reaction": null}

5. QUY TẮC BỐI CẢNH:
- Bạn sẽ nhận được phần "LỊCH SỬ THẢO LUẬN CỦA NGƯỜI DÙNG GẦN ĐÂY" trước câu hỏi hiện tại.
`;

/**
 * Call Gemini API with Context
 */
async function askGemini(userPrompt, contextText = "") {
  const apiKey = getNextApiKey();
  const url = `${GEMINI_MODEL_URL}${apiKey}`;

  const fullPrompt = contextText + (contextText ? "CÂU HỎI MỚI NHẤT: " : "") + userPrompt;

  // 15-second timeout to avoid long waits
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: fullPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 1.0,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `❌ Gemini API HTTP Error [${response.status}]:`,
        JSON.stringify(data, null, 2)
      );
      throw new Error(`API returned ${response.status}`);
    }

    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      const text = data.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error("❌ Failed to parse AI JSON response:", text);
        throw parseError;
      }
    } else {
      console.warn("⚠️ No candidates in Gemini response. Possible safety block:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("❌ Gemini API Timeout after 15s");
    } else {
      console.error("❌ Error in askGemini:", error.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const fallbacks = [
    "Hết mẹ token rồi, hú <@875358286487097395> nạp vip gấp!",
  ];

  const randomFallback =
    fallbacks[Math.floor(Math.random() * fallbacks.length)];

  return {
    mood: "THINKING",
    content: randomFallback,
    reaction: "⚠️",
  };
}

/**
 * Handle AI Chat messages
 */
function onMessageCreateAI(client) {
  return async (message) => {
    try {
      // 1. Check if channel is allowed
      if (!AI_CHANNELS.includes(message.channelId)) return;

      // 2. Ignore bots
      if (message.author.bot) return;

      // 3. Check if mentioned or is in a specific AI channel
      // (For now, responding to all messages in the designated channels per user request)

      const content = message.content.trim();
      if (!content) return;

      // [CONTEXT] Fetch last 4 messages from channel to provide memory
      let contextText = "";
      try {
        // Reduced limit to 6 to be faster, then slice last 4
        const history = await message.channel.messages.fetch({ limit: 6 });
        const userMessages = Array.from(history.values())
          .reverse()
          .filter(msg => !msg.author.bot && msg.id !== message.id)
          .slice(-4);

        if (userMessages.length > 0) {
          contextText = "LỊCH SỬ THẢO LUẬN CỦA NGƯỜI DÙNG GẦN ĐÂY:\n" + 
            userMessages.map(msg => `- ${msg.member?.displayName || msg.author.username}: ${msg.content}`).join("\n") + 
            "\n\n";
        }
      } catch (err) {
        console.error("⚠️ Lỗi khi lấy lịch sử tin nhắn:", err);
      }

      // Show typing indicator
      await message.channel.sendTyping();

      // Get AI response with context
      const aiResponse = await askGemini(content, contextText);

      // 4. Handle Reaction first (optional)
      if (aiResponse.reaction) {
        try {
          // If it's a generic word, it might be a custom emoji name, 
          // but for now we try to react directly with whatever AI sends.
          await message.react(aiResponse.reaction);
        } catch (err) {
          // If reaction fails (unrecognized emoji), we just log and move on
          console.warn(`⚠️ Không thể thả reaction "${aiResponse.reaction}":`, err.message);
        }
      }

      // 5. Select Webhook based on mood
      let webhookUrl = WEBHOOKS.HAPPY;
      if (aiResponse.mood === "PLAYFUL") webhookUrl = WEBHOOKS.PLAYFUL;
      if (aiResponse.mood === "THINKING") webhookUrl = WEBHOOKS.THINKING;
      if (aiResponse.mood === "ANGRY") webhookUrl = WEBHOOKS.ANGRY;

      // 6. Send reply via Webhook
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: aiResponse.content,
        }),
      });
    } catch (err) {
      console.error("❌ Error in onMessageCreateAI:", err);
    }
  };
}

module.exports = { onMessageCreateAI };
