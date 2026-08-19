/* ================= موتور بازی (منطق خالص — بدون DOM) ================= */
import {
  mulberry32, seedOf, pick, range, hashStr, todayKey, weekKey, deepClone, clamp, nowMs, fmt, keyToMs
} from "./util.js";
import {
  rankOfLevel, hunterClass, dungeonIndex, bossIndex, skillIndex,
  SHOP_ITEMS, itemById, itemByName, missionOf, MISSION_SLOTS, MISSION_INTERVAL_MS,
  yearQuestDay, dailyPicks, randomTitle, randomWeapon, YEAR_DAYS, TITLES
} from "./data.js";

export const STATE_VERSION = 4;

export function migrateState(st) {
  if (!st || typeof st !== "object") return st;
  st.v = STATE_VERSION;
  if (st.gold == null) st.gold = 0;
  if (st.rank_pts == null) st.rank_pts = 1000;
  if (!st.login) st.login = { date: "", streak: 0 };
  if (!st.buffs) st.buffs = [];
  if (!st.spent) st.spent = { hp: 0, atk: 0, def: 0, crit: 0 };
  if (st.statPts == null) st.statPts = 0;
  if (!st.dungeons) st.dungeons = {};
  if (!st.bosses) st.bosses = {};
  if (!st.settings) st.settings = { autoPotion: false, battleSpeed: 1 };
  if (st.settings.autoPotion == null) st.settings.autoPotion = false;
  if (!st.settings.battleSpeed) st.settings.battleSpeed = 1;
  if (!st.shadows) st.shadows = {};
  if (!st.equip) st.equip = { active: [], weapon: null, armor: null, shadows: [], title: null, titleItem: null };
  if (!Array.isArray(st.equip.active)) st.equip.active = [];
  if (!Array.isArray(st.equip.shadows)) st.equip.shadows = [];
  if (!st.stats) st.stats = {};
  if (!st.missions) st.missions = {};
  if (!st.punish) st.punish = { count: 0, history: [], debuffs: [] };
  if (!st.titles) st.titles = { "مبتدی": true };
  return st;
}

/* ---------- منحنی سختی (لول ۶ ≈ ۲۰۰۰ کلیک) ---------- */
export function xpNeed(level) { return Math.floor(30 * Math.pow(level, 2.35)); }
export function maxEnergy(level) { return 20 + level * 2; }

export function newState(username, seedStr) {
  const seed = seedStr ? hashStr(seedStr) : (Date.now() & 0xffffffff);
  return {
    v: STATE_VERSION,
    username: username || "",
    seed,
    level: 1, xp: 0, gold: 80, gems: 2, energy: maxEnergy(1),
    stats: { clicks: 0, dayClicks: 0, bestCombo: 0, kills: 0, bosses: 0, dungeons: 0, wins: 0, losses: 0, duels: 0, chatMsgs: 0, skillsUsed: 0, goldEarned: 0, extracts: 0, shopBuys: 0, energyUsed: 0 },
    items: (() => {
      const pot = SHOP_ITEMS.find((x) => x.effects && x.effects.heal === 30);
      return pot ? { [pot.id]: 2 } : {};
    })(),
    skillsOwned: {},
    equip: { active: [], weapon: null, armor: null, shadows: [], title: null, titleItem: null },
    shadows: {},
    missions: {}, missionSeed: seed,
    daily: { date: todayKey(), quests: {}, picks: { date: todayKey(), remaining: 0, taken: 0 } },
    year: { day: 1, streak: 0, prog: { clicks: 0, kills: 0, dungeons: 0 }, claimedToday: false, lastChecked: todayKey(), history: [] },
    punish: { count: 0, history: [], debuffs: [] },
    titles: { "مبتدی": true },
    weekly: { week: weekKey(), xp: 0 },
    duelLog: [],
    rank_pts: 1000,
    login: { date: "", streak: 0 },
    buffs: [],
    energyAt: nowMs(),
    seenIntro: false,
    statPts: 0,
    spent: { hp: 0, atk: 0, def: 0, crit: 0 },
    dungeons: {},
    bosses: {},
    settings: { autoPotion: false, battleSpeed: 1 },
    updatedAt: nowMs()
  };
}

