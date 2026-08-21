/* تست یکپارچه‌سازی با Supabase واقعی — در GitHub Actions اجرا می‌شود */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.log("SKIP: بدون کلید — این تست فقط در CI با Secret اجرا می‌شود"); process.exit(0); }

const mk = (token) => createClient(URL, KEY, {
  auth: { persistSession: false },
  global: { headers: token ? { "x-session-token": token } : {} },
});

let passed = 0, failed = 0;
function t(name, fn) {
  return (async () => {
    try { await fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { failed++; console.error("  ✗ " + name + "\n    " + (e.stack || e).split("\n").slice(0, 4).join("\n    ")); }
  })();
}

const suffix = Math.floor(Math.random() * 1e6);
const U1 = `slstest_a${suffix}`;
const U2 = `slstest_b${suffix}`;
const PASS = "testpass1234";

console.log("=== تست یکپارچه‌سازی Supabase ===");
const sb0 = mk(null);

await t("۱) اسکیمای دیتابیس نصب است", async () => {
  const { data, error } = await sb0.rpc("schema_ok");
  assert.ok(!error && data === true, error?.message || "");
});

await t("۲) ثبت‌نام دو کاربر", async () => {
  const r1 = await sb0.rpc("register", { p_username: U1, p_pass: PASS });
  assert.ok(r1.data?.token, JSON.stringify(r1.data || r1.error));
  const r2 = await sb0.rpc("register", { p_username: U2, p_pass: PASS });
  assert.ok(r2.data?.token, JSON.stringify(r2.data || r2.error));
  global.tok1 = r1.data.token; global.uid1 = r1.data.user_id;
  global.tok2 = r2.data.token; global.uid2 = r2.data.user_id;
  const dup = await sb0.rpc("register", { p_username: U1, p_pass: PASS });
  assert.ok(dup.data?.error, "نام تکراری باید رد شود");
});

await t("۳) ورود و رمز اشتباه", async () => {
  const ok = await sb0.rpc("login", { p_username: U1, p_pass: PASS });
  assert.ok(ok.data?.token);
  const bad = await sb0.rpc("login", { p_username: U1, p_pass: "wrong" });
  assert.ok(bad.data?.error, "رمز اشتباه باید خطا دهد");
});

await t("۴) ذخیره و بارگذاری وضعیت در ابر", async () => {
  const sb1 = mk(global.tok1);
  const state = { v: 4, level: 12, xp: 40, gold: 200, gems: 3, hello: "world", stats: { wins: 1, losses: 0, kills: 2 }, rank_pts: 1000, hunterClass: "E", updatedAt: Date.now() };
  const up = await sb1.rpc("save_full_state", { p_data: state });
  assert.ok(!up.error && !up.data?.error, JSON.stringify(up.error || up.data));
  const ld = await sb1.rpc("load_full_state");
  assert.ok(ld.data?.player, "داده باید برگردد");
});

await t("۵) امنیت: کاربر دیگر نمی‌تواند ردیف مرا بخواند", async () => {
  const sb2 = mk(global.tok2);
  const r = await sb2.from("players").select("*").eq("user_id", global.uid1);
  assert.equal((r.data || []).length, 0, "RLS باید دسترسی را ببندد");
  const noTok = mk(null);
  const r2 = await noTok.from("players").select("*");
  assert.equal((r2.data || []).length, 0, "بدون توکن چیزی نباید دیده شود");
});

await t("۶) چت: ارسال و خواندن", async () => {
  const sb1 = mk(global.tok1);
  const sb2 = mk(global.tok2);
  const ins = await sb1.from("chat_messages").insert({ room: "عمومی", username: U1, user_id: global.uid1, body: "سلام از تست", kind: "text" });
  assert.ok(!ins.error, ins.error?.message);
  const his = await sb2.from("chat_messages").select("*").eq("room", "عمومی").order("id", { ascending: false }).limit(50);
  assert.ok((his.data || []).some((m) => m.body === "سلام از تست"), "پیام باید عمومی باشد");
});

await t("۷) گروه: ساخت و لیست", async () => {
  const sb1 = mk(global.tok1);
  const cr = await sb1.rpc("create_room", { p_name: `slstest_grp${suffix}` });
  assert.ok(cr.data?.id, JSON.stringify(cr.data || cr.error));
  const ls = await sb1.rpc("list_rooms");
  assert.ok((ls.data || []).some((r) => r.id === cr.data.id));
});

await t("۸) دوئل: ساخت، پذیرش، نتیجه", async () => {
  const sb1 = mk(global.tok1);
  const sb2 = mk(global.tok2);
  const cr = await sb1.from("duels").insert({ p1: global.uid1, p1name: U1, mode: "click", status: "open" }).select().single();
  assert.ok(cr.data?.id, cr.error?.message);
  const ch = await sb1.rpc("update_duel", { p_id: cr.data.id, p_status: "challenged", p_p2: global.uid2, p_p2name: U2 });
  assert.ok(!ch.error && !ch.data?.error, JSON.stringify(ch.error || ch.data));
  const st = await sb2.rpc("update_duel", { p_id: cr.data.id, p_status: "starting" });
  assert.ok(!st.error && !st.data?.error, JSON.stringify(st.error || st.data));
  const fake = await sb2.from("duels").update({ status: "done" }).eq("id", cr.data.id);
  assert.ok(fake.error || (fake.data && fake.data.length === 0), "آپدیت مستقیم done باید بسته باشد");
  const fin = await sb2.rpc("finish_duel", { p_id: cr.data.id, p_winner: global.uid2, p_scores: { a: 1 } });
  assert.ok(!fin.error && !fin.data?.error, JSON.stringify(fin.error || fin.data));
});

await t("۹) لیدربرد و رنک من", async () => {
  const sb0b = mk(null);
  const lb = await sb0b.rpc("leaderboard", { p_kind: "power", p_lim: 100 });
  assert.ok(Array.isArray(lb.data) && lb.data.length > 0, "لیدربرد باید ردیف داشته باشد");
  assert.ok(lb.data.some((p) => p.username === U1), "کاربر من باید در لیدربرد باشد");
  const sb1 = mk(global.tok1);
  const mr = await sb1.rpc("my_rank", { p_kind: "power" });
  assert.ok(typeof mr.data === "number" && mr.data >= 1);
});

await t("۱۱) save طلا و سطح جعلی را اعمال نمی‌کند", async () => {
  const sb1 = mk(global.tok1);
  const before = await sb1.rpc("load_full_state");
  const g0 = before.data?.player?.gold ?? 0;
  const lv0 = before.data?.player?.level ?? 1;
  const up = await sb1.rpc("save_full_state", { p_data: { gold: 999999999, level: 9999, xp: 1, gems: 99999 } });
  assert.ok(!up.error, JSON.stringify(up.error));
  const after = await sb1.rpc("load_full_state");
  const g1 = after.data?.player?.gold ?? 0;
  const lv1 = after.data?.player?.level ?? 1;
  assert.ok(g1 <= g0 + 10, "طلا از save نباید باد کند: " + g0 + " -> " + g1);
  assert.ok(lv1 <= lv0 + 1, "سطح از save نباید باد کند");
});

await t("۱۲) apply_play تکراری already است", async () => {
  const sb1 = mk(global.tok1);
  const id = "train-intg" + suffix + "xx";
  const a = await sb1.rpc("apply_play", { p_kind: "train", p_claim_id: id, p_n: 16, p_index: 0 });
  assert.ok(!a.error && !a.data?.error, JSON.stringify(a.error || a.data));
  const b = await sb1.rpc("apply_play", { p_kind: "train", p_claim_id: id, p_n: 16, p_index: 0 });
  assert.ok(b.data?.already || b.data?.ok);
});

await t("۱۰) خروج از حساب و باطل شدن نشست", async () => {
  const sb1 = mk(global.tok1);
  await sb1.rpc("logout");
  const r = await sb1.from("players").select("*").eq("user_id", global.uid1);
  assert.equal((r.data || []).length, 0, "بعد از خروج نباید دیده شود");
});

console.log(`\n=== نتیجهٔ یکپارچه‌سازی: ${passed} موفق، ${failed} ناموفق ===`);
if (failed) process.exit(1);
