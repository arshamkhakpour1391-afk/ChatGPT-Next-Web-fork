/* ================= تولید محتوای بازی (۱۰هزار دانجن، ۱۰۰۰ باس، ۱۰هزار تکنیک، ۱۰هزار وسیله) ================= */
import { mulberry32, seedOf, pick, range, hashStr } from "./util.js";

export const RANKS = [
  { key: "E",  name: "رتبهٔ E",  cls: "rank-E",  color: "#c8ccd8", mult: 1 },
  { key: "D",  name: "رتبهٔ D",  cls: "rank-D",  color: "#2eff7e", mult: 2.2 },
  { key: "C",  name: "رتبهٔ C",  cls: "rank-C",  color: "#4f7cff", mult: 5 },
  { key: "B",  name: "رتبهٔ B",  cls: "rank-B",  color: "#7c5cff", mult: 11 },
  { key: "A",  name: "رتبهٔ A",  cls: "rank-A",  color: "#ff2d9b", mult: 24 },
  { key: "S",  name: "رتبهٔ S",  cls: "rank-S",  color: "#ffc93c", mult: 52 },
  { key: "SS", name: "رتبهٔ SS", cls: "rank-SS", color: "#ff2d55", mult: 115 },
  { key: "N",  name: "سطح ملی",  cls: "rank-N",  color: "#2ad4ff", mult: 250 },
  { key: "M",  name: "سایهٔ پادشاه", cls: "rank-M", color: "#c07cff", mult: 550 },
];
export function rankOfLevel(level) {
  if (level >= 1000) return { key: "M+", name: "پادشاه سایه‌ها", cls: "rank-M", color: "#c07cff", mult: 3000 };
  if (level >= 651) return RANKS[8];
  if (level >= 401) return RANKS[7];
  if (level >= 251) return RANKS[6];
  if (level >= 151) return RANKS[5];
  if (level >= 101) return RANKS[4];
  if (level >= 61)  return RANKS[3];
  if (level >= 31)  return RANKS[2];
  if (level >= 11)  return RANKS[1];
  return RANKS[0];
}
export function rankByIndex(i) { return RANKS[Math.max(0, Math.min(RANKS.length - 1, i))]; }
export function rankOfIndex(i) {
  if (i >= 9) return rankByIndex(8);
  return rankByIndex(i);
}

/* ---------- واژه‌نامه‌های فارسی ---------- */
const ADJ = ["سوخته", "خونین", "نفرین‌شده", "خاموش", "یخ‌زده", "آتشین", "سیاه", "بنفش", "کهن", "گمشده", "شکسته", "طوفانی", "سمّی", "شبح‌وار", "نقره‌ای", "سرمه‌ای", "خشمگین", "ابدی", "فراموش‌شده", "گریان", "بی‌ستاره", "ممنوعه", "زال", "تشنه", "بی‌سایه", "زلزله‌ای", "ابری", "ماه‌خوار", "گرگینه", "اهریمنی", "سرگردان", "لرزان", "توفنده", "پژمرده", "ناپاک", "بی‌روح", "سنگین", "شوم", "خراب", "واژگون"];
const NOUN = ["کولدرا", "دروازه", "معبد", "غار", "دژ", "برج", "سیاهچال", "تالار", "ژرفا", "ویرانه", "قصر", "مزار", "جنگل", "کویر", "پرتگاه", "هزارتو", "ارگ", "مقبره", "چاه", "بیشه", "گذرگاه", "دشت", "کوهستان", "باتلاق", "دالان", "شهر", "جزیره", "کوره", "آبشار", "تنگه", "قلعه", "کاروانسرا", "زیارتگاه", "برزخ", "کوره‌راه", "چشمه", "دروازه‌ی تاریک", "سرزمین سوخته", "جنگل سیاه", "تالار پادشاهان"];
const MONSTERS = ["گابلین", "گرگ یخی", "عقاب شاخدار", "هیولای سنگی", "اُرک", "خنجرزن سایه", "لاشخور", "افعی سمی", "عنکبوت غول", "گولم", "مرد مرده", "نفرین‌خورده", "شیطان بال‌دار", "غول دو سر", "جادوگر تاریکی", "سوار سایه", "اژدهای کوچک", "گراز جهنمی", "کریکن", "تایتان"];
const BOSS_NAMES = ["کائرون", "ولکان", "موربیوس", "آرکانا", "زالتار", "نوکتیس", "اریس", "تانتالوس", "سربروس", "هیدرا", "گارم", "فنریر", "آشورا", "اونی", "مارباس", "بلتیا", "کیمبر", "زالگور", "وُلدِمار", "نِکرون", "گریمور", "سِلِنه", "آرگوس", "لاویتان", "دوراگان", "ایمیر", "سورما", "کارناک", "رِوِن", "زیگر", "مورته", "نِرو", "بالتازار", "آزموت", "دامیِن", "کاگو", "سِث", "اوزیریس", "آنوبیس", "هلیوس"];
const BOSS_EPITHETS = ["پادشاه خشم", "نگهبان دروازه", "سایهٔ نخستین", "بلعندهٔ نور", "فرماندهٔ مردگان", "چشم تاریکی", "نفَس زمستان", "خون‌نوش", "ویرانگر قصرها", "سوگند شکسته", "آواز مرگ", "تاج‌دار خاکستر", "زادهٔ آتشفشان", "زمزمه‌گر ژرفا", "سوار آخرین شب", "شکارچی شکارچیان", "بیدارِ مقبره", "گرداب خشم", "تاج تاریکی", "فرمانروای سایه‌ها"];
const ENEMY_EMOJI = ["👹", "👺", "💀", "👻", "🐺", "🦂", "🐍", "🕷️", "🦇", "🐲", "🐉", "🦅", "🐗", "🐂", "🦁", "🐯", "🐻", "🦈", "🐊", "🗿"];
const BOSS_EMOJI = ["👹", "💀", "🐲", "👺", "🧌", "🦂", "🐉", "🕷️", "👁️", "🗿", "🐺", "🦇", "🐍", "🦅", "🐗", "🔥", "⚡", "🌑", "🩸", "⚔️"];

