/* تست‌های موتور بازی — npm test */
import assert from "node:assert/strict";
import {
  newState, xpNeed, maxEnergy, combatStats, computePower, doTrain, addXP, gainGold,
  addItem, consumeItem, buyItem, sellItem, useItem, equipWeapon, equipArmor, equipTitle,
  unlockSkill, meetsReq, toggleSkill, MAX_ACTIVE_SKILLS, skillUnlocked,
  assignShadow, extractShadow, activeMissions, applyProgress, claimMission,
  dailyQuests, claimDailyQuest, applyPunishment, activeDebuffs, tickState, yearState,
  claimYearDay, currentPicks, takePick, addRewardPick, missionBucket, calcDamage, newShadow, dailyDeals,
  claimDailyLogin, unlockTitles, addRankPts, regenEnergy, addBuff, activeBuffs, autoEquipBest, claimAllReady, dailyFeatured, achievementsOf,
  spendStat, upgradeShadow, fuseShadows, sweepDungeon, markFailedMission, comboMult, battleAtkCd, energyCap, migrateState, featuredMult, firstClearMult, packCloudState, failOverdueMissions, punishMissedDaily, applyDuelOutcome, dungeonPoolForSort, sqlPowerCap, combatStats as csExport
} from "../src/js/engine.js";
import { texUrl } from "../src/js/gfx.js";
import {
  dungeonIndex, bossIndex, skillIndex, DUNGEON_COUNT, BOSS_COUNT, SKILL_COUNT,
  SHOP_ITEMS, SHOP_CATS, itemById, itemByName, yearQuestDay, YEAR_DAYS, missionOf,
  ARCHETYPES, elementMult, CATALOG_COUNT, CATALOG_BASE, catalogIndex, shopListForCat, verifyItem,
  LEVEL_CAP, levelTag, hunterClass, rankOfLevel
} from "../src/js/data.js";

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + (e.stack || e).toString().split("\n").slice(0, 4).join("\n    ")); }
}