/* ---------- آمار رزمی ---------- */
export function combatStats(st) {
  const lvl = st.level;
  const base = {
    hp: 100 + lvl * 26 + Math.pow(lvl, 1.35) * 12,
    atk: 10 + lvl * 4 + Math.pow(lvl, 1.3) * 3,
    def: 2 + lvl * 1.6 + Math.pow(lvl, 1.15),
    crit: 5 + lvl * 0.4,
    dodge: 2 + lvl * 0.3,
    lifesteal: 0, reflect: 0, haste: 1, xpMult: 1, goldMult: 1, extractMult: 1, slayer: 1,
    energyMax: maxEnergy(lvl),
  };
  const addPct = (key, pct) => { base[key] += base[key] * pct / 100; };
  // آیتم‌های مجهز
  const w = itemById(st.equip.weapon);
  if (w) base.atk += w.effects.atk || 0;
  const a = itemById(st.equip.armor);
  if (a) base.def += a.effects.def || 0;
  const t = itemById(st.equip.titleItem);
  if (t) base.hp += (t.effects.pow || 0) * 2;
  // مهارت‌های فعال (پسیو)
  for (const sid of st.equip.active) {
    const sk = skillIndex(sid);
    if (!sk || !sk.passive) continue;
    switch (sk.type.key) {
      case "crit": base.crit += sk.pct; break;
      case "vamp": base.lifesteal += Math.min(30, sk.pct); break;
      case "dodge": base.dodge += sk.pct; break;
      case "reflect": base.reflect += sk.pct; break;
      case "focus": base.xpMult *= 1 + sk.pct / 100; break;
      case "greed": base.goldMult *= 1 + sk.pct / 100; break;
      case "haste": base.haste *= 1 + sk.pct / 100; break;
      case "tough": addPct("hp", sk.pct); break;
      case "energy": addPct("energyMax", sk.pct); break;
      case "slayer": base.slayer *= 1 + (sk.pct + 15) / 100; break;
      case "hunter": base.extractMult *= 1 + sk.pct / 100; break;
      case "iron": addPct("def", sk.pct); break;
      case "regen": base.regen = Math.max(base.regen || 0, Math.ceil(sk.pct / 4)); break;
    }
  }
  // سایه‌های مجهز
  for (const sid of st.equip.shadows) {
    const sh = st.shadows[sid];
    if (sh) { base.atk += sh.power * 0.5; base.hp += sh.power * 1.2; }
  }
  // دیباف مجازات
  for (const d of st.punish.debuffs) {
    if (d.until > nowMs()) {
      if (d.powerPct) { base.atk *= 1 - d.powerPct / 100; base.hp *= 1 - d.powerPct / 100; }
    }
  }
  if (st.spent) {
    base.hp += (st.spent.hp || 0) * 18;
    base.atk += (st.spent.atk || 0) * 3.2;
    base.def += (st.spent.def || 0) * 2.4;
    base.crit += (st.spent.crit || 0) * 0.85;
  }
  if (st.hpBonus) base.hp *= 1 + st.hpBonus * 0.05;
  for (const b of activeBuffs(st)) {
    if (b.k === "atk") base.atk *= 1 + b.pct / 100;
    if (b.k === "def") base.def *= 1 + b.pct / 100;
    if (b.k === "hp") base.hp *= 1 + b.pct / 100;
    if (b.k === "crit") base.crit += b.pct;
    if (b.k === "haste") base.haste *= 1 + b.pct / 100;
    if (b.k === "xp") base.xpMult *= 1 + b.pct / 100;
    if (b.k === "gold") base.goldMult *= 1 + b.pct / 100;
    if (b.k === "vamp") base.lifesteal += b.pct;
    if (b.k === "extract") base.extractMult *= 1 + b.pct / 100;
    if (b.k === "regen") base.regen = Math.max(base.regen || 0, b.pct);
  }
  base.hp = Math.floor(base.hp); base.atk = Math.floor(base.atk); base.def = Math.floor(base.def);
  base.energyMax = Math.floor(base.energyMax);
  return base;
}
export function computePower(st) {
  const c = combatStats(st);
  const shadows = Object.values(st.shadows).reduce((s, x) => s + x.power, 0);
  const t = itemById(st.equip.titleItem);
  const titlePow = (t?.effects.pow || 0);
  return Math.floor((c.hp * 1.2 + c.atk * 4 + c.def * 6 + st.level * 50 + shadows + titlePow) * (1 + st.level / 100));
}

/* ---------- تمرین (کلیک) ---------- */
export function doTrain(st) {
  const c = combatStats(st);
  st.stats.clicks++;
  st.stats.dayClicks++;
  const crit = Math.random() * 100 < c.crit;
  const mult = (crit ? 2 : 1) * c.xpMult * (1 + (st.punish.xpBoost || 0));
  const gain = Math.max(1, Math.round(mult));
  const evt = addXP(st, gain);
  evt.crit = crit;
  evt.xp = gain;
  // کمبو
  const gap = nowMs() - (st.stats.lastClickTs || 0);
  if (gap < 1200) st.stats.combo = (st.stats.combo || 0) + 1;
  else st.stats.combo = 1;
  st.stats.lastClickTs = nowMs();
  if (st.stats.combo > st.stats.bestCombo) st.stats.bestCombo = st.stats.combo;
  evt.combo = st.stats.combo;
  if (st.stats.combo > 4 && st.stats.combo % 25 === 0) {
    const bonus = Math.floor(25 * st.level * c.xpMult);
    addXP(st, bonus); evt.xp += bonus; evt.comboBonus = true;
  }
  applyProgress(st, "combo", st.stats.combo);
  if (st.stats.clicks % 4 === 0) {
    const g = Math.max(1, Math.floor(1 + st.level * 0.2 + Math.min(8, (st.stats.combo || 0) / 8)));
    gainGold(st, g);
    evt.gold = g;
  }
  st.updatedAt = nowMs();
  return evt;
}

export function addXP(st, n) {
  st.xp += n;
  if (st.weekly.week !== weekKey()) st.weekly = { week: weekKey(), xp: 0 };
  st.weekly.xp += n;
  st.dayLog = st.dayLog || { date: todayKey(), xp: 0, clicks: 0, gold: 0 };
  if (st.dayLog.date !== todayKey()) st.dayLog = { date: todayKey(), xp: 0, clicks: 0, gold: 0 };
  st.dayLog.xp += n;
  const evt = { levelUps: 0, leveled: false };
  let guard = 0;
  while (st.xp >= xpNeed(st.level) && guard++ < 300) {
    st.xp -= xpNeed(st.level);
    st.level++;
    evt.levelUps++;
    evt.leveled = true;
    if (st.level % 10 === 0) st.gems += 2;
    addRewardPick(st, 1);
    st.statPts = (st.statPts || 0) + 1;
  }
  st.energy = Math.min(st.energy, energyCap(st));
  st.updatedAt = nowMs();
  return evt;
}

export function energyCap(st) {
  try { return Math.max(maxEnergy(st.level), combatStats(st).energyMax || maxEnergy(st.level)); }
  catch (e) { return maxEnergy(st.level); }
}

export function comboMult(combo) {
  return 1 + Math.min(1, Math.max(0, combo || 0) * 0.04);
}

export function battleAtkCd(cs) {
  const haste = Math.max(0.5, cs?.haste || 1);
  return Math.max(260, Math.floor(720 / haste));
}