export const ELEMENTS = ["آتش", "یخ", "رعد", "سایه", "سم", "نور"];
export function elementOf(i) { return ELEMENTS[((i % 6) + 6) % 6]; }
export const ARCHETYPES = [
  { key: "brute", name: "وحشی", atk: 1.22, def: 0.82, hp: 1.05, tag: "آسیب بالا" },
  { key: "tank", name: "زره‌پوش", atk: 0.82, def: 1.45, hp: 1.28, tag: "سخت‌جان" },
  { key: "assassin", name: "قاتل", atk: 1.35, def: 0.7, hp: 0.78, tag: "کریت و سرعت" },
  { key: "mage", name: "جادوگر", atk: 1.12, def: 0.75, hp: 0.9, tag: "مهارت‌های جادویی" },
  { key: "summoner", name: "احضارگر", atk: 0.95, def: 0.95, hp: 1.1, tag: "سایه احضار می‌کند" },
  { key: "venom", name: "زهرآگین", atk: 1.05, def: 0.9, hp: 1.0, tag: "سم مداوم" },
  { key: "berserk", name: "خشمگین", atk: 1.4, def: 0.65, hp: 0.88, tag: "خشم زودهنگام" },
  { key: "warden", name: "نگهبان", atk: 0.9, def: 1.25, hp: 1.15, tag: "سپر می‌سازد" },
  { key: "phantom", name: "شبح", atk: 1.08, def: 0.72, hp: 0.84, tag: "جاخالی زیاد" },
  { key: "titan", name: "غول", atk: 0.86, def: 1.12, hp: 1.62, tag: "جان عظیم" },
  { key: "lich", name: "لیچ", atk: 1.18, def: 0.8, hp: 0.94, tag: "سرقت جان" },
  { key: "raider", name: "غارتگر", atk: 1.16, def: 0.84, hp: 0.96, tag: "طلا می‌دزدد" },
  { key: "paladin", name: "پالادین", atk: 0.92, def: 1.18, hp: 1.22, tag: "شفا در نبرد" },
  { key: "frost", name: "یخ‌بندان", atk: 1.04, def: 1.08, hp: 1.06, tag: "حمله را کند می‌کند" },
  { key: "storm", name: "طوفان", atk: 1.2, def: 0.78, hp: 0.92, tag: "ضربهٔ زنجیره‌ای" },
  { key: "devourer", name: "بلعنده", atk: 1.14, def: 0.88, hp: 1.08, tag: "سپر را می‌خورد" },
];
export function archetypeOf(i) { return ARCHETYPES[((i % ARCHETYPES.length) + ARCHETYPES.length) % ARCHETYPES.length]; }
export const ELEMENT_BEATS = { "آتش": "یخ", "یخ": "رعد", "رعد": "سایه", "سایه": "نور", "نور": "سم", "سم": "آتش" };
export function elementMult(atkEl, defEl) {
  if (!atkEl || !defEl) return 1;
  if (ELEMENT_BEATS[atkEl] === defEl) return 1.35;
  if (ELEMENT_BEATS[defEl] === atkEl) return 0.8;
  return 1;
}

/* ---------- دانجن‌ها (۱۰٬۰۰۰) ---------- */
export const DUNGEON_COUNT = 10000;
export function dungeonIndex(i) {
  const rng = mulberry32(seedOf("dungeon", i));
  const level = Math.floor(i / 10) + 1;            // هر سطح ۱۰ دانجن → تا سطح ۱۰۰۰
  const tier = Math.min(9, Math.floor(i / 1000));   // ۰..۹
  const rank = rankOfIndex(tier);
  const adj = ADJ[Math.floor(rng() * ADJ.length)];
  const noun = NOUN[Math.floor(rng() * NOUN.length)];
  const isBossGate = i % 10 === 9 || level === 1000;
  const name = level === 1000
    ? "دروازهٔ نهایی: تختگاه پادشاه سایه‌ها"
    : (isBossGate ? `${noun} ${adj} — دروازهٔ باس` : `${noun} ${adj}`);
  const monster = MONSTERS[Math.floor(rng() * MONSTERS.length)];
  const waves = 3 + (i % 4);
  const enemyPower = Math.floor(40 * Math.pow(level, 1.55) * rank.mult * (0.8 + rng() * 0.4));
  const bossPower = Math.floor(enemyPower * (2.4 + rng()));
  const gold = Math.floor(28 * Math.pow(level, 1.8) * rank.mult * (0.85 + rng() * 0.3));
  const xp = Math.floor(46 * Math.pow(level, 1.72) * rank.mult * (0.85 + rng() * 0.3));
  const essenceChance = Math.min(0.5, 0.04 + tier * 0.045 + (isBossGate ? 0.06 : 0));
  const story = makeDungeonStory(rng, noun, adj, monster, level, tier);
  return {
    i, level, tier, rank,
    name, monster, waves, enemyPower, bossPower,
    isBossGate, gold, xp, essenceChance,
    emoji: ENEMY_EMOJI[Math.floor(rng() * ENEMY_EMOJI.length)],
    bossEmoji: BOSS_EMOJI[Math.floor(rng() * BOSS_EMOJI.length)],
    story,
    element: ELEMENTS[i % ELEMENTS.length],
    archetype: archetypeOf(i)
  };
}
function makeDungeonStory(rng, noun, adj, monster, level, tier) {
  const openers = [
    `در اعماق «${noun} ${adj}»، ارتشی از ${monster}ها بیدار شده‌اند و هیچ شکارچی دیگری جرات ورود ندارد.`,
    `«${noun} ${adj}» قرن‌ها بسته بود؛ حالا دروازه‌اش باز شده و نفس ${monster}ها از آن بیرون می‌زند.`,
    `شکارچی‌های رده‌پایین که وارد «${noun} ${adj}» شدند، هرگز برنگشتند. آخرین پیامشان فقط یک کلمه بود: ${monster}.`,
    `انجمن، «${noun} ${adj}» را منطقهٔ قرمز اعلام کرده. موج ${monster}ها هر ساعت قوی‌تر می‌شود.`
  ];
  const mids = [
    "در انتهای مسیر، نگهبان دروازه انتظار می‌کشد. فقط شکارچیِ به‌اندازهٔ کافی قوی زنده بیرون می‌آید.",
    "بوی گوگرد و خون، هوای دانجن را سنگین کرده. هر قدم یعنی یک نبرد دیگر.",
    "داستان می‌گویند گنجی کهن زیر تختگاه نگهبان دفن شده؛ اما هیچ‌کس آن را ندیده است."
  ];
  const endings = tier >= 7
    ? "این یکی از عمیق‌ترین دروازه‌هایی است که بشر دیده. زنده ماندن، خودش یک افسانه است."
    : level >= 400
      ? "تنها شکارچی‌های سطح بالا می‌توانند این دروازه را پاکسازی کنند."
      : "با آمادگی کامل وارد شو؛ اینجا جای اشتباه نیست.";
  return pick(rng, openers) + " " + pick(rng, mids) + " " + endings;
}