console.log("=== تست موتور ===");
t("منحنی سختی: سطح ۶ ≈ ۲۰۰۰ کلیک", () => {
  assert.ok(Math.abs(xpNeed(6) - 2023) < 100, "xpNeed(6)=" + xpNeed(6));
  assert.equal(xpNeed(1), 30);
  assert.ok(xpNeed(30) > 400, "سطح ۳۰ باید از ۴۰۰ کلیک بیشتر باشد");
});
t("تمرین: کلیک XP می‌دهد و سطح بالا می‌رود", () => {
  const st = newState("test", "seed");
  let leveled = 0;
  for (let i = 0; i < 5000; i++) { const ev = doTrain(st); if (ev.levelUps) leveled += ev.levelUps; }
  assert.ok(st.stats.clicks === 5000);
  assert.ok(st.level > 3, "باید حداقل سطح ۳ شده باشد: " + st.level);
  assert.ok(st.xp >= 0);
  assert.ok(st.gold >= 80, "طلای شروع نباید منفی شود: " + st.gold);
});
t("جایزه لول‌آپ: حداکثر ۳ در روز و هر انتخاب متفاوت", () => {
  const st = newState("t", "s");
  addRewardPick(st, 10);
  assert.equal(st.daily.picks.remaining, 3, "سقف ۳");
  const p1 = currentPicks(st);
  const got = takePick(st, 0);
  assert.ok(got, "انتخاب اول");
  assert.equal(st.daily.picks.remaining, 2);
  const p2 = currentPicks(st);
  assert.notDeepEqual(p1[0].name, p2[0].name, "جایزه‌های هر روز/انتخاب متفاوت");
  takePick(st, 1); takePick(st, 2);
  assert.equal(currentPicks(st).length, 0, "بعد از ۳ انتخاب تمام می‌شود");
});
t("ماموریت: اسلات صفر اجباری است و هر ۲ ساعت عوض می‌شود", () => {
  const st = newState("t", "s");
  const list = activeMissions(st);
  assert.ok(list.length >= 6);
  assert.ok(list.some((m) => m.mandatory), "ماموریت اجباری هست");
  const m = list.find((x) => x.mandatory && x.deadline > Date.now());
  assert.ok(m, "ماموریت اجباریِ فعال باید مهلت آینده داشته باشد");
});
t("ماموریت: پیشرفت و دریافت جایزه واقعی", () => {
  const st = newState("t", "s");
  const m = activeMissions(st).find((x) => x.deadline > Date.now() && !x.mandatory);
  assert.ok(m, "ماموریت فعال وجود دارد");
  applyProgress(st, m.type, m.n * 3);
  const r = claimMission(st, m.id);
  assert.ok(r.ok, "claim باید موفق باشد");
  assert.ok(st.stats.goldEarned > 0);
});
t("مجازات: طلا و قدرت کم می‌شود، محافظ جلوگیری می‌کند", () => {
  const st = newState("t", "s");
  st.gold = 1000;
  const before = computePower(st);
  const ev = applyPunishment(st, "تست", {});
  assert.ok(ev.goldLoss > 0 && st.gold < 1000);
  assert.ok(activeDebuffs(st).length === 1);
  assert.ok(computePower(st) < before, "دیباف قدرت");
  const ev2 = applyPunishment(st, "تست۲", {});
  assert.ok(st.punish.count === 2);
  // محافظ
  st.punish.shield = 1;
  const ev3 = applyPunishment(st, "تست۳", {});
  assert.ok(ev3.blocked, "محافظ باید مجازات را لغو کند");
});
t("مسیر ۳۶۵ روزه: جایزه فقط با انجام کارها", () => {
  const st = newState("t", "s");
  const r0 = claimYearDay(st);
  assert.ok(r0.error, "بدون انجام کار نمی‌شود");
  const q = yearQuestDay(st.year.day);
  applyProgress(st, "clicks", q.need.clicks + 10);
  applyProgress(st, "bosses", q.need.kills + 10);
  applyProgress(st, "dungeons", q.need.dungeons + 10);
  const r = claimYearDay(st);
  assert.ok(r.ok, "باید بشود");
  const r2 = claimYearDay(st);
  assert.ok(r2.error, "دوباره نمی‌شود");
});
t("فروشگاه: خرید واقعی از طلا کم می‌کند و به کیف می‌رود", () => {
  const st = newState("t", "s");
  st.gold = 1e12;
  const it = SHOP_ITEMS.find((x) => x.cat === "weapon" && !x.price.gem);
  const r = buyItem(st, it.id);
  assert.ok(r.ok);
  assert.ok(st.items[it.id] === 1, "آیتم به کیف رفت");
  const before = st.gold;
  buyItem(st, it.id);
  assert.ok(st.gold < before);
  const s = sellItem(st, it.id, 1);
  assert.ok(s.ok && st.gold > before - it.price.gold);
});
t("مهارت: بدون گرایند باز نمی‌شود، حداکثر ۴ فعال", () => {
  const st = newState("t", "s");
  const sk = skillIndex(100); // رنک بالاتر
  assert.ok(!meetsReq(st, sk.req), "شرط سنگین");
  const r = unlockSkill(st, 100);
  assert.ok(r.error, "نباید باز شود");
  st.stats.clicks = 1e9; st.stats.bosses = 1e6; st.stats.dungeons = 1e6; st.stats.wins = 1e6; st.stats.extracts = 100; st.level = 999; st.gold = 1e15;
  const r2 = unlockSkill(st, 100);
  assert.ok(r2.ok, "با گرایند باز می‌شود: " + JSON.stringify(sk.req));
  for (let i = 0; i < MAX_ACTIVE_SKILLS; i++) {
    const r3 = unlockSkill(st, i);
    assert.ok(r3.ok || st.skillsOwned[i], "مهارت " + i + " باز شد");
    const rr = toggleSkill(st, i);
    assert.ok(rr.ok, "فعال شد " + i);
  }
  const r4 = toggleSkill(st, 5);
  assert.ok(r4.error, "بیش از ۴ نمی‌شود");
});
t("سایه: استخراج و تخصیص حداکثر ۳", () => {
  const st = newState("t", "s");
  const r1 = extractShadow(st, { name: "تست", rankKey: "S", power: 1000, emoji: "💀", baseChance: 1.1 });
  assert.ok(r1.success, "با شانس ۱۱۰٪ حتماً موفق");
  const ids = Object.keys(st.shadows);
  assert.equal(ids.length, 1);
  const a = assignShadow(st, ids[0], true);
  assert.ok(a.ok);
  for (let i = 0; i < 5; i++) {
    const r = extractShadow(st, { name: "x" + i, rankKey: "S", power: 100, emoji: "💀", baseChance: 1.1 });
    assert.ok(r.success);
    assignShadow(st, r.id, true);
  }
  assert.equal(st.equip.shadows.length, 3, "حداکثر ۳ سایه");
});
t("محتوای تولیدی: ۱۰هزار دانجن، ۱۰هزار باس، ۱۰هزار تکنیک، ۱۰۰+ آیتم", () => {
  assert.equal(DUNGEON_COUNT, 10000);
  assert.equal(BOSS_COUNT, 10000);
  assert.equal(SKILL_COUNT, 10000);
  assert.ok(SHOP_ITEMS.length >= 100, "آیتم‌ها: " + SHOP_ITEMS.length);
  assert.equal(dungeonIndex(9999).level, 10000, "دانجن آخر = سطح ۱۰۰۰۰");
  assert.ok(dungeonIndex(9999).name.includes("پادشاه سایه"));
  assert.equal(bossIndex(999).level, 1000);
  assert.equal(bossIndex(9999).level, 10000);
  // قطعی بودن
  assert.equal(dungeonIndex(123).name, dungeonIndex(123).name);
  assert.equal(bossIndex(77).hp, bossIndex(77).hp);
  assert.equal(skillIndex(555).name, skillIndex(555).name);
  // همه مهارت‌ها شرط دارند
  for (let i = 0; i < SKILL_COUNT; i += 97) {
    const s = skillIndex(i);
    assert.ok(s.req && s.req.n >= 1 && s.req.label, "skill " + i);
    assert.ok(s.name.length > 2);
  }
  // دانجن‌ها جایزه دارند
  for (let i = 0; i < DUNGEON_COUNT; i += 777) {
    const d = dungeonIndex(i);
    assert.ok(d.gold > 0 && d.xp > 0, "dungeon " + i);
  }
  for (let i = 0; i < BOSS_COUNT; i += 173) {
    const b = bossIndex(i);
    assert.ok(b.gold > 0 && b.xp > 0 && b.hp > 0 && b.atk > 0, "boss " + i);
  }
});
t("خرید/فروش/استفاده آیتم‌ها", () => {
  const st = newState("t", "s");
  st.gold = 1e12;
  const pot = SHOP_ITEMS.find((x) => x.effects.energy);
  buyItem(st, pot.id);
  st.energy = 1;
  const r = useItem(st, pot.id);
  assert.ok(r.ok && st.energy > 1);
  const scroll = SHOP_ITEMS.find((x) => x.effects.xp);
  buyItem(st, scroll.id);
  const xp0 = st.xp;
  useItem(st, scroll.id);
  assert.ok(st.xp > xp0, "طومار XP کار می‌کند");
});
t("تجارت: خرید با جواهر", () => {
  const st = newState("t", "s");
  st.gems = 50;
  const stone = SHOP_ITEMS.find((x) => x.cat === "stone");
  const r = buyItem(st, stone.id);
  assert.ok(r.ok && st.gems < 50 && st.items[stone.id] === 1);
});
t("تخفیف روزانه: ۳ آیتم متفاوت", () => {
  const st = newState("t", "s");
  const d = dailyDeals(st);
  assert.equal(d.length, 3);
  assert.equal(new Set(d.map((x) => x.item.id)).size, 3);
  assert.ok(d.every((x) => x.discount >= 15 && x.discount <= 49));
});
t("آمار رزمی: تجهیزات قدرت را زیاد می‌کنند", () => {
  const st = newState("t", "s");
  const p0 = computePower(st);
  st.level = 10;
  const p1 = computePower(st);
  assert.ok(p1 > p0, "سطح بالاتر = قدرت بیشتر");
  const wpn = SHOP_ITEMS.find((x) => x.effects.type === "weapon");
  st.items[wpn.id] = 1;
  equipWeapon(st, wpn.id);
  assert.ok(computePower(st) > p1, "سلاح قدرت می‌دهد");
  equipArmor(st, null);
});
t("محاسبهٔ آسیب در محدودهٔ منطقی", () => {
  const d = calcDamage(100, 10, 50);
  assert.ok(d.dmg > 0 && d.dmg < 500);
  const d2 = calcDamage(10000, 10, 100, 5);
  assert.ok(d2.crit === true, "با شانس ۱۰۰٪ حتماً کریت");
});
t("تیک: دیباف منقضی پاک می‌شود و سالانهٔ ازدست‌رفته مجازات دارد", () => {
  const st = newState("t", "s");
  st.punish.debuffs.push({ until: Date.now() - 1000, powerPct: 10, label: "x" });
  tickState(st);
  assert.equal(activeDebuffs(st).length, 0);
  // شبیه‌سازی روز از دست رفته
  st.year.lastChecked = "2020-01-01";
  st.year.claimedToday = false;
  const res = tickState(st);
  assert.ok(st.pendingPunish || st.punish.count > 0, "مجازات سالانه اعمال شد");
  assert.equal(st.year.lastChecked, new Date().toLocaleDateString("en-CA"));
});
t("کمبو و بهترین کمبو ثبت می‌شود", () => {
  const st = newState("t", "s");
  for (let i = 0; i < 60; i++) doTrain(st);
  assert.ok(st.stats.bestCombo >= 10, "کمبو: " + st.stats.bestCombo);
});
t("ماموریت‌های روزانهٔ اجباری تولید و دریافت می‌شوند", () => {
  const st = newState("t", "s");
  const qs = dailyQuests(st);
  assert.ok(Object.keys(qs).length >= 3);
  const q = Object.values(qs)[0];
  applyProgress(st, q.type, q.n + 5);
  const r = claimDailyQuest(st, q.id);
  assert.ok(r.ok && r.gold > 0);
});
t("ورود روزانه: جایزه و زنجیره", () => {
  const st = newState("t", "s");
  const r = claimDailyLogin(st);
  assert.ok(r.ok && r.streak === 1 && r.gold > 0);
  const gold = st.gold;
  const r2 = claimDailyLogin(st);
  assert.ok(r2.already && st.gold === gold, "دوباره در همان روز نمی‌شود");
});
t("امتیاز رنک و عنوان‌ها", () => {
  const st = newState("t", "s");
  assert.equal(st.rank_pts, 1000);
  addRankPts(st, 25);
  assert.equal(st.rank_pts, 1025);
  addRankPts(st, -2000);
  assert.equal(st.rank_pts, 0);
  st.level = 5;
  unlockTitles(st);
  assert.ok(st.titles["شکارچی تازه‌کار"]);
});
t("معجون باف و انرژی آفلاین", () => {
  const st = newState("t", "s");
  const pot = SHOP_ITEMS.find((x) => x.effects.rage);
  addItem(st, pot.id, 1);
  const r = useItem(st, pot.id);
  assert.ok(r.ok, r.error);
  assert.ok(activeBuffs(st).some((b) => b.k === "atk"));
  const p0 = computePower(st);
  addBuff(st, "atk", 50, 60000);
  assert.ok(computePower(st) > p0, "باف قدرت می‌دهد");
  st.energy = 1;
  st.energyAt = Date.now() - 120000;
  const g = regenEnergy(st);
  assert.ok(g >= 3 && st.energy > 1, "انرژی آفلاین: " + g);
});


