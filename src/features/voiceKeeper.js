// src/features/voiceKeeper.js
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require("@discordjs/voice");
const { Events } = require("discord.js");
const {
  KEEP_VOICE_CHANNEL_ID,
  ENABLE_VOICE_KEEPER,
  ALLOWED_GUILD_IDS,
  MUSIC_BOT_IDS,
} = require("../config/env");

let currentConnection = null;
let debounceTimer = null;
let isJoining = false;

const status = {
  enabled: ENABLE_VOICE_KEEPER,
  state: "initializing", // 'initializing' | 'idle' | 'holding_room' | 'disconnected' | 'error'
  targetChannelId: KEEP_VOICE_CHANNEL_ID,
  channelName: "N/A",
  humanCount: 0,
  hasMusicBot: false,
  shouldHoldRoom: false,
  isHolding: false,
  lastEvaluatedAt: null,
  lastConnectedAt: null,
  lastActionReason: null,
  lastError: null,
};

/**
 * Returns current voice keeper status for web monitoring / API
 */
function getVoiceKeeperStatus() {
  return {
    ...status,
    connectionState: currentConnection ? currentConnection.state.status : "destroyed",
  };
}

/**
 * Evaluates the target voice channel and determines whether to join or leave.
 * @param {import("discord.js").Guild} guild
 * @param {string} reason
 */
async function evaluateVoiceRoom(guild, reason = "unknown") {
  if (!ENABLE_VOICE_KEEPER) {
    status.state = "disabled";
    return;
  }

  if (!guild || !KEEP_VOICE_CHANNEL_ID) return;

  try {
    const channel =
      guild.channels.cache.get(KEEP_VOICE_CHANNEL_ID) ||
      (await guild.channels.fetch(KEEP_VOICE_CHANNEL_ID).catch(() => null));

    if (!channel || !channel.isVoiceBased()) {
      status.state = "error";
      status.lastError = `Kênh voice ID ${KEEP_VOICE_CHANNEL_ID} không tìm thấy hoặc không phải kênh voice.`;
      return;
    }

    status.channelName = channel.name;
    status.targetChannelId = channel.id;

    // Filter humans (non-bot members) in the voice channel
    const humanMembers = channel.members.filter((member) => !member.user.bot);
    const humanCount = humanMembers.size;

    // Check if Music Bot (Anna Music) is currently in the channel
    const monitoredMusicBots = (MUSIC_BOT_IDS && MUSIC_BOT_IDS.length > 0)
      ? MUSIC_BOT_IDS
      : ["1542863465335492640"];
    const hasMusicBot = channel.members.some((member) => monitoredMusicBots.includes(member.id));

    // =========================================================================
    // QUY TẮC BẢO VỆ PHÒNG (AVOID ROOM RESET):
    // 1. Nếu KHÔNG CÓ Bot Nhạc (!hasMusicBot):
    //    Bot phụ PHẢI LUÔN Ở TRONG PHÒNG giữ chỗ (bất kể có bao nhiêu người thật).
    // 2. Nếu CÓ Bot Nhạc (hasMusicBot):
    //    - humanCount <= 1 (0 hoặc 1 người): Bot phụ VẪN Ở TRONG PHÒNG cùng bot nhạc
    //      để nếu người này out hoặc bot nhạc bị dis thì phòng không bao giờ rơi về 0 thành viên.
    //    - humanCount >= 2: Đã có đủ ít nhất 2 người thật + bot nhạc -> Bot phụ rời phòng nhường chỗ!
    // -> Điều kiện giữ phòng: shouldHoldRoom = !hasMusicBot || humanCount < 2;
    // =========================================================================
    const shouldHoldRoom = !hasMusicBot || humanCount < 2;

    status.humanCount = humanCount;
    status.hasMusicBot = hasMusicBot;
    status.shouldHoldRoom = shouldHoldRoom;
    status.lastEvaluatedAt = new Date().toISOString();
    status.lastActionReason = reason;

    const botIsInside = channel.members.has(guild.client.user.id);

    // =========================================================================
    // CASE 1: CẦN GIỮ PHÒNG (shouldHoldRoom === true)
    // -> Bot phụ kết nối hoặc duy trì ở trong phòng (Self-Deaf & Self-Mute)
    // =========================================================================
    if (shouldHoldRoom) {
      if (!botIsInside && !isJoining) {
        console.log(
          `[VoiceKeeper] 🛡️ Cần giữ phòng "${channel.name}" (humans: ${humanCount}, musicBot: ${hasMusicBot ? "Có" : "Không"}). Bot phụ bắt đầu kết nối... (Lý do: ${reason})`
        );
        isJoining = true;
        status.state = "connecting";

        try {
          // Check if an old connection exists and clean it up
          const existingConn = getVoiceConnection(guild.id);
          if (existingConn && existingConn.state.status !== VoiceConnectionStatus.Destroyed) {
            existingConn.destroy();
          }

          currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true,
          });

          currentConnection.on(VoiceConnectionStatus.Ready, () => {
            isJoining = false;
            status.state = "holding_room";
            status.isHolding = true;
            status.lastConnectedAt = new Date().toISOString();
            status.lastError = null;
            console.log(
              `[VoiceKeeper] 🟢 Đã kết nối vào "${channel.name}" thành công! Đang giữ phòng (Self-Deaf & Self-Mute, humans: ${status.humanCount}, musicBot: ${status.hasMusicBot ? "Có" : "Không"}).`
            );
          });

          currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
              await Promise.race([
                entersState(currentConnection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(currentConnection, VoiceConnectionStatus.Connecting, 5_000),
              ]);
            } catch {
              console.warn(`[VoiceKeeper] ⚠️ Mất kết nối voice, đang dọn dẹp để kết nối lại...`);
              if (currentConnection) {
                currentConnection.destroy();
                currentConnection = null;
              }
              status.state = "disconnected";
              status.isHolding = false;
              isJoining = false;

              // Retry after 3 seconds if room still needs holding
              setTimeout(() => {
                evaluateVoiceRoom(guild, "reconnect_after_disconnect");
              }, 3000);
            }
          });

          currentConnection.on(VoiceConnectionStatus.Destroyed, () => {
            currentConnection = null;
            isJoining = false;
            status.isHolding = false;
          });
        } catch (err) {
          isJoining = false;
          status.state = "error";
          status.isHolding = false;
          status.lastError = err.message;
          console.error(`[VoiceKeeper] ❌ Lỗi kết nối voice:`, err.message);
        }
      } else if (botIsInside) {
        status.state = "holding_room";
        status.isHolding = true;
      }
    }

    // =========================================================================
    // CASE 2: KHÔNG CẦN GIỮ PHÒNG (shouldHoldRoom === false)
    // -> Đã có Bot Nhạc + từ 2 người thật trở lên, bot phụ rời đi nhường chỗ
    // =========================================================================
    else {
      if (botIsInside || currentConnection) {
        console.log(
          `[VoiceKeeper] 👋 Phòng "${channel.name}" đã an toàn (có Bot Nhạc + ${humanCount} người thật >= 2). Bot phụ rời phòng nhường chỗ!`
        );

        if (currentConnection) {
          try {
            currentConnection.destroy();
          } catch (destroyErr) {
            console.warn(`[VoiceKeeper] Warning when destroying connection:`, destroyErr.message);
          }
          currentConnection = null;
        }

        // Double check getVoiceConnection
        const existingConn = getVoiceConnection(guild.id);
        if (existingConn) {
          try {
            existingConn.destroy();
          } catch (_) {}
        }

        isJoining = false;
        status.state = "idle";
        status.isHolding = false;
        status.lastError = null;
      } else {
        status.state = "idle";
        status.isHolding = false;
      }
    }
  } catch (err) {
    status.state = "error";
    status.lastError = err.message;
    console.error(`[VoiceKeeper] ❌ Lỗi kiểm tra phòng voice:`, err);
  }
}