/* ---------- باس‌ها (۱۰۰۰) ---------- */
export const BOSS_COUNT = 1000;
export function bossIndex(i) {
  const rng = mulberry32(seedOf("boss", i));
  const level = i + 1;
  const rank = rankOfLevel(level);
  const nm = BOSS_NAMES[Math.floor(rng() * BOSS_NAMES.length)];
  const ep = BOSS_EPITHETS[Math.floor(rng() * BOSS_EPITHETS.length)];
  const name = `${nm}، ${ep}`;
  const hp = Math.floor(260 * Math.pow(level, 1.6) * rank.mult * (0.9 + rng() * 0.25));
  const atk = Math.floor(22 * Math.pow(level, 1.45) * rank.mult * (0.9 + rng() * 0.25));
  const def = Math.floor(8 * Math.pow(level, 1.4) * rank.mult * (0.8 + rng() * 0.3));
  const gold = Math.floor(60 * Math.pow(level, 1.85) * rank.mult * (0.85 + rng() * 0.3));
  const xp = Math.floor(90 * Math.pow(level, 1.75) * rank.mult * (0.85 + rng() * 0.3));
  const essenceChance = Math.min(0.65, 0.06 + rank.mult / 1600 + rng() * 0.1 + (i % 10 === 9 ? 0.1 : 0));
  const skills = makeBossSkills(rng, level);
  const lore = makeBossLore(rng, nm, ep, level);
  return {
    i, level, rank, name, hp, atk, def, gold, xp, essenceChance,
    skills, lore, emoji: BOSS_EMOJI[Math.floor(rng() * BOSS_EMOJI.length)],
    element: ELEMENTS[i % ELEMENTS.length],
    archetype: archetypeOf(i)
  };
}
function makeBossSkills(rng, level) {
  const pool = [
    { name: "ضربهٔ خردکننده", mult: 2.0, cd: 6000, color: "#ff2d55" },
    { name: "نَفَس آتشین", mult: 1.6, cd: 8000, color: "#ff8a2a" },
    { name: "فریاد وحشت", mult: 1.2, cd: 10000, color: "#ffc93c", debuff: true },
    { name: "چنگال سایه", mult: 1.8, cd: 7000, color: "#9b30ff" },
    { name: "باران نیزه", mult: 2.2, cd: 12000, color: "#2ad4ff" },
    { name: "گاز سمی", mult: 1.4, cd: 9000, color: "#2eff7e", dot: true },
    { name: "طوفان استخوان", mult: 2.4, cd: 13000, color: "#c8ccd8" },
    { name: "بلع نور", mult: 1.9, cd: 11000, color: "#ffd76b", drain: true },
    { name: "یخ‌زدگی مطلق", mult: 1.35, cd: 10000, color: "#2ad4ff", freeze: true },
    { name: "غارت روح", mult: 1.5, cd: 8500, color: "#ffc93c", steal: true },
  ];
  const n = Math.min(3, 2 + Math.floor(level / 300));
  const out = [];
  const copy = pool.slice();
  for (let k = 0; k < n && copy.length; k++) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}
function makeBossLore(rng, nm, ep, level) {
  const parts = [
    `${nm} قرن‌ها در تاریکی خوابیده بود تا اینکه دروازه‌ها باز شدند.`,
    `انجمن شکارچیان برای سر ${nm} جایزه گذاشته؛ اما هیچ‌کس جرات نزدیک شدن ندارد.`,
    `می‌گویند ${nm} روزی یک شکارچی سطح S را با یک دست له کرده است.`,
    `${nm} از خون کسانی که شکست داده تغذیه می‌کند و قوی‌تر می‌شود.`
  ];
  return pick(rng, parts) + (level >= 500 ? " قدرت او فراتر از هر چیزی است که تا حالا دیده‌ای." : "");
}