t("تجهیز خودکار و دستاورد و هدف روزانه", () => {
  const st = newState("t", "s");
  const w = SHOP_ITEMS.find((x) => x.effects.type === "weapon");
  st.items[w.id] = 1;
  const r = autoEquipBest(st);
  assert.ok(r.weapon && st.equip.weapon === w.id);
  assert.ok(achievementsOf(st).length >= 5);
  const f = dailyFeatured();
  assert.ok(f.dungeon >= 0 && f.boss >= 0);
});

t("امتیاز آمار و ارتقای سایه و جارو", () => {
  const st = newState("t", "s");
  st.statPts = 3;
  const p0 = computePower(st);
  assert.ok(spendStat(st, "atk").ok);
  assert.ok(computePower(st) > p0);
  assert.equal(st.statPts, 2);
  assert.ok(spendStat(st, "nope").error);
  const id = Object.keys((() => { extractShadow(st, { name: "x", rankKey: "S", power: 200, emoji: "💀", baseChance: 1.1 }); return st.shadows; })())[0];
  st.gold = 1e9;
  const u = upgradeShadow(st, id);
  assert.ok(u.ok && u.sh.lv === 2);
  extractShadow(st, { name: "y", rankKey: "E", power: 50, emoji: "👤", baseChance: 1.1 });
  const ids = Object.keys(st.shadows);
  const f = fuseShadows(st, ids[0], ids[1]);
  assert.ok(f.ok && !st.shadows[ids[1]]);
  st.dungeons[0] = { cleared: true, count: 1 };
  st.energy = 20;
  const sw = sweepDungeon(st, 0);
  assert.ok(sw.ok && sw.gold > 0);
  assert.ok(markFailedMission(st, "9:0"));
  assert.ok(!markFailedMission(st, "9:0"));
  assert.ok(comboMult(10) > 1.3);
  assert.ok(battleAtkCd({ haste: 2 }) < battleAtkCd({ haste: 1 }));
  assert.ok(energyCap(st) >= maxEnergy(st.level));
  const m = migrateState({ level: 2, gold: 10 });
  assert.equal(m.v, 4);
  assert.ok(m.settings);
  assert.ok(firstClearMult(st, "dungeon", 99) > 1);
  assert.ok(featuredMult(st, "dungeon", -1) === 1);
  assert.ok(achievementsOf(st).length >= 12);
});