export function spendStat(st, key) {
  const ok = { hp: 1, atk: 1, def: 1, crit: 1 };
  if (!ok[key]) return { error: "آمار نامعتبر" };
  if ((st.statPts || 0) < 1) return { error: "امتیاز نداری — با لول‌آپ بگیر" };
  st.statPts--;
  st.spent = st.spent || { hp: 0, atk: 0, def: 0, crit: 0 };
  st.spent[key] = (st.spent[key] || 0) + 1;
  st.updatedAt = nowMs();
  return { ok: true, spent: st.spent, left: st.statPts };
}

export function upgradeShadow(st, sid) {
  const sh = st.shadows[sid];
  if (!sh) return { error: "سایه پیدا نشد" };
  const lv = sh.lv || 1;
  if (lv >= 20) return { error: "حداکثر سطح سایه ۲۰ است" };
  const cost = Math.floor(90 * Math.pow(1.42, lv - 1) * (1 + sh.power / 800));
  if (st.gold < cost) return { error: `طلا کافی نیست (${fmt(cost)})` };
  st.gold -= cost;
  sh.lv = lv + 1;
  sh.power = Math.floor(sh.power * 1.16 + 10);
  st.updatedAt = nowMs();
  return { ok: true, sh, cost };
}

export function fuseShadows(st, keepId, eatId) {
  if (!keepId || !eatId || keepId === eatId) return { error: "دو سایهٔ متفاوت انتخاب کن" };
  const a = st.shadows[keepId], b = st.shadows[eatId];
  if (!a || !b) return { error: "سایه پیدا نشد" };
  const cost = 180 + Math.floor((a.power + b.power) * 0.12);
  if (st.gold < cost) return { error: `طلا کافی نیست (${fmt(cost)})` };
  st.gold -= cost;
  a.power = Math.floor(a.power + b.power * 0.42);
  a.lv = Math.min(20, (a.lv || 1) + 1);
  st.equip.shadows = (st.equip.shadows || []).filter((id) => id !== eatId);
  delete st.shadows[eatId];
  st.updatedAt = nowMs();
  return { ok: true, sh: a, cost };
}

export function sweepDungeon(st, i) {
  const rec = st.dungeons && st.dungeons[i];
  if (!rec || !rec.cleared) return { error: "اول باید این دروازه را خودت پاکسازی کنی" };
  const d = dungeonIndex(i);
  if (st.level < d.level) return { error: "سطح کافی نیست" };
  const cost = 4;
  if (st.energy < cost) return { error: "انرژی کافی نیست" };
  st.energy -= cost;
  st.stats.energyUsed = (st.stats.energyUsed || 0) + cost;
  const cs = combatStats(st);
  const gold = Math.floor(d.gold * 0.72 * (cs.goldMult || 1));
  const xp = Math.floor(d.xp * 0.72 * (cs.xpMult || 1));
  gainGold(st, gold);
  addXP(st, xp);
  st.stats.dungeons++;
  applyProgress(st, "dungeons", 1);
  applyProgress(st, "energy", cost);
  rec.count = (rec.count || 0) + 1;
  rec.last = nowMs();
  rec.swept = (rec.swept || 0) + 1;
  st.updatedAt = nowMs();
  return { ok: true, gold, xp };
}

export function markFailedMission(st, mid) {
  const rec = st.missions[mid] = st.missions[mid] || { prog: 0 };
  if (rec.failed || rec.claimed) return false;
  rec.failed = true;
  rec.failedAt = nowMs();
  st.updatedAt = nowMs();
  return true;
}

export function featuredMult(st, kind, idx) {
  const f = dailyFeatured();
  if (kind === "dungeon" && idx === f.dungeon) return f.goldBonus || 1.25;
  if (kind === "boss" && idx === f.boss) return f.goldBonus || 1.25;
  return 1;
}

export function firstClearMult(st, kind, idx) {
  if (kind === "dungeon") return (st.dungeons && st.dungeons[idx] && st.dungeons[idx].cleared) ? 1 : 1.45;
  if (kind === "boss") return (st.bosses && st.bosses[idx] && st.bosses[idx].killed) ? 1 : 1.45;
  return 1;
}

export function codexStats(st) {
  const dN = Object.values(st.dungeons || {}).filter((x) => x && x.cleared).length;
  const bN = Object.values(st.bosses || {}).filter((x) => x && x.killed).length;
  const shN = Object.keys(st.shadows || {}).length;
  return { dungeons: dN, bosses: bN, shadows: shN };
}

/* ---------- جایزهٔ لول‌آپ: حداکثر ۳ انتخاب در روز ---------- */
export function addRewardPick(st, n) {
  const today = todayKey();
  const p = st.daily.picks;
  if (p.date !== today) { p.date = today; p.remaining = 0; p.taken = 0; }
  const addable = Math.min(n, Math.max(0, 3 - (p.remaining + p.taken)));
  p.remaining += addable;
}
export function currentPicks(st) {
  const today = todayKey();
  const p = st.daily.picks;
  if (p.date !== today) { p.date = today; p.remaining = 0; p.taken = 0; }
  if (p.remaining <= 0) return [];
  return dailyPicks(today, p.taken); // هر انتخابِ روز، ست متفاوت
}
export function takePick(st, idx) {
  const picks = currentPicks(st);
  const p = picks[idx];
  if (!p || st.daily.picks.remaining <= 0) return null;
  applyPickEffect(st, p);
  st.daily.picks.remaining--;
  st.daily.picks.taken++;
  st.updatedAt = nowMs();
  return p;
}
export function applyPickEffect(st, p) {
  switch (p.kind) {
    case "gold": st.gold += 500 + Math.floor(st.level * 120); break;
    case "gems": st.gems += 1; break;
    case "xp": addXP(st, 300 + st.level * 80); break;
    case "energy": st.energy = energyCap(st); break;
    case "hpBonus": st.hpBonus = (st.hpBonus || 0) + 1; break;
    case "randTitle": { const t = randomTitle(); addItem(st, itemByName(t.name)?.id, 1); break; }
    case "randWeapon": { const w = randomWeapon(); addItem(st, itemByName(w)?.id, 1); break; }
    case "item": addItem(st, itemByName(p.item)?.id, p.count || 1); break;
  }
}