/* ---------- مهارت‌ها / تکنیک‌ها (۱۰٬۰۰۰) — SK_TYPES ثابت می‌ماند ---------- */
export const SKILL_COUNT = 10000;
const SK_TYPES = [
  { key: "dmg",   name: "آسیب",   icon: "⚔️", passive: false },
  { key: "crit",  name: "کریت",   icon: "💥", passive: true },
  { key: "heal",  name: "شفا",    icon: "💚", passive: false },
  { key: "shield",name: "سپر",    icon: "🛡️", passive: false },
  { key: "rage",  name: "خشم",    icon: "🔥", passive: false },
  { key: "poison",name: "سم",     icon: "☠️", passive: false },
  { key: "vamp",  name: "خون‌آشام", icon: "🩸", passive: true },
  { key: "dodge", name: "جاخالی", icon: "💨", passive: true },
  { key: "reflect",name: "بازتاب", icon: "🪞", passive: true },
  { key: "freeze",name: "یخ‌زدگی", icon: "❄️", passive: false },
  { key: "blind", name: "نابینایی", icon: "🌑", passive: false },
  { key: "silence",name: "سکوت",  icon: "🔇", passive: false },
  { key: "meteor",name: "شهاب",   icon: "☄️", passive: false },
  { key: "chain", name: "صاعقهٔ زنجیره‌ای", icon: "⚡", passive: false },
  { key: "summon",name: "احضار سایه", icon: "👤", passive: false },
  { key: "focus", name: "تمرکز",  icon: "🧠", passive: true },
  { key: "greed", name: "طمع",    icon: "💰", passive: true },
  { key: "haste", name: "سرعت",   icon: "⚡", passive: true },
  { key: "tough", name: "جان‌سخت", icon: "❤️", passive: true },
  { key: "energy",name: "انرژی",  icon: "🔋", passive: true },
  { key: "slayer",name: "باس‌کش", icon: "🗡️", passive: true },
  { key: "hunter",name: "شکارچی سایه", icon: "🌫️", passive: true },
  { key: "aoe",   name: "ضربهٔ فراگیر", icon: "🌪️", passive: false },
  { key: "execute",name: "اعدام", icon: "🩻", passive: false },
  { key: "regen", name: "بازیابی", icon: "♻️", passive: true },
  { key: "barrier",name: "حصار", icon: "🧱", passive: false },
  { key: "cleave",name: "شکاف",  icon: "🪓", passive: false },
  { key: "snipe", name: "تیر مرگ", icon: "🎯", passive: false },
  { key: "vortex",name: "گرداب", icon: "🌀", passive: false },
  { key: "iron",  name: "پوست آهنین", icon: "🦾", passive: true },
];
const SK_PRE = ["تیغ", "ضربه", "حلقه", "آتش", "یخ", "صاعقه", "سایه", "طوفان", "نفرین", "برکت", "رقص", "خشم", "آوای", "نگاه", "قلب", "دست", "بال", "زنجیر", "نیزه", "شمشیر", "غرش", "لبخند", "سوگند", "ستاره", "روح", "مشت", "گام", "نفس", "چشم", "تاج", "در", "پرده", "اشک", "زمزمه", "فرمان", "خون", "استخوان", "خاکستر", "ماه", "خورشید"];
const SK_SUF = ["ویرانگر", "جاودان", "سوزان", "خاموش", "بی‌پایان", "شبح", "پادشاه", "تاریکی", "نور", "مرگ", "زندگی", "شکست", "پیروزی", "تنهایی", "گرگ", "عقاب", "اژدها", "شب", "سپیده‌دم", "بیابان", "اقیانوس", "کوهستان", "فراموشی", "آرامش", "فریاد", "سکوت", "بی‌رحمی", "قدرت", "شجاعت", "ترس"];
export function skillIndex(i) {
  const rng = mulberry32(seedOf("skill", i));
  const type = SK_TYPES[Math.floor(rng() * SK_TYPES.length)];
  const pre = SK_PRE[Math.floor(rng() * SK_PRE.length)];
  const suf = SK_SUF[Math.floor(rng() * SK_SUF.length)];
  const name = `${pre}ِ ${suf}`;
  const rankIdx = Math.min(8, Math.floor(i / 111));
  const rank = rankOfIndex(rankIdx);
  const pct = 6 + Math.floor(rng() * 20) + rankIdx * 4;
  const dmgPct = 150 + Math.floor(rng() * 120) + rankIdx * 60;
  let desc = "";
  switch (type.key) {
    case "dmg": desc = `ضربه‌ای به قدرت ${dmgPct}٪ آسیب وارد می‌کند`; break;
    case "crit": desc = `شانس ضربهٔ بحرانی +${pct}٪`; break;
    case "heal": desc = `${pct}٪ جان خود را فوراً بازیابی می‌کند`; break;
    case "shield": desc = `سپری برابر ${pct}٪ آسیب می‌سازد`; break;
    case "rage": desc = `آسیب +${pct + 20}٪ برای ۱۰ ثانیه`; break;
    case "poison": desc = `${pct}٪ آسیب مداوم برای ۸ ثانیه`; break;
    case "vamp": desc = `${Math.min(30, pct)}٪ از آسیب، تبدیل به جان می‌شود`; break;
    case "dodge": desc = `شانس جاخالی +${pct}٪`; break;
    case "reflect": desc = `${pct}٪ آسیب را به دشمن برمی‌گرداند`; break;
    case "freeze": desc = `دشمن را ۳ ثانیه منجمد می‌کند`; break;
    case "blind": desc = `دقت دشمن ${pct}٪ کم می‌شود`; break;
    case "silence": desc = `مهارت‌های دشمن را ۵ ثانیه قفل می‌کند`; break;
    case "meteor": desc = `شهاب‌سنگ با آسیب ${dmgPct + 120}٪`; break;
    case "chain": desc = `صاعقهٔ زنجیره‌ای به ${2 + rankIdx} هدف`; break;
    case "summon": desc = `یک سایه برای ${5 + rankIdx} ثانیه می‌جنگد`; break;
    case "focus": desc = `XP تمرین و نبرد +${pct}٪`; break;
    case "greed": desc = `طلا +${pct}٪`; break;
    case "haste": desc = `سرعت حمله +${pct}٪`; break;
    case "tough": desc = `جان حداکثر +${pct}٪`; break;
    case "energy": desc = `انرژی حداکثر +${pct}٪`; break;
    case "slayer": desc = `آسیب به باس‌ها +${pct + 15}٪`; break;
    case "hunter": desc = `شانس استخراج سایه +${pct}٪`; break;
    case "aoe": desc = `به همهٔ دشمنان ${dmgPct - 40}٪ آسیب`; break;
    case "execute": desc = `اگر جان دشمن زیر ۲۵٪ باشد: اعدام`; break;
    case "regen": desc = `هر ۵ ثانیه ${Math.ceil(pct / 4)}٪ جان برمی‌گردد`; break;
    case "barrier": desc = `حصاری که ${pct}٪ آسیب را جذب می‌کند`; break;
    case "cleave": desc = `شکاف سنگین با آسیب ${dmgPct + 60}٪`; break;
    case "snipe": desc = `تیر مرگ با شانس کریت ${pct}٪`; break;
    case "vortex": desc = `گرداب با آسیب ${dmgPct}٪ و دفع دشمن`; break;
    case "iron": desc = `دفاع +${pct}٪`; break;
    default: desc = `افکت ویژه`; break;
  }
  // شرط باز شدن: باید گرایند کنی!
  const reqPool = [
    { t: "level", n: Math.max(2, rankIdx * 12 + 2), label: (n) => `رسیدن به سطح ${n}` },
    { t: "clicks", n: 400 * Math.pow(2, rankIdx), label: (n) => `${n} کلیک تمرین` },
    { t: "kills", n: 10 * Math.pow(2.2, rankIdx), label: (n) => `کشتن ${n} باس` },
    { t: "dungeons", n: 8 * Math.pow(2, rankIdx), label: (n) => `پاکسازی ${n} دانجن` },
    { t: "duels", n: 2 * Math.pow(1.8, rankIdx), label: (n) => `${n} برد در رقابت` },
    { t: "extract", n: 1 + rankIdx, label: (n) => `استخراج ${n} سایه` },
  ];
  const req = reqPool[Math.floor(rng() * reqPool.length)];
  const reqLabel = req.label(Math.max(1, Math.floor(req.n)));
  return {
    i, name, rank, type, desc,
    icon: type.icon,
    pct, dmgPct,
    passive: type.passive,
    cd: type.passive ? 0 : 6000 + Math.floor(rng() * 8000),
    req: { t: req.t, n: Math.max(1, Math.floor(req.n)), label: reqLabel }
  };
}
export function getSkill(i) { return skillIndex(i); }