t("گرایند از صفر: تمرین طلا می‌دهد و سلاح اول قابل خرید است", () => {
  const st = newState("t", "s");
  const w = SHOP_ITEMS.find((x) => x.effects && x.effects.type === "weapon");
  assert.ok(w && w.price.gold < 80, "سلاح اول باید ارزان باشد: " + w.price.gold);
  const start = st.gold;
  for (let i = 0; i < 80; i++) doTrain(st);
  assert.ok(st.gold > start, "تمرین باید طلا بدهد");
  assert.ok(st.gold >= w.price.gold, "بعد از گرایند باید سلاح اول را بخری");
  const r = buyItem(st, w.id);
  assert.ok(r.ok && st.items[w.id] === 1);
});
t("دشمن‌ها نوع و عنصر دارند", () => {
  const d = dungeonIndex(3);
  const b = bossIndex(4);
  assert.ok(d.element && d.archetype && d.archetype.name);
  assert.ok(b.element && b.archetype && b.archetype.key);
  assert.notEqual(dungeonIndex(0).archetype.key, dungeonIndex(1).archetype.key);
  assert.ok(ARCHETYPES.length >= 12, "تیپ دشمن: " + ARCHETYPES.length);
  assert.ok(ARCHETYPES.some((a) => a.key === "phantom") && ARCHETYPES.some((a) => a.key === "lich"));
  assert.ok(elementMult("آتش", "یخ") > 1);
  assert.ok(elementMult("یخ", "آتش") < 1);
  assert.equal(elementMult("آتش", "آتش"), 1);
});
t("مهاجرت ذخیره بعد از بستن برنامه", () => {
  const m = migrateState({ level: 4, gold: 20, stats: { clicks: 9 } });
  assert.equal(m.v, 4);
  assert.ok(m.settings && m.spent && m.login);
});
t("بستهٔ ابر مهارت و آمار را کامل نگه می‌دارد", () => {
  const st = newState("t", "s");
  st.skillsOwned[3] = true;
  st.equip.active = [3];
  st.spent.atk = 2;
  extractShadow(st, { name: "x", rankKey: "S", power: 80, emoji: "💀", baseChance: 1.1 });
  const p = packCloudState(st);
  assert.ok(p.skillsOwned[3]);
  assert.deepEqual(p.equip.active, [3]);
  assert.equal(p.spent.atk, 2);
  assert.ok(Object.keys(p.shadows).length === 1);
  assert.ok(p.stats && p.items);
});
t("کاتالوگ ۱۰۰هزار وسیله معتبر است", () => {
  assert.equal(CATALOG_COUNT, 100000);
  const a = catalogIndex(7);
  assert.equal(catalogIndex(7).id, a.id);
  assert.ok(verifyItem(a));
  assert.ok(itemById(a.id) && itemById(a.id).name === a.name);
  [0, 1, 99, 12345, 50000, 99999].forEach((i) => assert.ok(verifyItem(catalogIndex(i)), "item " + i));
  SHOP_ITEMS.forEach((it) => assert.ok(verifyItem(it), "shop " + it.id));
  const weps = shopListForCat("weapon", 12);
  assert.ok(weps.length > 25);
  assert.equal(weps[0].id, SHOP_ITEMS.find((x) => x.cat === "weapon").id);
  const st = newState("t", "s");
  st.gold = 1e12;
  const r = buyItem(st, a.id);
  assert.ok(r.ok && st.items[a.id] === 1);
});
t("تکسچر برداری SVG و داستان برای آیتم و باس و دروازه", () => {
  const a = catalogIndex(42);
  assert.ok(a.story && a.story.length > 24, "داستان کاتالوگ");
  assert.ok(a.tex && a.tex.indexOf("image/svg") > 0, "تکسچر کاتالوگ");
  assert.ok(a.rarity);
  const b = bossIndex(3);
  assert.ok(b.tex && b.lore && b.lore.length > 10);
  const d = dungeonIndex(9);
  assert.ok(d.tex && d.story && d.story.length > 20);
  const sk = skillIndex(8);
  assert.ok(sk.tex && sk.tex.indexOf("svg") > 0);
  SHOP_ITEMS.slice(0, 8).forEach((it) => {
    assert.ok(it.tex && it.story, "shop tex " + it.id);
    assert.ok(verifyItem(it));
  });
  [0, 777, 12345, 99999].forEach((i) => {
    const it = catalogIndex(i);
    assert.ok(verifyItem(it) && it.story && it.tex);
  });
});
t("سقف ۱۰هزار سطح و تگ نام یکتا", () => {
  assert.equal(LEVEL_CAP, 10000);
  assert.equal(levelTag(1), levelTag(1));
  assert.notEqual(levelTag(1), levelTag(2));
  const seen = new Set();
  for (let i = 1; i <= LEVEL_CAP; i += 1) seen.add(levelTag(i));
  assert.equal(seen.size, LEVEL_CAP, "تگ تکراری");
  assert.equal(hunterClass(1).name, "شکارچی E");
  assert.equal(hunterClass(1000).name, "پادشاه سایه‌ها");
  assert.equal(hunterClass(5000).name, "ارباب جهان");
  assert.equal(rankOfLevel(8000).key, "X");
  const st = newState("t", "s");
  st.xp = xpNeed(st.level) * 3;
  addXP(st, 0);
  assert.ok(st.level >= 1 && st.level <= LEVEL_CAP);
});
t("اسکن عمیق کاتالوگ ۱۰۰هزار: داستان تکسچر اثر", () => {
  let n = 0;
  for (let i = 0; i < CATALOG_COUNT; i += 97) {
    const it = catalogIndex(i);
    assert.ok(verifyItem(it), "bad " + i);
    assert.ok(it.story && it.story.length > 20, "story " + i);
    assert.ok(it.tex && it.tex.indexOf("svg") > 0, "tex " + i);
    assert.ok(Object.keys(it.effects).length > 0, "fx " + i);
    n++;
  }
  assert.ok(n > 1000);
});