/* ---------- اقتصاد ---------- */
export function gainGold(st, n) {
  st.gold += Math.floor(n);
  st.stats.goldEarned += Math.floor(n);
  st.dayLog = st.dayLog || { date: todayKey(), xp: 0, clicks: 0, gold: 0 };
  if (st.dayLog.date !== todayKey()) st.dayLog = { date: todayKey(), xp: 0, clicks: 0, gold: 0 };
  st.dayLog.gold += Math.floor(n);
  applyProgress(st, "gold", Math.floor(n));
  st.updatedAt = nowMs();
}
export function addItem(st, itemId, count = 1) {
  if (!itemId) return;
  st.items[itemId] = (st.items[itemId] || 0) + count;
  st.updatedAt = nowMs();
}
export function consumeItem(st, itemId, count = 1) {
  if ((st.items[itemId] || 0) < count) return false;
  st.items[itemId] -= count;
  if (st.items[itemId] <= 0) delete st.items[itemId];
  st.updatedAt = nowMs();
  return true;
}
export function buyItem(st, itemId) {
  const it = itemById(itemId);
  if (!it) return { error: "آیتم پیدا نشد" };
  if (it.price.gem != null) {
    if (st.gems < it.price.gem) return { error: "جواهر کافی نداری" };
    st.gems -= it.price.gem;
  } else {
    if (st.gold < it.price.gold) return { error: "طلا کافی نداری" };
    st.gold -= it.price.gold;
  }
  addItem(st, itemId, 1);
  st.stats.shopBuys++;
  st.updatedAt = nowMs();
  return { ok: true, item: it };
}
export function sellItem(st, itemId, count = 1) {
  const it = itemById(itemId);
  if (!it || (st.items[itemId] || 0) < count) return { error: "آیتم کافی نداری" };
  consumeItem(st, itemId, count);
  const base = it.price.gem != null ? it.price.gem * 150 : it.price.gold || 50;
  gainGold(st, Math.floor(base * 0.5 * count));
  return { ok: true };
}
export function useItem(st, itemId) {
  const it = itemById(itemId);
  if (!it) return { error: "آیتم پیدا نشد" };
  if ((st.items[itemId] || 0) < 1) return { error: "این آیتم را نداری" };
  const fx = it.effects;
  if (fx.heal != null) return { error: "معجون جان فقط در نبرد قابل استفاده است" };
  if (fx.energy != null) {
    st.energy = Math.min(energyCap(st), st.energy + fx.energy);
    consumeItem(st, itemId);
    return { ok: true, msg: `انرژی +${fx.energy}` };
  }
  if (fx.xp != null) {
    addXP(st, fx.xp * Math.floor(1 + st.level / 40));
    consumeItem(st, itemId);
    return { ok: true, msg: `تجربه +${fmt(fx.xp * Math.floor(1 + st.level / 40))}` };
  }
  if (fx.gold != null) {
    gainGold(st, fx.gold);
    consumeItem(st, itemId);
    return { ok: true, msg: `طلا +${fmt(fx.gold)}` };
  }
  if (fx.fullEnergy != null) {
    st.energy = energyCap(st); consumeItem(st, itemId);
    return { ok: true, msg: "انرژی کامل شد!" };
  }
  if (fx.protect != null) {
    st.punish.shield = (st.punish.shield || 0) + 1; consumeItem(st, itemId);
    return { ok: true, msg: "یک مجازات آینده لغو می‌شود" };
  }
  if (fx.rerollShop != null) {
    st.shopReroll = nowMs(); consumeItem(st, itemId);
    return { ok: true, msg: "فروشگاه تازه شد" };
  }
  if (fx.punishShield != null) {
    st.punish.shield = (st.punish.shield || 0) + 1; consumeItem(st, itemId);
    return { ok: true, msg: "محافظ مجازات فعال شد" };
  }
  if (fx.box != null) {
    consumeItem(st, itemId);
    const r = Math.random();
    let msg;
    if (r < 0.4) { const g = range(mulberry32(Date.now() & 0xffff), 300, 1500) * st.level; gainGold(st, g); msg = `طلا +${fmt(g)}`; }
    else if (r < 0.7) { const x = range(mulberry32(Date.now() & 0xffff), 200, 1000) * st.level; addXP(st, x); msg = `تجربه +${fmt(x)}`; }
    else { st.gems += 2; msg = "جواهر +۲"; }
    return { ok: true, msg: "جعبهٔ شانس: " + msg };
  }
  if (fx.duelTicket != null) { st.duelTicket = (st.duelTicket || 0) + 1; consumeItem(st, itemId); return { ok: true, msg: "تیکت مبارزه ذخیره شد" }; }
  if (fx.rage != null) { addBuff(st, "atk", 25, 180000); consumeItem(st, itemId); return { ok: true, msg: "خشم! حمله +۲۵٪ برای ۳ دقیقه" }; }
  if (fx.haste != null) { addBuff(st, "haste", 20, 180000); consumeItem(st, itemId); return { ok: true, msg: "سرعت +۲۰٪ برای ۳ دقیقه" }; }
  if (fx.focus != null) { addBuff(st, "xp", 30, 300000); consumeItem(st, itemId); return { ok: true, msg: "تمرکز! XP +۳۰٪ برای ۵ دقیقه" }; }
  if (fx.luck != null) { addBuff(st, "crit", 18, 180000); consumeItem(st, itemId); return { ok: true, msg: "شانس کریت +۱۸٪ برای ۳ دقیقه" }; }
  if (fx.def != null) { addBuff(st, "def", 22, 180000); consumeItem(st, itemId); return { ok: true, msg: "دفاع +۲۲٪ برای ۳ دقیقه" }; }
  if (fx.atk != null) { addBuff(st, "atk", 22, 180000); consumeItem(st, itemId); return { ok: true, msg: "حمله +۲۲٪ برای ۳ دقیقه" }; }
  if (fx.vamp != null) { addBuff(st, "vamp", 12, 180000); consumeItem(st, itemId); return { ok: true, msg: "خون‌آشام +۱۲٪ برای ۳ دقیقه" }; }
  if (fx.regen != null) { addBuff(st, "regen", 6, 180000); consumeItem(st, itemId); return { ok: true, msg: "بازیابی فعال شد" }; }
  if (fx.greed != null) { addBuff(st, "gold", 30, 300000); consumeItem(st, itemId); return { ok: true, msg: "طمع! طلا +۳۰٪ برای ۵ دقیقه" }; }
  if (fx.shadow != null) { addBuff(st, "extract", 25, 300000); consumeItem(st, itemId); return { ok: true, msg: "شانس سایه +۲۵٪ برای ۵ دقیقه" }; }
  if (fx.yearBoost != null) { st.year.prog.clicks = (st.year.prog.clicks || 0) + 80; consumeItem(st, itemId); return { ok: true, msg: "مسیر سالانه شتاب گرفت" }; }
  if (fx.chatColor != null) { st.chatColor = true; consumeItem(st, itemId); return { ok: true, msg: "رنگ ویژهٔ چت فعال شد" }; }
  if (fx.sysBell != null) { st.sysBell = true; consumeItem(st, itemId); return { ok: true, msg: "زنگولهٔ سیستم فعال شد" }; }
  if (fx.secretKey != null) { st.secretKey = (st.secretKey || 0) + 1; consumeItem(st, itemId); return { ok: true, msg: "کلید دروازهٔ مخفی ذخیره شد" }; }
  if (fx.statPts != null) { st.statPts = (st.statPts || 0) + fx.statPts; consumeItem(st, itemId); return { ok: true, msg: `امتیاز آمار +${fx.statPts}` }; }
  if (fx.shadowFood != null) { st.shadowFood = (st.shadowFood || 0) + 1; consumeItem(st, itemId); return { ok: true, msg: "غذای سایه ذخیره شد — در کیف روی سایه بزن" }; }
  if (fx.ult != null || fx.parry != null) return { error: "این معجون فقط در نبرد قابل استفاده است" };
  return { error: "این آیتم اینجا قابل استفاده نیست" };
}
export function equipWeapon(st, itemId) {
  if (itemId && !(st.items[itemId] > 0)) return { error: "این سلاح را نداری" };
  st.equip.weapon = itemId || null;
  st.updatedAt = nowMs();
  return { ok: true };
}
export function equipArmor(st, itemId) {
  if (itemId && !(st.items[itemId] > 0)) return { error: "این زره را نداری" };
  st.equip.armor = itemId || null;
  st.updatedAt = nowMs();
  return { ok: true };
}
export function equipTitle(st, itemId) {
  if (itemId && !(st.items[itemId] > 0)) return { error: "این عنوان را نداری" };
  st.equip.titleItem = itemId || null;
  st.updatedAt = nowMs();
  return { ok: true };
}