/* ---------- آیتم‌های فروشگاه (۱۰۰+) ---------- */
export const SHOP_CATS = [
  { key: "weapon", name: "سلاح‌ها", icon: "⚔️" },
  { key: "armor", name: "زره‌ها", icon: "🛡️" },
  { key: "potion", name: "معجون‌ها", icon: "🧪" },
  { key: "scroll", name: "طومارها", icon: "📜" },
  { key: "stone", name: "سنگ‌های سایه", icon: "🔮" },
  { key: "title", name: "عنوان‌ها", icon: "🏅" },
  { key: "special", name: "ویژه", icon: "💎" },
];
const WEAPONS = ["خنجر فولادی", "شمشیر کوتاه", "نیزهٔ شکارچی", "تبر نبرد", "کمان سایه", "داس مرگ", "کاتانای سیاه", "چکش تیتان", "شمشیر نور", "تیغ سایهٔ پادشاه", "نیزهٔ اژدها", "خنجر زهرآلود", "شمشیر آذرخش", "تبر یخی", "کمان ستاره", "داس دروگر", "کاتانای سرخ", "چکش ویرانگر", "شمشیر فرشته", "تیغ پایان", "خنجر ماه", "نیزهٔ صاعقه", "شمشیر شبح", "تبر جهنم", "کمان شکارچی"];
const ARMORS = ["زرهٔ چرمی", "زرهٔ زنجیری", "زرهٔ پولادی", "سپر سنگی", "زرهٔ گرگ", "زرهٔ اژدها", "شنل سایه", "زرهٔ شبح", "سپر نور", "زرهٔ پادشاه", "شنل سیاه", "زرهٔ آذرخش", "سپر یخی", "زرهٔ فرشته", "زرهٔ پایان", "زرهٔ گابلین", "زرهٔ عنکبوتی", "زرهٔ نقره‌ای", "زرهٔ آتشین", "زرهٔ ابدیت"];
const POTIONS = [
  { name: "معجون جان کوچک", heal: 30 }, { name: "معجون جان متوسط", heal: 60 },
  { name: "معجون جان بزرگ", heal: 100 }, { name: "اکسیر جان کامل", heal: 100 },
  { name: "معجون انرژی", energy: 10 }, { name: "اکسیر انرژی", energy: 25 },
  { name: "معجون خشم", rage: 1 }, { name: "معجون سرعت", haste: 1 },
  { name: "معجون تمرکز", focus: 1 }, { name: "معجون شانس", luck: 1 },
  { name: "معجون جان گابلین", heal: 15 }, { name: "معجون جان گرگ", heal: 45 },
  { name: "معجون جان اژدها", heal: 80 }, { name: "اکسیر انرژی اعلا", energy: 40 },
  { name: "معجون دفاع", def: 1 }, { name: "معجون حمله", atk: 1 },
  { name: "معجون خون‌آشام", vamp: 1 }, { name: "معجون سایه", shadow: 1 },
  { name: "معجون طمع", greed: 1 }, { name: "معجون جاودانگی", regen: 1 },
];
const SCROLLS = [
  { name: "طومار XP کوچک", xp: 200 }, { name: "طومار XP متوسط", xp: 1500 },
  { name: "طومار XP بزرگ", xp: 8000 }, { name: "طومار طلای کوچک", gold: 500 },
  { name: "طومار طلای بزرگ", gold: 8000 }, { name: "طومار کلید دانجن", key: 1 },
  { name: "طومار محافظت (یک مجازات لغو می‌شود)", protect: 1 }, { name: "طومار دوبارهٔ شانس", reroll: 1 },
  { name: "طومار XP عظیم", xp: 30000 }, { name: "طومار طلای عظیم", gold: 30000 },
  { name: "طومار انرژی کامل", fullEnergy: 1 }, { name: "طومار برکت سال", yearBoost: 1 },
];
const STONES = [
  { name: "سنگ سایهٔ کوچک", boost: 5 }, { name: "سنگ سایهٔ متوسط", boost: 10 },
  { name: "سنگ سایهٔ بزرگ", boost: 18 }, { name: "سنگ سایهٔ اعلا", boost: 30 },
  { name: "گوی سایه‌ها", boost: 50 }, { name: "قلب سایه", boost: 75 },
  { name: "تکهٔ سایهٔ کهن", boost: 12 }, { name: "بلور سایهٔ ارغوانی", boost: 22 },
  { name: "تاج سایه‌ها", boost: 60 }, { name: "روح پادشاه سایه", boost: 90 },
];
const SHOP_TITLES = [
  { name: "عنوان: مبتدی", pow: 5 }, { name: "عنوان: شکارچی", pow: 15 },
  { name: "عنوان: نابودگر", pow: 40 }, { name: "عنوان: گرگ تنها", pow: 90 },
  { name: "عنوان: پادشاه", pow: 200 }, { name: "عنوان: سایهٔ مرگ", pow: 450 },
  { name: "عنوان: افسانه", pow: 1000 }, { name: "عنوان: پادشاه سایه‌ها", pow: 2500 },
  { name: "عنوان: شبح شب", pow: 600 }, { name: "عنوان: نابودگر دروازه‌ها", pow: 1500 },
];
const SPECIALS = [
  { name: "شعلهٔ تجدید فروشگاه", rerollShop: 1 }, { name: "میکروفون ابدی (رنگ نام چت)", chatColor: 1 },
  { name: "محافظ مجازات", punishShield: 1 }, { name: "شارژ آنی انرژی", fullEnergy: 1 },
  { name: "تیکت مبارزهٔ ویژه", duelTicket: 1 }, { name: "جعبهٔ شانس", box: 1 },
  { name: "کلید دروازهٔ مخفی", secretKey: 1 }, { name: "زنگولهٔ سیستم", sysBell: 1 },
];