t("مجازات ماموریت روزانه بدون UI", () => {
  const st = newState("t", "s");
  st.gold = 2000;
  st.daily.date = "2020-01-01";
  st.daily.quests = { q1: { id: "dq_clicks", type: "clicks", n: 10, prog: 0, done: false, claimed: false } };
  const ev = punishMissedDaily(st);
  assert.ok(ev && (ev.goldLoss > 0 || ev.blocked));
  assert.equal(st.daily.punishedFor, "2020-01-01");
  assert.equal(punishMissedDaily(st), null);
});

t("ماموریت اجباری بدون UI مجازات می‌شود", () => {
  const st = newState("t", "s");
  st.gold = 2000;
  const bucket = missionBucket(Date.now()) - 3;
  const m = missionOf(st.seed, 0, bucket);
  st.missions[m.id] = { prog: 0 };
  const ev = failOverdueMissions(st);
  assert.ok(st.missions[m.id].failed);
  assert.ok(ev && (ev.goldLoss > 0 || ev.blocked));
  const again = failOverdueMissions(st);
  assert.equal(again, null);
});

t("کاتالوگ دور از ۲۵۰ با پارامتر UI فروشگاه دیده می‌شود", () => {
  const list = shopListForCat("weapon", 180, 0);
  assert.ok(list.some((it) => it.id >= CATALOG_BASE + 1000), "با extra=180 باید id>=101000 باشد");
});
t("دانجن پاک‌شده در مرتب‌سازی done بعد از لول بالا می‌ماند", () => {
  const st = newState("t", "s");
  st.level = 8000;
  st.dungeons[3] = { cleared: true, count: 1 };
  const pool = dungeonPoolForSort(st, "done");
  assert.ok(pool.includes(3), "دانجن سطح پایین پاک‌شده باید بماند");
  const goldPool = dungeonPoolForSort(st, "gold");
  assert.ok(goldPool.includes(3));
});
t("آمار رزمی در سقف سطح منفی یا نامتناهی نیست", () => {
  const st = newState("t", "s");
  st.level = LEVEL_CAP;
  st.spent = { hp: 4000, atk: 4000, def: 1000, crit: 1000 };
  st.statPts = 0;
  const cs = combatStats(st);
  assert.ok(Number.isFinite(cs.hp) && cs.hp > 0);
  assert.ok(Number.isFinite(cs.atk) && cs.atk > 0);
  const p = computePower(st);
  assert.ok(Number.isFinite(p) && p > 0);
  assert.ok(p < sqlPowerCap(LEVEL_CAP), "قدرت مشروع باید زیر سقف SQL باشد: " + p);
  assert.ok(Number.isFinite(xpNeed(LEVEL_CAP)) && xpNeed(LEVEL_CAP) > 0);
});
t("جایزه دوئل بدون تأیید سرور داده نمی‌شود", () => {
  const st = newState("t", "s");
  const g0 = st.gold;
  const r = applyDuelOutcome(st, { won: true, confirmed: false, duelId: "x" });
  assert.ok(r.error);
  assert.equal(st.gold, g0);
  const r2 = applyDuelOutcome(st, { won: true, confirmed: true, duelId: "x", oppName: "a", mode: "click" });
  assert.ok(r2.ok && r2.gold > 0);
  const r3 = applyDuelOutcome(st, { won: true, confirmed: true, duelId: "x" });
  assert.equal(r3.error, "already");
});
t("تکسچر کش می‌شود و XP سقف محدود است", () => {
  const a = texUrl("item", 7);
  const b = texUrl("item", 7);
  assert.equal(a, b);
  assert.ok(a.indexOf("svg") > 0);
  const need = xpNeed(10000);
  assert.ok(Number.isFinite(need) && need > 0);
  assert.ok(xpNeed(LEVEL_CAP + 50) === xpNeed(LEVEL_CAP));
  assert.ok(skillIndex(8000).req.n > 50, "مهارت سطح بالا باید شرط سنگین داشته باشد");
});

console.log(`\n=== نتیجه: ${passed} موفق، ${failed} ناموفق ===`);
if (failed) process.exit(1);
