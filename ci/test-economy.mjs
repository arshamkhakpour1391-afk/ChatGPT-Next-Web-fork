/* تست ضدتقلب اقتصاد — npm test */
import assert from "node:assert/strict";
import {
  applyPlayGrant, applyClaimGrant, stripClientEconomy, overlayServerEconomy,
  sanitizeClaimId, trainGoldForClicks, hourlyGoldCap, dungeonGoldCap,
  TRAIN_CLICKS_PER_CALL, rejectBadNumber, GOLD_ABS_CAP
} from "../src/js/economy.js";
import { newState, packCloudState } from "../src/js/engine.js";

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + (e.stack || e).toString().split("\n").slice(0, 4).join("\n    ")); }
}

console.log("=== تست اقتصاد و ضدتقلب ===");

t("Gold inflation: save اسپم طلا نمی‌سازد", () => {
  const st = newState("hacker", "s");
  st.gold = 1e12;
  const packed = packCloudState(st);
  const stripped = stripClientEconomy(packed);
  assert.equal(stripped.gold, undefined);
  assert.ok(stripped.gold !== 1e12);
});

t("Save spam: claim_id تکراری طلا نمی‌دهد", () => {
  const claims = new Set();
  const a = applyPlayGrant({ kind: "train", claimId: "train-abc12345", n: 80, level: 5, prevClaims: claims, windowGold: 0, windowClicks: 0 });
  assert.ok(a.ok && a.gold > 0);
  claims.add(a.claimId);
  const b = applyPlayGrant({ kind: "train", claimId: "train-abc12345", n: 80, level: 5, prevClaims: claims, windowGold: 0, windowClicks: 0 });
  assert.equal(b.already, true);
  assert.equal(b.gold, 0);
});

t("Reward replay: ماموریت دوباره صفر است", () => {
  const claims = new Set(["mission-slot-01"]);
  const r = applyClaimGrant({ kind: "mission", claimId: "mission-slot-01", level: 10, prevClaims: claims });
  assert.equal(r.already, true);
});

t("Duplicate purchase: claim خرید تکراری", () => {
  const claims = new Set(["buy-12-aaaaaa"]);
  const r = applyPlayGrant({ kind: "train", claimId: "buy-12-aaaaaa", n: 40, level: 1, prevClaims: claims });
  assert.equal(r.already, true);
});

t("Duplicate mission / duel completion", () => {
  const claims = new Set(["duel-xxxxxxxx", "daily-2026-01-01"]);
  assert.equal(applyClaimGrant({ kind: "duel", claimId: "duel-xxxxxxxx", level: 8, prevClaims: claims }).already, true);
  assert.equal(applyClaimGrant({ kind: "daily", claimId: "daily-2026-01-01", level: 8, prevClaims: claims }).already, true);
});

t("Invalid XP / Level / Power / Rank: strip از payload", () => {
  const stripped = stripClientEconomy({ level: 10000, xp: 9e15, power: 9e18, rank_pts: -1, gold: 9e15, stats: { wins: 999999, kills: 9e9 } });
  assert.equal(stripped.level, undefined);
  assert.equal(stripped.xp, undefined);
  assert.equal(stripped.power, undefined);
  assert.equal(stripped.rank_pts, undefined);
  assert.equal(stripped.stats.wins, undefined);
});

t("Invalid negative / NaN / Infinity", () => {
  assert.ok(rejectBadNumber(NaN));
  assert.ok(rejectBadNumber(Infinity));
  assert.ok(rejectBadNumber(-Infinity));
  const r = applyPlayGrant({ kind: "train", claimId: "train-neg0001", n: -50, level: 3, windowGold: 0, windowClicks: 0 });
  assert.ok(r.error);
});

t("Integer overflow: سقف کلیک در هر فراخوانی", () => {
  const r = applyPlayGrant({ kind: "train", claimId: "train-ovf0001", n: 1e15, level: 1, windowGold: 0, windowClicks: 0 });
  assert.ok(r.ok);
  assert.ok(r.gold <= trainGoldForClicks(1, TRAIN_CLICKS_PER_CALL));
  assert.ok(r.gold < GOLD_ABS_CAP);
});