export const SHOP_ITEMS = (() => {
  const items = [];
  let id = 1;
  const add = (cat, name, icon, desc, price, effects) => {
    items.push({ id: id++, cat, name, icon, desc, price, effects: effects || {} });
  };
  WEAPONS.forEach((w, idx) => {
    const atk = 8 + idx * 14 + Math.floor(idx * idx * 0.8);
    add("weapon", w, "⚔️", `حمله +${atk}`, { gold: Math.floor(36 * Math.pow(1.48, idx)), gem: null }, { atk, type: "weapon" });
  });
  ARMORS.forEach((a, idx) => {
    const def = 5 + idx * 9 + Math.floor(idx * idx * 0.6);
    add("armor", a, "🛡️", `دفاع +${def}`, { gold: Math.floor(28 * Math.pow(1.46, idx)), gem: null }, { def, type: "armor" });
  });
  POTIONS.forEach((p, idx) => {
    add("potion", p.name, "🧪", (p.heal ? `جان +${p.heal}٪` : p.energy ? `انرژی +${p.energy}` : "تقویت موقت"),
      { gold: (p.heal || 0) * 2.2 + (p.energy || 0) * 9 + 40 * Math.pow(1.4, idx) * 0.4, gem: idx >= 6 ? 2 : null }, p);
  });
  SCROLLS.forEach((s, idx) => {
    add("scroll", s.name, "📜", (s.xp ? `XP فوری: ${s.xp}` : s.gold ? `طلا: ${s.gold}` : s.protect ? "لغو یک مجازات" : s.key ? "کلید ورود فوری" : "تغییر جایزه"),
      { gold: (s.xp || 0) * 0.09 + (s.gold || 0) * 0.16 + 60, gem: s.xp && s.xp >= 8000 ? 5 : s.gold && s.gold >= 8000 ? 8 : null }, s);
  });
  STONES.forEach((s, idx) => {
    add("stone", s.name, "🔮", `شانس استخراج سایه +${s.boost}٪`, { gold: null, gem: 1 + Math.floor(idx * 1.8) }, s);
  });
  SHOP_TITLES.forEach((t, idx) => {
    add("title", t.name, "🏅", `قدرت +${t.pow}`, { gold: 800 * Math.pow(1.8, idx), gem: idx >= 5 ? 10 : null }, t);
  });
  SPECIALS.forEach((s) => {
    add("special", s.name, "💎", "آیتم ویژهٔ سیستم", { gem: 4 }, s);
  });
  add("special", "کتاب امتیاز مهارت", "📘", "۲ امتیاز آمار فوری", { gem: 6 }, { statPts: 2 });
  add("special", "غذای سایه", "🍖", "ارتقای فوری یک سایه", { gold: 2500, gem: null }, { shadowFood: 1 });
  add("potion", "معجون نهایی", "🧪", "شارژ مهارت نهایی در نبرد", { gold: 420, gem: null }, { ult: 1 });
  add("potion", "معجون پاری", "🧪", "بلوک بعدی پاری کامل است", { gold: 280, gem: null }, { parry: 1 });
  return items;
})();
export const CATALOG_COUNT = 100000;
export const CATALOG_BASE = 100000;
const CAT_KEYS = ["weapon", "armor", "potion", "scroll", "stone", "title", "special"];
const CAT_ICONS = { weapon: "⚔️", armor: "🛡️", potion: "🧪", scroll: "📜", stone: "🔮", title: "🏅", special: "💎" };
const GEAR_ADJ = ["کهن", "سایه‌دار", "یخ‌زده", "آتشین", "نفرین‌شده", "درخشان", "شکسته", "پادشاهی", "گم‌شده", "سمی", "رعدآسا", "شب‌گونه"];
const GEAR_NOUN = ["تیغ", "نیزه", "خنجر", "تبر", "کمان", "داس", "زره", "سپر", "شنل", "تاج", "انگشتر", "گردن‌آویز", "معجون", "طومار", "سنگ", "بلور"];
export function catalogIndex(i) {
  i = ((i % CATALOG_COUNT) + CATALOG_COUNT) % CATALOG_COUNT;
  const rng = mulberry32(seedOf("catalog", i));
  const cat = CAT_KEYS[i % CAT_KEYS.length];
  const adj = GEAR_ADJ[Math.floor(rng() * GEAR_ADJ.length)];
  const noun = GEAR_NOUN[Math.floor(rng() * GEAR_NOUN.length)];
  const tier = Math.min(8, Math.floor(i / 1250));
  const name = `${noun} ${adj} #${i + 1}`;
  const icon = CAT_ICONS[cat];
  let effects = {}, desc = "", price = { gold: 80 + i * 3, gem: null };
  if (cat === "weapon") {
    const atk = 12 + tier * 18 + Math.floor(rng() * 14);
    effects = { atk, type: "weapon" };
    desc = `حمله +${atk}`;
    price = { gold: Math.floor(90 * Math.pow(1.12, Math.min(40, tier * 5 + (i % 20)))), gem: null };
  } else if (cat === "armor") {
    const def = 8 + tier * 12 + Math.floor(rng() * 10);
    effects = { def, type: "armor" };
    desc = `دفاع +${def}`;
    price = { gold: Math.floor(70 * Math.pow(1.12, Math.min(40, tier * 5 + (i % 20)))), gem: null };
  } else if (cat === "potion") {
    const heal = 20 + (i % 5) * 15;
    effects = { heal };
    desc = `جان +${heal}٪ در نبرد`;
    price = { gold: 40 + heal * 2, gem: null };
  } else if (cat === "scroll") {
    const xp = 150 + tier * 400;
    effects = { xp };
    desc = `XP فوری: ${xp}`;
    price = { gold: 50 + Math.floor(xp * 0.08), gem: null };
  } else if (cat === "stone") {
    const boost = 4 + tier * 6;
    effects = { boost };
    desc = `شانس سایه +${boost}٪`;
    price = { gold: null, gem: 1 + Math.floor(tier / 2) };
  } else if (cat === "title") {
    const pow = 8 + tier * 40;
    effects = { pow };
    desc = `قدرت +${pow}`;
    price = { gold: 400 * (tier + 1), gem: tier >= 6 ? 8 : null };
  } else {
    effects = { box: 1 };
    desc = "جعبهٔ شانس کاتالوگ";
    price = { gem: 3 };
  }
  return { id: CATALOG_BASE + i, cat, name, icon, desc, price, effects, catalog: true, tier };
}
export function itemById(id) {
  const n = Number(id);
  if (!n) return undefined;
  const hit = SHOP_ITEMS.find((x) => x.id === n);
  if (hit) return hit;
  if (n >= CATALOG_BASE && n < CATALOG_BASE + CATALOG_COUNT) return catalogIndex(n - CATALOG_BASE);
  return undefined;
}
export function verifyItem(it) {
  if (!it || !it.id || !it.name || !it.cat) return false;
  if (!it.price || (it.price.gold == null && it.price.gem == null)) return false;
  if (!it.effects || typeof it.effects !== "object") return false;
  return String(it.name).length > 1;
}
export function shopListForCat(cat, extra = 24) {
  const base = SHOP_ITEMS.filter((it) => it.cat === cat);
  if (!extra) return base;
  const more = [];
  const slot = CAT_KEYS.indexOf(cat);
  if (slot < 0) return base;
  for (let i = slot; i < CATALOG_COUNT && more.length < extra; i += CAT_KEYS.length) more.push(catalogIndex(i));
  return base.concat(more);
}