/* ---------- مهارت‌ها ---------- */
export const MAX_ACTIVE_SKILLS = 4;
export function skillUnlocked(st, sid) { return !!st.skillsOwned[sid]; }
export function unlockSkill(st, sid) {
  const sk = skillIndex(sid);
  if (!sk) return { error: "مهارت پیدا نشد" };
  if (!meetsReq(st, sk.req)) return { error: "هنوز شرایطش را نداری: " + sk.req.label };
  if (st.skillsOwned[sid]) return { error: "از قبل باز است" };
  const cost = 400 * Math.pow(1.6, Math.floor(sid / 111));
  if (st.gold < cost) return { error: `برای فعال‌سازی ${fmt(cost)} طلا لازم داری` };
  st.gold -= cost;
  st.skillsOwned[sid] = true;
  st.updatedAt = nowMs();
  return { ok: true, skill: sk };
}
export function meetsReq(st, req) {
  switch (req.t) {
    case "level": return st.level >= req.n;
    case "clicks": return (st.stats.clicks || 0) >= req.n;
    case "kills": return (st.stats.bosses || 0) >= req.n;
    case "dungeons": return (st.stats.dungeons || 0) >= req.n;
    case "duels": return (st.stats.wins || 0) >= req.n;
    case "extract": return (st.stats.extracts || 0) >= req.n;
    default: return false;
  }
}
export function toggleSkill(st, sid) {
  if (!skillUnlocked(st, sid)) return { error: "اول این مهارت را باز کن" };
  const sk = skillIndex(sid);
  if (!sk) return { error: "مهارت پیدا نشد" };
  const act = st.equip.active;
  const idx = act.indexOf(sid);
  if (idx >= 0) { act.splice(idx, 1); return { ok: true, on: false }; }
  if (act.length >= MAX_ACTIVE_SKILLS) return { error: `حداکثر ${MAX_ACTIVE_SKILLS} مهارت می‌تواند فعال باشد` };
  act.push(sid);
  st.updatedAt = nowMs();
  return { ok: true, on: true };
}

