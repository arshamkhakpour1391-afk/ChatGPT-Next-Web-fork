/* قوانین اقتصاد — همان فرمول در SQL (apply_play / claim_reward)
   طلا از Save ساخته نمی‌شود. هر جایزه claim_id یک‌بارمصرف دارد. */
export const GOLD_ABS_CAP = 1000000000000;
export const GEMS_ABS_CAP = 1000000;
export const TRAIN_CLICKS_PER_CALL = 120;
export const TRAIN_CLICKS_PER_HOUR = 4800;
export const DUNGEON_PER_HOUR = 24;
export const BOSS_PER_HOUR = 40;
export const SAVE_MIN_MS = 1500;

export function sanitizeClaimId(s) {
  const t = String(s || "").trim();
  if (t.length < 8 || t.length > 80) return null;
  if (!/^[a-zA-Z0-9:_-]+$/.test(t)) return null;
  return t;
}

export function trainGoldForClicks(level, n) {
  const lv = Math.max(1, Math.min(10000, Number(level) || 1));
  const clicks = Math.max(0, Math.min(TRAIN_CLICKS_PER_CALL, Math.floor(Number(n) || 0)));
  const per = Math.max(1, Math.floor(1 + lv * 0.2));
  return Math.floor(clicks / 4) * per;
}

export function trainXpForClicks(n) {
  const clicks = Math.max(0, Math.min(TRAIN_CLICKS_PER_CALL, Math.floor(Number(n) || 0)));
  return clicks;
}

export function rankMultForLevel(level) {
  const lv = Math.max(1, level || 1);
  if (lv >= 8000) return 12000;
  if (lv >= 5000) return 8000;
  if (lv >= 2500) return 5000;
  if (lv >= 1000) return 3000;
  if (lv >= 651) return 550;
  if (lv >= 401) return 250;
  if (lv >= 251) return 115;
  if (lv >= 151) return 52;
  if (lv >= 101) return 24;
  if (lv >= 61) return 11;
  if (lv >= 31) return 5;
  if (lv >= 11) return 2.2;
  return 1;
}

export function dungeonGoldCap(playerLevel, index) {
  const i = Math.max(0, Math.min(9999, Math.floor(Number(index) || 0)));
  const dLevel = Math.min(10000, i + 1);
  if ((playerLevel || 1) < dLevel) return 0;
  const gold = Math.floor(28 * Math.pow(dLevel, 1.8) * rankMultForLevel(dLevel) * 1.2);
  return Math.min(gold, 800000);
}

export function bossGoldCap(playerLevel, index) {
  const i = Math.max(0, Math.min(9999, Math.floor(Number(index) || 0)));
  const bLevel = Math.min(10000, i + 1);
  if ((playerLevel || 1) + 15 < bLevel) return 0;
  const gold = Math.floor(60 * Math.pow(bLevel, 1.85) * rankMultForLevel(bLevel) * 1.2);
  return Math.min(gold, 1200000);
}

export function hourlyGoldCap(level) {
  const lv = Math.max(1, Math.min(10000, Number(level) || 1));
  const train = Math.floor(TRAIN_CLICKS_PER_HOUR / 4) * Math.max(1, Math.floor(1 + lv * 0.2));
  const content = DUNGEON_PER_HOUR * dungeonGoldCap(lv, Math.min(lv - 1, 9999)) * 0.15;
  return Math.floor(train + Math.min(content, 2e6) + 500 + lv * 40);
}

export function missionGoldCap(level) {
  const lv = Math.max(1, Math.min(10000, Number(level) || 1));
  return Math.floor((120 + 300) * (1 + Math.floor(lv / 80)) * 2);
}

export function dailyGoldCap(level) {
  return 200 + Math.max(1, Math.min(10000, Number(level) || 1)) * 40;
}

export function duelGoldCap(level) {
  return 100 + Math.max(1, Math.min(10000, Number(level) || 1)) * 35;
}