/* ---------- ماموریت‌ها (۱۰۰۰+ ترکیب) ---------- */
export const MISSION_SLOTS = 5;
export const MISSION_INTERVAL_MS = 2 * 60 * 60 * 1000; // هر ۲ ساعت یک ماموریت جدید
const MISSION_TYPES = [
  { t: "clicks", icon: "👊", name: (n) => `تمرین سخت: ${n} کلیک`, desc: (n) => `دکمهٔ تمرین را ${n} بار بزن تا قدرتت واقعی شود.` },
  { t: "bosses", icon: "💀", name: (n) => `شکار باس: ${n} باس`, desc: (n) => `${n} باس را شکست بده. آنها واقعاً مقابله می‌کنند!` },
  { t: "dungeons", icon: "🚪", name: (n) => `پاکسازی ${n} دانجن`, desc: (n) => `${n} دروازه را پاکسازی کن.` },
  { t: "duels", icon: "⚔️", name: (n) => `برد در ${n} رقابت آنلاین`, desc: (n) => `در رقابت آنلاین ${n} برد کسب کن.` },
  { t: "chat", icon: "💬", name: (n) => `ارسال ${n} پیام در چت`, desc: (n) => `${n} پیام در چت آنلاین بفرست.` },
  { t: "shop", icon: "🛒", name: (n) => `خرید ${n} آیتم از فروشگاه`, desc: (n) => `${n} آیتم از فروشگاه سیستم بخر.` },
  { t: "extract", icon: "🌫️", name: (n) => `استخراج ${n} سایه`, desc: (n) => `${n} سایه از دشمنان شکست‌خورده استخراج کن.` },
  { t: "combo", icon: "🔥", name: (n) => `کمبوی ${n} تایی`, desc: (n) => `در تمرین به کمبوی ${n} تایی برس.` },
  { t: "gold", icon: "💰", name: (n) => `جمع‌آوری ${n} طلا`, desc: (n) => `${n} طلا به دست بیاور (از هر راهی).` },
  { t: "skills", icon: "✨", name: (n) => `استفاده از ${n} مهارت`, desc: (n) => `در نبردها ${n} بار مهارت استفاده کن.` },
  { t: "gates", icon: "🚩", name: (n) => `بازدید از ${n} دانجن سطح بالا`, desc: (n) => `وارد ${n} دانجن سطح بالا شو.` },
  { t: "energy", icon: "🔋", name: (n) => `مصرف ${n} انرژی`, desc: (n) => `${n} انرژی در نبردها مصرف کن.` },
];
export function missionOf(playerSeed, slot, bucket) {
  const rng = mulberry32(seedOf("mission", playerSeed, slot, bucket));
  const type = MISSION_TYPES[Math.floor(rng() * MISSION_TYPES.length)];
  const lvlScale = 1 + Math.floor(bucket / 8);
  const n = Math.max(1, Math.floor((2 + rng() * 6) * lvlScale * (slot === 0 ? 1.4 : 1)));
  const gold = Math.floor((120 + rng() * 300) * lvlScale * (slot === 0 ? 2 : 1));
  const xp = Math.floor((200 + rng() * 500) * lvlScale);
  const mandatory = slot === 0;
  const deadline = bucket * MISSION_INTERVAL_MS + MISSION_INTERVAL_MS * (mandatory ? 4 : 6);
  return {
    id: `${bucket}:${slot}`,
    slot, bucket, mandatory,
    type: type.t, icon: type.icon,
    title: type.name(n), desc: type.desc(n),
    n, gold, xp,
    deadline,
    reward: { gold, xp, gems: mandatory ? 1 : 0 },
    punish: mandatory ? { gold: Math.floor(gold * 0.6), power: true } : null
  };
}