/* ---------- سایه‌ها ---------- */
let shadowIdCounter = 1;
export function newShadow(st, name, rankKey, power, emoji) {
  const id = "sh_" + (Date.now().toString(36) + "_" + (shadowIdCounter++));
  st.shadows[id] = { id, name, rank: rankKey, power, emoji, created: nowMs() };
  st.updatedAt = nowMs();
  return id;
}
export function extractShadow(st, source) {
  // source: {name, rankKey, power, emoji, baseChance, stoneBoost}
  const chance = Math.min(0.92, source.baseChance * (1 + (source.stoneBoost || 0) / 100));
  const roll = Math.random();
  const success = source.baseChance >= 1 || roll < chance;
  let id = null;
  if (success) id = newShadow(st, source.name, source.rankKey, Math.floor(source.power * (0.4 + Math.random() * 0.5)), source.emoji || "👤");
  st.stats.extracts++;
  st.updatedAt = nowMs();
  return { success, id, chance, roll };
}
export function assignShadow(st, sid, on) {
  if (!st.shadows[sid]) return { error: "سایه پیدا نشد" };
  const act = st.equip.shadows;
  const idx = act.indexOf(sid);
  if (on && idx < 0) {
    if (act.length >= 3) return { error: "حداکثر ۳ سایه می‌تواند همراهت باشد" };
    act.push(sid);
  } else if (!on && idx >= 0) act.splice(idx, 1);
  st.updatedAt = nowMs();
  return { ok: true };
}

/* ---------- ماموریت‌ها ---------- */
export function missionBucket(ts = nowMs()) { return Math.floor(ts / MISSION_INTERVAL_MS); }
export function activeMissions(st) {
  const now = nowMs();
  const bucket = missionBucket(now);
  const list = [];
  for (let b = Math.max(1, bucket - 8); b <= bucket; b++) {
    for (let s = 0; s < MISSION_SLOTS; s++) {
      const m = missionOf(st.seed, s, b);
      const rec = st.missions[m.id] || {};
      if (rec.failed) continue;
      if (rec.done && rec.claimed) continue;
      if (b < bucket && !m.mandatory) continue; // فقط آخرین سطل عادی
      list.push({ ...m, prog: rec.prog || 0, done: !!rec.done, claimed: !!rec.claimed, failDeadline: m.mandatory && b < bucket });
    }
  }
  list.sort((a, b2) => (a.mandatory ? -1 : 1) - (b2.mandatory ? -1 : 1) || a.deadline - b2.deadline);
  return list;
}
export function applyProgress(st, type, amount) {
  if (!amount) return;
  const now = nowMs();
  const bucket = missionBucket(now);
  for (let b = Math.max(1, bucket - 8); b <= bucket; b++) {
    for (let s = 0; s < MISSION_SLOTS; s++) {
      const m = missionOf(st.seed, s, b);
      if (m.type !== type) continue;
      const rec = st.missions[m.id] = st.missions[m.id] || { prog: 0 };
      if (rec.done) continue;
      rec.prog = type === "combo" ? Math.max(rec.prog || 0, amount) : (rec.prog || 0) + amount;
      if (rec.prog >= m.n) { rec.done = true; rec.doneAt = now; }
    }
  }
  // ماموریت روزانه
  for (const q of Object.values(st.daily.quests)) {
    if (q.type === type && !q.done) {
      q.prog = (q.prog || 0) + amount;
      if (q.prog >= q.n) q.done = true;
    }
  }
  // مسیر سالانه
  if (st.year.prog) {
    const yk = type === "bosses" ? "kills" : type;
    if (st.year.prog[yk] != null) {
      st.year.prog[yk] = (st.year.prog[yk] || 0) + amount;
    }
  }
  st.updatedAt = now;
}
export function claimMission(st, mid) {
  const rec = st.missions[mid];
  if (!rec || !rec.done || rec.claimed) return { error: "این ماموریت قابل دریافت نیست" };
  const m = findMission(st, mid);
  if (!m) return { error: "ماموریت منقضی شده" };
  rec.claimed = true;
  gainGold(st, m.reward.gold);
  st.gems += m.reward.gems || 0;
  addXP(st, m.reward.xp);
  st.updatedAt = nowMs();
  return { ok: true, m };
}
function findMission(st, mid) {
  const [b, s] = mid.split(":").map(Number);
  return missionOf(st.seed, s, b);
}

/* ---------- ماموریت‌های روزانهٔ اجباری ---------- */
export function dailyQuests(st) {
  const today = todayKey();
  if (st.daily.date !== today || !st.daily.quests || !Object.keys(st.daily.quests).length) {
    // روز جدید: روز قبل چک شد
    st.daily.date = today;
    st.daily.quests = generateDailyQuests(st);
  }
  return st.daily.quests;
}
function generateDailyQuests(st) {
  const rng = mulberry32(seedOf("daily", todayKey()));
  const clicks = 200 + st.level * 25;
  const kills = Math.max(1, 2 + Math.floor(st.level / 12));
  const dungeons = Math.max(1, 1 + Math.floor(st.level / 25));
  const duelOrChat = rng() < 0.5 ? { t: "duels", n: 1, label: "برد در رقابت" } : { t: "chat", n: 3 + Math.floor(st.level / 10), label: "پیام در چت" };
  return {
    q1: { id: "dq_clicks", type: "clicks", n: clicks, prog: 0, done: false, claimed: false, label: `تمرین: ${clicks} کلیک` },
    q2: { id: "dq_kills", type: "bosses", n: kills, prog: 0, done: false, claimed: false, label: `شکار: ${kills} باس` },
    q3: { id: "dq_dungeons", type: "dungeons", n: dungeons, prog: 0, done: false, claimed: false, label: `پاکسازی: ${dungeons} دانجن` },
    q4: { id: "dq_social", type: duelOrChat.t, n: duelOrChat.n, prog: 0, done: false, claimed: false, label: duelOrChat.label },
  };
}
export function claimDailyQuest(st, qid) {
  const q = st.daily.quests[qid] || Object.values(st.daily.quests).find((x) => x.id === qid);
  if (!q || !q.done || q.claimed) return { error: "قابل دریافت نیست" };
  q.claimed = true;
  const g = 200 + st.level * 40;
  gainGold(st, g);
  addXP(st, 300 + st.level * 60);
  st.gems += 1;
  st.updatedAt = nowMs();
  return { ok: true, gold: g };
}