/**
 * Initializes the Voice Keeper feature
 * @param {import("discord.js").Client} client
 */
function initVoiceKeeper(client) {
  if (!ENABLE_VOICE_KEEPER) {
    console.log(`[VoiceKeeper] ⏸️ Tính năng Giữ Phòng Voice đang bị TẮT (ENABLE_VOICE_KEEPER=false).`);
    status.state = "disabled";
    return;
  }

  const primaryGuildId = (ALLOWED_GUILD_IDS && ALLOWED_GUILD_IDS[0]) || "1389834422773219338";

  console.log(
    `[VoiceKeeper] 🛡️ Kích hoạt tính năng Giữ Phòng Voice: Kênh <#${KEEP_VOICE_CHANNEL_ID}> (Guild: ${primaryGuildId})`
  );

  // Helper to fetch target guild
  const getTargetGuild = async () => {
    return (
      client.guilds.cache.get(primaryGuildId) ||
      (await client.guilds.fetch(primaryGuildId).catch(() => null))
    );
  };

  // 1. Initial check when client is ready (delayed 3s to ensure full guild cache)
  setTimeout(async () => {
    const guild = await getTargetGuild();
    if (guild) {
      await evaluateVoiceRoom(guild, "client_ready_startup");
    } else {
      console.warn(`[VoiceKeeper] ⚠️ Không tìm thấy Server với ID ${primaryGuildId}`);
    }
  }, 3000);

  // 2. Listen to Voice State Updates (members joining/leaving/switching voice)
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Check if the event relates to our target voice channel
    const isTargetChannel =
      oldState.channelId === KEEP_VOICE_CHANNEL_ID ||
      newState.channelId === KEEP_VOICE_CHANNEL_ID;

    if (!isTargetChannel) return;

    // Kiểm tra loại sự kiện: Nếu có ai đó (người hoặc bot nhạc) rời khỏi phòng mục tiêu
    // -> Cần phản ứng nhanh (600ms) để giữ phòng kịp thời, không bị hở thời gian
    const isLeaveEvent =
      oldState.channelId === KEEP_VOICE_CHANNEL_ID &&
      newState.channelId !== KEEP_VOICE_CHANNEL_ID;
    const debounceMs = isLeaveEvent ? 600 : 1200;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const guild = newState.guild || oldState.guild || (await getTargetGuild());
      if (guild) {
        await evaluateVoiceRoom(guild, `voice_state_update:${isLeaveEvent ? "member_left" : "state_changed"}`);
      }
    }, debounceMs);
  });

  // 3. Periodic sanity check every 3 minutes (in case an event was missed)
  setInterval(async () => {
    const guild = await getTargetGuild();
    if (guild) {
      await evaluateVoiceRoom(guild, "periodic_sanity_check");
    }
  }, 3 * 60 * 1000);
}

module.exports = {
  initVoiceKeeper,
  getVoiceKeeperStatus,
  evaluateVoiceRoom,
};