/* ---------- مسیر ۳۶۵ روزه ---------- */
export const YEAR_DAYS = 365;
const YEAR_STORY = [
  "روز نخست: سیستم تو را انتخاب کرده است. اولین قدم را بردار.",
  "سایه‌ها بیدار می‌شوند؛ هنوز ضعیف‌اند اما بو می‌کشند.",
  "اولین دروازه را باز کن و ثابت کن لیاقت داری.",
  "یک شکارچی واقعی هرگز از تمرین دست نمی‌کشد.",
  "دشمنان قوی‌تر می‌شوند. تو هم باید قوی‌تر شوی.",
  "زمین زیر پایت می‌لرزد؛ چیزی در راه است.",
  "سایهٔ تو دارد شکل می‌گیرد. به آن فرمان بده.",
  "ارتش سایه‌ها را بساز؛ جنگ بزرگ نزدیک است.",
  "هر شکست یک درس است؛ هر مجازات یک هشدار.",
  "در اعماق تاریکی، پادشاه سایه‌ها در حال تماشاست.",
];
export function yearQuestDay(day) {
  const rng = mulberry32(seedOf("year", day));
  const story = YEAR_STORY[Math.floor(rng() * YEAR_STORY.length)];
  const clicks = 100 + day * 15 + Math.floor(rng() * 50);
  const kills = Math.max(0, Math.floor(day / 3)) + Math.floor(rng() * 3);
  const dungeons = Math.max(1, Math.floor(day / 7)) + (rng() < 0.5 ? 1 : 0);
  const gold = 300 + day * 25 + Math.floor(rng() * 200);
  const xp = 500 + day * 40;
  return { day, story, need: { clicks, kills, dungeons }, reward: { gold, xp, gems: day % 7 === 0 ? 2 : 1 } };
}

/* ---------- جوایز روزانهٔ لول‌آپ (هر روز متفاوت) ---------- */
export function dailyPicks(dayKey, pickIndex) {
  const rng = mulberry32(seedOf("dailyPick", dayKey, pickIndex));
  const pool = [
    { icon: "💰", name: "کیسهٔ طلا", desc: "طلا", kind: "gold" },
    { icon: "💎", name: "جواهر درخشان", desc: "جواهر", kind: "gems" },
    { icon: "📜", name: "طومار XP", desc: "تجربه فوری", kind: "xp" },
    { icon: "🧪", name: "معجون جان کامل", desc: "۳ عدد معجون", kind: "item", item: "اکسیر جان کامل", count: 3 },
    { icon: "🔮", name: "سنگ سایه", desc: "استخراج آسان‌تر", kind: "item", item: "سنگ سایهٔ کوچک", count: 2 },
    { icon: "⚡", name: "انرژی کامل", desc: "انرژی پر", kind: "energy" },
    { icon: "🛡️", name: "محافظ مجازات", desc: "یک لغو مجازات", kind: "item", item: "محافظ مجازات", count: 1 },
    { icon: "🏅", name: "عنوان شانس", desc: "عنوان تصادفی", kind: "randTitle" },
    { icon: "🗡️", name: "تیغ سایه", desc: "سلاح تصادفی", kind: "randWeapon" },
    { icon: "🩸", name: "برکت خون‌آشام", desc: "جان بیشتر", kind: "hpBonus" },
  ];
  const out = [];
  const copy = pool.slice();
  for (let k = 0; k < 3 && copy.length; k++) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}
export function itemByName(name) { return SHOP_ITEMS.find((x) => x.name === name); }
export function randomTitle() { return SHOP_TITLES[Math.floor(Math.random() * SHOP_TITLES.length)]; }
export function randomWeapon() { return WEAPONS[Math.floor(Math.random() * WEAPONS.length)]; }

/* ---------- عناوین پیشرفت ---------- */
export const TITLES = [
  { name: "مبتدی", need: () => 0 },
  { name: "شکارچی تازه‌کار", need: (st) => st.level >= 5 },
  { name: "گرگ تنها", need: (st) => (st.stats?.clicks || 0) >= 5000 },
  { name: "نابودگر باس‌ها", need: (st) => (st.stats?.bosses || 0) >= 50 },
  { name: "پاک‌کنندهٔ دروازه‌ها", need: (st) => (st.stats?.dungeons || 0) >= 100 },
  { name: "استاد رقابت", need: (st) => (st.stats?.wins || 0) >= 30 },
  { name: "پادشاه سایه‌ها", need: (st) => st.level >= 250 },
  { name: "افسانهٔ زنده", need: (st) => st.level >= 500 },
  { name: "جاودان", need: (st) => st.level >= 1000 },
];

/* ---------- کلاس شکارچی ---------- */
export function hunterClass(level) {
  if (level >= 1000) return { name: "پادشاه سایه‌ها", cls: "rank-M" };
  if (level >= 650) return { name: "سایهٔ پادشاه", cls: "rank-M" };
  if (level >= 400) return { name: "شکارچی سطح ملی", cls: "rank-N" };
  if (level >= 250) return { name: "شکارچی SS", cls: "rank-SS" };
  if (level >= 150) return { name: "شکارچی S", cls: "rank-S" };
  if (level >= 100) return { name: "شکارچی A", cls: "rank-A" };
  if (level >= 60) return { name: "شکارچی B", cls: "rank-B" };
  if (level >= 30) return { name: "شکارچی C", cls: "rank-C" };
  if (level >= 10) return { name: "شکارچی D", cls: "rank-D" };
  return { name: "شکارچی E", cls: "rank-E" };
}

// برای استفاده در engine