/* ---------- مجازات واقعی ---------- */
export function applyPunishment(st, reason, opts = {}) {
  if (st.punish.shield > 0) {
    st.punish.shield--;
    st.punish.history.unshift({ ts: nowMs(), reason, blocked: true });
    st.updatedAt = nowMs();
    return { blocked: true };
  }
  const goldLoss = Math.floor(st.gold * 0.25) + 100;
  st.gold = Math.max(0, st.gold - goldLoss);
  st.punish.count++;
  const until = nowMs() + (opts.hours || 24) * 3600 * 1000;
  st.punish.debuffs.push({ until, powerPct: opts.powerPct || 10, label: "ضعف سیستم" });
  const ev = {
    blocked: false, goldLoss,
    until, reason,
    debuffPct: opts.powerPct || 10
  };
  st.punish.history.unshift({ ts: nowMs(), reason, goldLoss });
  if (st.punish.history.length > 50) st.punish.history.length = 50;
  // شکستن زنجیره سالانه
  if (opts.year) { st.year.streak = 0; }
  st.updatedAt = nowMs();
  return ev;
}
export function cleanDebuffs(st) {
  const now = nowMs();
  const before = st.punish.debuffs.length;
  st.punish.debuffs = st.punish.debuffs.filter((d) => d.until > now);
  return before !== st.punish.debuffs.length;
}
export function activeDebuffs(st) {
  const now = nowMs();
  return st.punish.debuffs.filter((d) => d.until > now);
}

/* ---------- مسیر ۳۶۵ روزه ---------- */
export function yearState(st) {
  const today = todayKey();
  const y = st.year;
  if (y.lastChecked !== today) {
    const prevMs = keyToMs(y.lastChecked);
    const nowMs2 = keyToMs(today);
    let missedDays = 0;
    if (!isNaN(prevMs) && !y.claimedToday && prevMs < nowMs2) missedDays++;
    // اگر روزِ قبل انجام شده بود ولی چند روز غیبت بوده
    if (!isNaN(prevMs)) {
      const gap = Math.floor((nowMs2 - prevMs) / 86400000);
      if (gap > 1) missedDays += gap - 1;
      for (let k = 0; k < gap; k++) {
        y.day = Math.min(YEAR_DAYS, y.day + 1);
        y.streak = k === 0 && y.claimedToday ? y.streak + 1 : 0;
      }
      y.claimedToday = false;
      y.prog = { clicks: 0, kills: 0, dungeons: 0 };
    }
    if (isNaN(prevMs)) y.claimedToday = false;
    y.lastChecked = today;
    if (missedDays > 0) {
      const missed = { ts: nowMs(), day: Math.max(1, y.day - missedDays), days: missedDays };
      y.history.unshift(missed);
      if (y.history.length > 30) y.history.length = 30;
      return { missed, year: y };
    }
  }
  return { year: y };
}
export function claimYearDay(st) {
  const q = yearQuestDay(st.year.day);
  const p = st.year.prog;
  if (p.clicks < q.need.clicks || p.kills < q.need.kills || p.dungeons < q.need.dungeons) {
    return { error: "کارهای امروز هنوز کامل نشده" };
  }
  if (st.year.claimedToday) return { error: "امروز را دریافت کرده‌ای" };
  st.year.claimedToday = true;
  gainGold(st, q.reward.gold);
  addXP(st, q.reward.xp);
  st.gems += q.reward.gems || 0;
  st.updatedAt = nowMs();
  return { ok: true, q };
}

/* ---------- محاسبهٔ آسیب ---------- */
export function calcDamage(atk, def, critChance, mult = 1) {
  const raw = Math.max(1, atk * mult - def * 0.4);
  const crit = Math.random() * 100 < critChance;
  const dmg = Math.floor(raw * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1));
  return { dmg, crit };
}

/* ---------- باف / ورود روزانه / انرژی / رنک ---------- */
export function addBuff(st, k, pct, ms) {
  st.buffs = st.buffs || [];
  st.buffs.push({ k, pct, until: nowMs() + ms });
  st.updatedAt = nowMs();
}
export function activeBuffs(st) {
  const now = nowMs();
  st.buffs = (st.buffs || []).filter((b) => b.until > now);
  return st.buffs;
}
export function regenEnergy(st) {
  const cap = energyCap(st);
  const last = st.energyAt || st.updatedAt || nowMs();
  const gained = Math.floor((nowMs() - last) / 30000);
  if (gained > 0) {
    st.energy = Math.min(cap, (st.energy || 0) + gained);
    st.energyAt = nowMs();
    st.updatedAt = nowMs();
    return gained;
  }
  return 0;
}
export function claimDailyLogin(st) {
  const today = todayKey();
  st.login = st.login || { date: "", streak: 0 };
  if (st.login.date === today) return { already: true, streak: st.login.streak || 0 };
  const prev = st.login.date;
  let streak = 1;
  if (prev) {
    const prevMs = keyToMs(prev);
    const gap = Math.round((keyToMs(today) - prevMs) / 86400000);
    if (gap === 1) streak = (st.login.streak || 0) + 1;
  }
  const gold = 80 + streak * 25 + st.level * 10;
  const xp = 120 + streak * 20 + st.level * 8;
  const gems = streak % 7 === 0 ? 2 : (streak % 3 === 0 ? 1 : 0);
  gainGold(st, gold);
  addXP(st, xp);
  st.gems += gems;
  st.login = { date: today, streak };
  st.updatedAt = nowMs();
  return { ok: true, gold, xp, gems, streak };
}
export function unlockTitles(st) {
  st.titles = st.titles || {};
  const newly = [];
  for (const t of TITLES) {
    if (st.titles[t.name]) continue;
    try { if (t.need(st)) { st.titles[t.name] = true; newly.push(t.name); } } catch (e) {}
  }
  if (newly.length) st.updatedAt = nowMs();
  return newly;
}
export function addRankPts(st, n) {
  st.rank_pts = Math.max(0, (st.rank_pts == null ? 1000 : st.rank_pts) + n);
  st.updatedAt = nowMs();
  return st.rank_pts;
}