export function applyPlayGrant(input) {
  const kind = String(input.kind || "");
  const claimId = sanitizeClaimId(input.claimId);
  if (!claimId) return { error: "claim_id نامعتبر" };
  if (input.prevClaims && input.prevClaims.has(claimId)) {
    return { error: "already", already: true, gold: 0, xp: 0 };
  }
  const level = Math.max(1, Math.min(10000, Number(input.level) || 1));
  const windowGold = Math.max(0, Number(input.windowGold) || 0);
  const capH = hourlyGoldCap(level);
  if (windowGold > capH) return { error: "سقف ساعتی طلا" };

  let gold = 0, xp = 0;
  if (kind === "train") {
    const n = Math.max(0, Math.min(TRAIN_CLICKS_PER_CALL, Math.floor(Number(input.n) || 0)));
    if (n < 1) return { error: "کلیک نامعتبر" };
    const wClicks = Math.max(0, Number(input.windowClicks) || 0);
    if (wClicks + n > TRAIN_CLICKS_PER_HOUR) return { error: "سقف کلیک ساعتی" };
    gold = trainGoldForClicks(level, n);
    xp = trainXpForClicks(n);
  } else if (kind === "dungeon" || kind === "sweep") {
    const wD = Math.max(0, Number(input.windowDungeons) || 0);
    if (wD >= DUNGEON_PER_HOUR) return { error: "سقف دانجن ساعتی" };
    gold = dungeonGoldCap(level, input.index);
    xp = Math.floor(gold * 1.4);
    if (!gold) return { error: "سطح کافی نیست" };
    if (kind === "sweep") { gold = Math.floor(gold * 0.72); xp = Math.floor(xp * 0.72); }
  } else if (kind === "boss") {
    const wB = Math.max(0, Number(input.windowBosses) || 0);
    if (wB >= BOSS_PER_HOUR) return { error: "سقف باس ساعتی" };
    gold = bossGoldCap(level, input.index);
    xp = Math.floor(gold * 1.3);
    if (!gold) return { error: "سطح کافی نیست" };
  } else {
    return { error: "نوع نامعتبر" };
  }
  if (!Number.isFinite(gold) || gold < 0 || !Number.isFinite(xp) || xp < 0) {
    return { error: "مقدار نامعتبر" };
  }
  if (windowGold + gold > capH) gold = Math.max(0, capH - windowGold);
  return { ok: true, gold, xp, claimId, kind };
}

export function applyClaimGrant(input) {
  const kind = String(input.kind || "");
  const claimId = sanitizeClaimId(input.claimId);
  if (!claimId) return { error: "claim_id نامعتبر" };
  if (input.prevClaims && input.prevClaims.has(claimId)) return { error: "already", already: true, gold: 0 };
  const level = Math.max(1, Math.min(10000, Number(input.level) || 1));
  let gold = 0, gems = 0, xp = 0;
  if (kind === "mission") gold = missionGoldCap(level);
  else if (kind === "daily") { gold = dailyGoldCap(level); gems = 1; xp = 300 + level * 60; }
  else if (kind === "year") { gold = 300 + level * 25; gems = 1; xp = 500 + level * 40; }
  else if (kind === "login") { gold = 80 + 25 + level * 10; xp = 120 + 20 + level * 8; }
  else if (kind === "duel") gold = duelGoldCap(level);
  else return { error: "نوع نامعتبر" };
  const windowGold = Math.max(0, Number(input.windowGold) || 0);
  if (windowGold + gold > hourlyGoldCap(level) * 2) return { error: "سقف ساعتی طلا" };
  return { ok: true, gold, gems, xp, claimId, kind };
}

export function stripClientEconomy(data) {
  if (!data || typeof data !== "object") return {};
  const copy = { ...data };
  delete copy.gold;
  delete copy.xp;
  delete copy.level;
  delete copy.gems;
  delete copy.power;
  delete copy.rank_pts;
  if (copy.stats && typeof copy.stats === "object") {
    copy.stats = { ...copy.stats };
    delete copy.stats.wins;
    delete copy.stats.losses;
    delete copy.stats.kills;
    delete copy.stats.goldEarned;
  }
  return copy;
}

export function overlayServerEconomy(st, row) {
  if (!st || !row) return st;
  if (row.gold != null) st.gold = Number(row.gold);
  if (row.xp != null) st.xp = Number(row.xp);
  if (row.level != null) st.level = Number(row.level);
  if (row.gems != null) st.gems = Number(row.gems);
  if (row.rank_pts != null) st.rank_pts = Number(row.rank_pts);
  if (row.wins != null) { st.stats = st.stats || {}; st.stats.wins = Number(row.wins); }
  if (row.losses != null) { st.stats = st.stats || {}; st.stats.losses = Number(row.losses); }
  if (row.kills != null) { st.stats = st.stats || {}; st.stats.kills = Number(row.kills); }
  return st;
}

export function rejectBadNumber(n) {
  const x = Number(n);
  return !Number.isFinite(x) || Number.isNaN(x);
}
