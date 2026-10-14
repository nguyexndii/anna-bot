// src/utils/emojiHelper.js

/**
 * Bảng ID thực tế 100% của 71 Application Emojis người dùng đã tải lên tài khoản bot Anna Yanami
 */
const EMOJI_MAP = {
  // --- GENSHIN IMPACT ---
  genshin_logo: { id: "1559502726985949184", name: "Genshin_Impact" },
  gi_logo: { id: "1559502726985949184", name: "Genshin_Impact" },
  gi_bell: { id: "1559620973899157564", name: "genshin_ui_bell" },
  genshin_ui_bell: { id: "1559620973899157564", name: "genshin_ui_bell" },
  gi_calendar: { id: "1559620976038383649", name: "genshin_ui_calendar" },
  genshin_ui_calendar: { id: "1559620976038383649", name: "genshin_ui_calendar" },
  gi_gift: { id: "1559620978378801174", name: "genshin_ui_gift" },
  genshin_ui_gift: { id: "1559620978378801174", name: "genshin_ui_gift" },
  gi_mail: { id: "1559620980538744885", name: "genshin_ui_mail" },
  genshin_ui_mail: { id: "1559620980538744885", name: "genshin_ui_mail" },
  gi_map: { id: "1559620982644412531", name: "genshin_ui_map" },
  genshin_ui_map: { id: "1559620982644412531", name: "genshin_ui_map" },
  gi_qol: { id: "1559620985043288204", name: "genshin_ui_qol" },
  genshin_ui_qol: { id: "1559620985043288204", name: "genshin_ui_qol" },
  gi_primo: { id: "1559620999396331640", name: "gi_primogem" },
  gi_primogem: { id: "1559620999396331640", name: "gi_primogem" },
  gi_intertwined: { id: "1559620995411877918", name: "gi_intertwined_fate" },
  gi_intertwined_fate: { id: "1559620995411877918", name: "gi_intertwined_fate" },
  gi_acquaint: { id: "1559620987123671142", name: "gi_acquaint_fate" },
  gi_acquaint_fate: { id: "1559620987123671142", name: "gi_acquaint_fate" },
  gi_mora: { id: "1559620997286465628", name: "gi_mora" },
  gi_crown: { id: "1559620989229465730", name: "gi_crown" },
  gi_resin: { id: "1559621001333968976", name: "gi_resin" },
  gi_fragile_resin: { id: "1559620991372496936", name: "gi_fragile_resin" },
  gi_genesis: { id: "1559620993394286703", name: "gi_genesis_crystal" },
  gi_starglitter: { id: "1559621003351556208", name: "gi_starglitter" },

  // --- HONKAI: STAR RAIL ---
  hsr_logo: { id: "1559502723148415096", name: "Honkai_Star_Rail_App" },
  hsr_bell: { id: "1559621047756529745", name: "hsr_ui_bell" },
  hsr_ui_bell: { id: "1559621047756529745", name: "hsr_ui_bell" },
  hsr_calendar: { id: "1559621060159078410", name: "hsr_ui_calendar" },
  hsr_ui_calendar: { id: "1559621060159078410", name: "hsr_ui_calendar" },
  hsr_gift: { id: "1559621063019725001", name: "hsr_ui_gift" },
  hsr_ui_gift: { id: "1559621063019725001", name: "hsr_ui_gift" },
  hsr_mail: { id: "1559621064907165836", name: "hsr_ui_mail" },
  hsr_ui_mail: { id: "1559621064907165836", name: "hsr_ui_mail" },
  hsr_map: { id: "1559621067201445899", name: "hsr_ui_map" },
  hsr_ui_map: { id: "1559621067201445899", name: "hsr_ui_map" },
  hsr_qol: { id: "1559621069244076202", name: "hsr_ui_qol" },
  hsr_ui_qol: { id: "1559621069244076202", name: "hsr_ui_qol" },
  hsr_jade: { id: "1559621041226252419", name: "hsr_stellar_jade" },
  hsr_stellar_jade: { id: "1559621041226252419", name: "hsr_stellar_jade" },
  hsr_special_pass: { id: "1559621039280095362", name: "hsr_special_pass" },
  hsr_pass: { id: "1559621034456387625", name: "hsr_pass" },
  hsr_credit: { id: "1559621028190363669", name: "hsr_credit" },
  hsr_power: { id: "1559621045613367326", name: "hsr_trailblaze_power" },
  hsr_fuel: { id: "1559621030270476459", name: "hsr_fuel" },
  hsr_oneiric: { id: "1559621032212430898", name: "hsr_oneiric_shard" },
  hsr_resin: { id: "1559621037111644222", name: "hsr_resin" },
  hsr_tracks: { id: "1559621043654500423", name: "hsr_tracks_of_destiny" },
  hsr_starlight: { id: "1559621071496282243", name: "hsr_undying_starlight" },

  // --- ZENLESS ZONE ZERO ---
  zzz_logo: { id: "1559502720879173633", name: "Zenless_Zone_Zero_App_Icon" },
  zzz_bell: { id: "1559621229844103329", name: "zzz_ui_bell" },
  zzz_ui_bell: { id: "1559621229844103329", name: "zzz_ui_bell" },
  zzz_calendar: { id: "1559621232331071628", name: "zzz_ui_calendar" },
  zzz_ui_calendar: { id: "1559621232331071628", name: "zzz_ui_calendar" },
  zzz_gift: { id: "1559621234428215316", name: "zzz_ui_gift" },
  zzz_ui_gift: { id: "1559621234428215316", name: "zzz_ui_gift" },
  zzz_mail: { id: "1559621236777156849", name: "zzz_ui_mail" },
  zzz_ui_mail: { id: "1559621236777156849", name: "zzz_ui_mail" },
  zzz_map: { id: "1559621238811271261", name: "zzz_ui_map" },
  zzz_ui_map: { id: "1559621238811271261", name: "zzz_ui_map" },
  zzz_qol: { id: "1559621240677736548", name: "zzz_ui_qol" },
  zzz_ui_qol: { id: "1559621240677736548", name: "zzz_ui_qol" },
  zzz_poly: { id: "1559621225410465893", name: "zzz_polychrome" },
  zzz_polychrome: { id: "1559621225410465893", name: "zzz_polychrome" },
  zzz_encrypted_tape: { id: "1559621197233135809", name: "zzz_encrypted_tape" },
  zzz_master_tape: { id: "1559621220637474906", name: "zzz_master_tape" },
  zzz_tape: { id: "1559621220637474906", name: "zzz_master_tape" },
  zzz_denny: { id: "1559621194603560990", name: "zzz_denny" },
  zzz_boopon: { id: "1559621192242040842", name: "zzz_boopon" },
  zzz_battery: { id: "1559621189566206033", name: "zzz_battery" },
  zzz_ether_battery: { id: "1559621214064869448", name: "zzz_ether_battery" },
  zzz_monochrome: { id: "1559621222487302205", name: "zzz_monochrome" },
  zzz_hamster: { id: "1559621218292867093", name: "zzz_hamster_cage" },
  zzz_signal: { id: "1559621227746828398", name: "zzz_residual_signal" },

  // --- WUTHERING WAVES ---
  wuwa_logo: { id: "1536322393411424286", name: "wutheringwave" },
  wuwa_bell: { id: "1559621127574392892", name: "wuwa_ui_bell" },
  wuwa_ui_bell: { id: "1559621127574392892", name: "wuwa_ui_bell" },
  wuwa_calendar: { id: "1559621143428857866", name: "wuwa_ui_calendar" },
  wuwa_ui_calendar: { id: "1559621143428857866", name: "wuwa_ui_calendar" },
  wuwa_gift: { id: "1559621145224028201", name: "wuwa_ui_gift" },
  wuwa_ui_gift: { id: "1559621145224028201", name: "wuwa_ui_gift" },
  wuwa_mail: { id: "1559621146989564005", name: "wuwa_ui_mail" },
  wuwa_ui_mail: { id: "1559621146989564005", name: "wuwa_ui_mail" },
  wuwa_map: { id: "1559621149057351740", name: "wuwa_ui_map" },
  wuwa_ui_map: { id: "1559621149057351740", name: "wuwa_ui_map" },
  wuwa_qol: { id: "1559621152777699390", name: "wuwa_ui_qol" },
  wuwa_ui_qol: { id: "1559621152777699390", name: "wuwa_ui_qol" },
  wuwa_astrite: { id: "1559621106606800916", name: "wuwa_astrite" },
  wuwa_radiant: { id: "1559621119735107604", name: "wuwa_radiant_tide" },
  wuwa_radiant_tide: { id: "1559621119735107604", name: "wuwa_radiant_tide" },
  wuwa_forging: { id: "1559621113103913060", name: "wuwa_forging_tide" },
  wuwa_forging_tide: { id: "1559621113103913060", name: "wuwa_forging_tide" },
  wuwa_lustrous: { id: "1559621117344481301", name: "wuwa_lustrous_tide" },
  wuwa_lustrous_tide: { id: "1559621117344481301", name: "wuwa_lustrous_tide" },
  wuwa_shell: { id: "1559621121962283060", name: "wuwa_shell_credit" },
  wuwa_shell_credit: { id: "1559621121962283060", name: "wuwa_shell_credit" },
  wuwa_waveplate: { id: "1559621155009200128", name: "wuwa_waveplate" },
  wuwa_tuner: { id: "1559621124344778853", name: "wuwa_tuner" },
  wuwa_solvent: { id: "1559621110964682802", name: "wuwa_crystal_solvent" },
  wuwa_coral: { id: "1559621108465012737", name: "wuwa_coral" },
  wuwa_lunite: { id: "1559621115800850472", name: "wuwa_lunite" },

  // --- ARKNIGHTS: ENDFIELD ---
  endfield_logo: { id: "1559620933579178055", name: "ef_logo" },
  ef_logo: { id: "1559620933579178055", name: "ef_logo" },
  endfield_oroberyl: { id: "1559620935596769460", name: "ef_oroberyl" },
  ef_oroberyl: { id: "1559620935596769460", name: "ef_oroberyl" },
  endfield_bell: { id: "1559620937530216558", name: "endfield_ui_bell" },
  ef_bell: { id: "1559620937530216558", name: "endfield_ui_bell" },
  endfield_ui_bell: { id: "1559620937530216558", name: "endfield_ui_bell" },
  endfield_calendar: { id: "1559620939254079580", name: "endfield_ui_calendar" },
  ef_calendar: { id: "1559620939254079580", name: "endfield_ui_calendar" },
  endfield_ui_calendar: { id: "1559620939254079580", name: "endfield_ui_calendar" },
  endfield_gift: { id: "1559620941204422758", name: "endfield_ui_gift" },
  ef_gift: { id: "1559620941204422758", name: "endfield_ui_gift" },
  endfield_ui_gift: { id: "1559620941204422758", name: "endfield_ui_gift" },
  endfield_mail: { id: "1559620943272484894", name: "endfield_ui_mail" },
  ef_mail: { id: "1559620943272484894", name: "endfield_ui_mail" },
  endfield_ui_mail: { id: "1559620943272484894", name: "endfield_ui_mail" },
  endfield_map: { id: "1559620945096999102", name: "endfield_ui_map" },
  ef_map: { id: "1559620945096999102", name: "endfield_ui_map" },
  endfield_ui_map: { id: "1559620945096999102", name: "endfield_ui_map" },
  endfield_qol: { id: "1559620947147755580", name: "endfield_ui_qol" },
  ef_qol: { id: "1559620947147755580", name: "endfield_ui_qol" },
  endfield_ui_qol: { id: "1559620947147755580", name: "endfield_ui_qol" },
};