/* ---------- فروشگاه روزانه ---------- */
export function dailyDeals(st) {
  const today = todayKey();
  const extra = st && st.shopReroll ? String(st.shopReroll) : "0";
  const rng = mulberry32(seedOf("deals", today, extra));
  const cats = ["weapon", "armor", "potion", "scroll", "stone", "title", "special"];
  const deals = [];
  const used = new Set();
  while (deals.length < 3) {
    const cat = cats[Math.floor(rng() * cats.length)];
    const pool = SHOP_ITEMS.filter((x) => x.cat === cat && !used.has(x.id));
    if (!pool.length) break;
    const it = pool[Math.floor(rng() * pool.length)];
    used.add(it.id);
    const discount = 15 + Math.floor(rng() * 35);
    deals.push({
      item: it,
      discount,
      price: it.price.gem != null
        ? { gem: Math.max(1, Math.floor(it.price.gem * (1 - discount / 100))) }
        : { gold: Math.floor(it.price.gold * (1 - discount / 100)) }
    });
  }
  return deals;
}

/* ---------- وضعیت تیک ---------- */
export function autoEquipBest(st) {
  let w = null, a = null, t = null;
  for (const id of Object.keys(st.items || {})) {
    const it = itemById(Number(id));
    if (!it || !(st.items[id] > 0)) continue;
    if (it.effects.type === "weapon" && (!w || (it.effects.atk || 0) > (w.effects.atk || 0))) w = it;
    if (it.effects.type === "armor" && (!a || (it.effects.def || 0) > (a.effects.def || 0))) a = it;
    if (it.cat === "title" && it.effects.pow != null && (!t || it.effects.pow > t.effects.pow)) t = it;
  }
  if (w) equipWeapon(st, w.id);
  if (a) equipArmor(st, a.id);
  if (t) equipTitle(st, t.id);
  st.updatedAt = nowMs();
  return { weapon: w, armor: a, title: t };
}

export function claimAllReady(st) {
  let n = 0;
  for (const m of activeMissions(st)) {
    const rec = st.missions[m.id];
    if (rec && rec.done && !rec.claimed && claimMission(st, m.id).ok) n++;
  }
  const qs = dailyQuests(st);
  for (const q of Object.values(qs)) {
    if (q.done && !q.claimed && claimDailyQuest(st, q.id).ok) n++;
  }
  return n;
}

export function dailyFeatured() {
  const rng = mulberry32(seedOf("featured", todayKey()));
  return {
    dungeon: Math.floor(rng() * 120),
    boss: Math.floor(rng() * 60),
    goldBonus: 1.25,
  };
}

export function achievementsOf(st) {
  return [
    { id: "l5", name: "شکارچی تازه‌کار", ok: st.level >= 5 },
    { id: "l30", name: "رتبه C", ok: st.level >= 30 },
    { id: "click1k", name: "هزار ضربه", ok: (st.stats.clicks || 0) >= 1000 },
    { id: "boss10", name: "شکارچی باس", ok: (st.stats.bosses || 0) >= 10 },
    { id: "dun20", name: "پاک‌کننده", ok: (st.stats.dungeons || 0) >= 20 },
    { id: "win5", name: "رقیب‌کش", ok: (st.stats.wins || 0) >= 5 },
    { id: "sh3", name: "ارباب سایه", ok: Object.keys(st.shadows || {}).length >= 3 },
    { id: "combo50", name: "کمبو ۵۰", ok: (st.stats.bestCombo || 0) >= 50 },
    { id: "l10", name: "رتبه D", ok: st.level >= 10 },
    { id: "l60", name: "رتبه B", ok: st.level >= 60 },
    { id: "click5k", name: "پنج‌هزار ضربه", ok: (st.stats.clicks || 0) >= 5000 },
    { id: "boss50", name: "قصاب باس‌ها", ok: (st.stats.bosses || 0) >= 50 },
    { id: "dun100", name: "فاتح دروازه‌ها", ok: (st.stats.dungeons || 0) >= 100 },
    { id: "win20", name: "قهرمان رقابت", ok: (st.stats.wins || 0) >= 20 },
    { id: "sh10", name: "ارتش سایه", ok: Object.keys(st.shadows || {}).length >= 10 },
    { id: "combo100", name: "کمبو ۱۰۰", ok: (st.stats.bestCombo || 0) >= 100 },
    { id: "extract10", name: "جمع‌آور روح", ok: (st.stats.extracts || 0) >= 10 },
    { id: "gold50k", name: "ثروتمند", ok: (st.stats.goldEarned || 0) >= 50000 },
    { id: "login7", name: "هفت روز حضور", ok: !!(st.login && st.login.streak >= 7) },
  ];
}

export function tickState(st) {
  const now = nowMs();
  let changed = false;
  if (cleanDebuffs(st)) changed = true;
  activeBuffs(st);
  const yr = yearState(st);
  if (yr.missed) {
    const ev = applyPunishment(st, `مسیر سالانه: روز ${yr.year.day} کامل نشد`, { year: true, powerPct: 8 });
    changed = true;
    st.pendingPunish = ev;
  }
  dailyQuests(st);
  const login = claimDailyLogin(st);
  if (login.ok) { st.pendingLogin = login; changed = true; }
  const titles = unlockTitles(st);
  if (titles.length) { st.pendingTitles = (st.pendingTitles || []).concat(titles); changed = true; }
  if (regenEnergy(st) > 0) changed = true;
  if (st.updatedAt !== now) { st.updatedAt = now; changed = true; }
  return changed;
}