t("Malformed claim_id رد می‌شود", () => {
  assert.equal(sanitizeClaimId(""), null);
  assert.equal(sanitizeClaimId("x"), null);
  assert.equal(sanitizeClaimId("bad claim!!"), null);
  assert.ok(sanitizeClaimId("train-ok-1234"));
});

t("Unauthorized-like: kind خالی", () => {
  const r = applyPlayGrant({ kind: "", claimId: "train-empty01", n: 10, level: 1 });
  assert.ok(r.error);
});

t("سقف ساعتی جلوی inflation را می‌گیرد", () => {
  const cap = hourlyGoldCap(1);
  const r = applyPlayGrant({ kind: "train", claimId: "train-hour0001", n: 80, level: 1, windowGold: cap, windowClicks: 0 });
  assert.ok(r.error || r.gold === 0);
});

t("کلیک ساعتی بیش از حد رد می‌شود", () => {
  const r = applyPlayGrant({ kind: "train", claimId: "train-clk00001", n: 80, level: 2, windowGold: 0, windowClicks: 4800 });
  assert.ok(r.error);
});

t("دانجن بدون سطح طلا نمی‌دهد", () => {
  const r = applyPlayGrant({ kind: "dungeon", claimId: "dungeon-0001", index: 5000, level: 1, windowDungeons: 0, windowGold: 0 });
  assert.ok(r.error || r.gold === 0);
});

t("دانجن معتبر طلا محدود دارد", () => {
  const r = applyPlayGrant({ kind: "dungeon", claimId: "dungeon-0002", index: 0, level: 10, windowDungeons: 0, windowGold: 0 });
  assert.ok(r.ok && r.gold > 0 && r.gold <= dungeonGoldCap(10, 0));
});

t("باس ساعتی سقف دارد", () => {
  const r = applyPlayGrant({ kind: "boss", claimId: "boss-hour-001", index: 0, level: 20, windowBosses: 40, windowGold: 0 });
  assert.ok(r.error);
});

t("Replay of old valid request", () => {
  const claims = new Set();
  const a = applyClaimGrant({ kind: "login", claimId: "login-20260821", level: 4, prevClaims: claims, windowGold: 0 });
  assert.ok(a.ok);
  claims.add(a.claimId);
  const b = applyClaimGrant({ kind: "login", claimId: "login-20260821", level: 4, prevClaims: claims, windowGold: 0 });
  assert.equal(b.already, true);
});

t("Concurrent duplicate ids: فقط اولی طلا می‌دهد", () => {
  const claims = new Set();
  const results = [];
  for (let i = 0; i < 5; i++) {
    const r = applyPlayGrant({ kind: "train", claimId: "train-conc0001", n: 40, level: 3, prevClaims: claims, windowGold: 0, windowClicks: 0 });
    if (r.ok && !r.already) claims.add(r.claimId);
    results.push(r);
  }
  assert.equal(results.filter((x) => x.ok && !x.already).length, 1);
});

t("Network retry همان claim طلای دوباره نمی‌دهد", () => {
  const claims = new Set(["train-retry001"]);
  const r = applyPlayGrant({ kind: "train", claimId: "train-retry001", n: 100, level: 6, prevClaims: claims, windowGold: 0, windowClicks: 0 });
  assert.equal(r.already, true);
});

t("Offline overlay: ستون سرور طلای جعلی کلاینت را می‌شوید", () => {
  const st = newState("t", "s");
  st.gold = 999999999;
  overlayServerEconomy(st, { gold: 80, xp: 0, level: 1, gems: 2, rank_pts: 1000, wins: 0, losses: 0, kills: 0 });
  assert.equal(st.gold, 80);
  assert.equal(st.level, 1);
});

t("Cross-user: claim_id فقط با prevClaims همان کاربر معنی دارد", () => {
  const userA = new Set(["train-shared01"]);
  const userB = new Set();
  const r = applyPlayGrant({ kind: "train", claimId: "train-shared01", n: 20, level: 1, prevClaims: userB, windowGold: 0, windowClicks: 0 });
  assert.ok(r.ok);
});

console.log(`\n=== اقتصاد: ${passed} موفق، ${failed} ناموفق ===`);
if (failed) process.exit(1);