/**
 * Nạp Application Emojis vào bộ nhớ cache Discord.js khi bot login
 * @param {import("discord.js").Client} client
 */
async function loadApplicationEmojis(client) {
  if (!client || !client.application) return;
  try {
    const fetched = await client.application.emojis.fetch();
    console.log(`🎨 [EmojiHelper] Đã tải thành công ${fetched.size} Custom Application Emojis vào bộ nhớ cache!`);
  } catch (err) {
    console.warn("[EmojiHelper] Không thể fetch application emojis:", err.message);
  }
}

/**
 * Lấy Custom Emoji theo tên, ưu tiên ID chuẩn thực tế trên tài khoản bot
 * @param {import("discord.js").Client} [client]
 * @param {string} emojiName Tên emoji (ví dụ: 'gi_primo', 'hsr_jade', 'wuwa_gift'...)
 * @param {string} [fallbackEmoji=""] Ký tự emoji dự phòng (ví dụ: '🎁', '💎'...)
 * @returns {string} Chuỗi format emoji Discord `<:name:id>`
 */
function getGameEmoji(client, emojiName, fallbackEmoji = "") {
  if (!emojiName) return fallbackEmoji;

  const cleanName = emojiName.trim().toLowerCase();

  // 1. Kiểm tra trong bảng EMOJI_MAP tĩnh chính xác 100%
  if (EMOJI_MAP[cleanName]) {
    const item = EMOJI_MAP[cleanName];
    return `<:${item.name}:${item.id}>`;
  }

  // 2. Tìm kiếm linh hoạt trong cache Application Emojis nếu có client
  if (client) {
    const appEmoji = client.application?.emojis?.cache?.find(
      (e) => e.name.toLowerCase() === cleanName || e.name.toLowerCase().includes(cleanName)
    );
    if (appEmoji) {
      return `<:${appEmoji.name}:${appEmoji.id}>`;
    }

    // 3. Tìm kiếm trong Server Emojis
    const guildEmoji = client.emojis?.cache?.find(
      (e) => e.name.toLowerCase() === cleanName || e.name.toLowerCase().includes(cleanName)
    );
    if (guildEmoji) {
      return `<:${guildEmoji.name}:${guildEmoji.id}>`;
    }
  }

  return fallbackEmoji;
}

module.exports = {
  getGameEmoji,
  loadApplicationEmojis,
  EMOJI_MAP,
};
