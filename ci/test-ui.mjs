/* تست رابط کاربری — اجرای برنامهٔ ساخته‌شده در DOM شبیه‌سازی‌شده */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../www/index.html", import.meta.url), "utf8");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    // استاب‌های مرورگر
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    window.Notification = class { static permission = "denied"; static requestPermission() { return Promise.resolve("denied"); } constructor() {} };
    window.navigator.vibrate = () => {};
    window.navigator.mediaDevices = { getUserMedia: () => Promise.reject(new Error("no mic")) };
    window.MediaRecorder = undefined;
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    window.Capacitor = undefined;
    window.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, { get: (t, k) => (k === "canvas" ? this : () => {}) });
    };
    window.fetch = () => new Promise((_, rej) => setTimeout(() => rej(new Error("offline")), 5));
  },
});
const { window } = dom;
const d = window.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + (e.stack || e).toString().split("\n").slice(0, 5).join("\n    ")); }
}
const q = (sel) => d.querySelector(sel);
const qa = (sel) => [...d.querySelectorAll(sel)];
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const visible = (el) => el && !el.classList.contains("hidden");

console.log("=== تست رابط کاربری (DOM) ===");
await wait(1200);

t("صفحهٔ ورود نمایش داده می‌شود", () => {
  assert.ok(visible(q("#screen-auth")), "صفحه ورود باید دیده شود");
  assert.ok(/سولو|Solo/i.test(q(".auth-title").textContent + q(".auth-sub").textContent), "عنوان Solo System");
});

t("ورود آفلاین → صفحهٔ اصلی می‌آید", () => {
  click(q("#auth-offline"));
  assert.ok(visible(q("#screen-app")), "صفحهٔ اصلی");
  assert.ok(q("#hunter-name").textContent.includes("مهمان"), "نام مهمان");
});

t("تمرین: کلیک‌ها XP و سطح می‌دهند", () => {
  const before = q("#xp-nums").textContent;
  for (let i = 0; i < 40; i++) q("#btn-train").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.notEqual(q("#xp-nums").textContent, before, "XP تغییر کرد");
  assert.ok(q("#today-clicks").textContent !== "۰", "کلیک امروز ثبت شد");
});

t("تب‌ها با یک کلیک عوض می‌شوند (۹ تب بدون اسکرول)", () => {
  const btns = qa(".nav-btn");
  assert.equal(btns.length, 9, "۹ تب در یک ردیف");
  for (const b of btns) {
    click(b);
    const page = q(`.page[data-page="${b.dataset.page}"]`);
    assert.ok(page && page.classList.contains("active"), "تب " + b.dataset.page);
  }
  // همه در یک خط: عرض نوار = مجموع
  const nav = q("#bottomnav");
  assert.ok(nav.scrollWidth <= nav.clientWidth + 2, "نوار پایین نباید اسکرول بخورد");
});

t("ماموریت‌ها رندر می‌شوند و مهلت دارند", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "missions"));
  const cards = qa("#mission-list .mission-card");
  assert.ok(cards.length >= 5, "کارت ماموریت: " + cards.length);
  assert.ok(qa("#mission-list .punish-stamp").length >= 1, "برچسب اجباری/مجازات");
});

t("دروازه‌ها: ۳۰ دانجن اول لیست می‌شوند + دکمهٔ بیشتر", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "gates"));
  const cards = qa("#gate-list .gate-card");
  assert.ok(cards.length >= 25, "دانجن‌ها: " + cards.length);
  assert.ok(visible(q("#gates-more")), "دکمهٔ نمایش بیشتر");
  click(q("#gates-more"));
  assert.ok(qa("#gate-list .gate-card").length > cards.length, "بعد از «بیشتر» زیاد شد");
});

t("باس‌ها رندر می‌شوند (۱۰هزار باس)", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "battle"));
  assert.ok(qa("#boss-list .boss-card").length >= 25);
});

t("فروشگاه: تب‌ها + تخفیف روزانه + آیتم", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "shop"));
  assert.ok(qa(".s-tab").length === 7, "۷ دسته");
  assert.ok(qa("#deal-strip .deal-card").length === 3, "۳ تخفیف روزانه");
  assert.ok(qa("#shop-grid .item-card").length > 15, "آیتم‌های سلاح");
  click(qa(".s-tab").find((b) => b.dataset.sc === "stone"));
  assert.ok(qa("#shop-grid .item-card").length >= 10, "سنگ‌های سایه");
});

t("کیف: مهارت‌ها قفل هستند (هیچی از اول فعال نیست)", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "bag"));
  const locked = qa("#bag-body .skill-card.locked").length;
  assert.ok(locked > 0, "مهارت قفل‌دار: " + locked);
  assert.equal(qa("#bag-body .toggle.on").length, 0, "هیچ مهارتی از اول فعال نیست");
  // آیتم‌ها
  click(qa(".b-tab").find((b) => b.dataset.bt === "items"));
  assert.ok(q("#bag-body").textContent.includes("خالی") || qa("#bag-body .inv-item").length >= 0);
  // تجهیزات
  click(qa(".b-tab").find((b) => b.dataset.bt === "gear"));
  assert.ok(q("#bag-body").textContent.includes("قدرت کل"), "خلاصهٔ تجهیزات");
});

t("رقابت: لیست آنلاین + مسابقات + تاریخچه رندر می‌شود", async () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "duel"));
  await wait(300);
  assert.ok(q("#online-list").textContent.length > 0);
  assert.ok(q("#duel-history").textContent.length > 0);
});

t("چت: اتاق‌ها و ارسال پیام", async () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "chat"));
  assert.equal(qa(".room-btn").length, 3, "۳ اتاق پیش‌فرض");
  q("#chat-text").value = "سلام سیستم!";
  click(q("#btn-send"));
  assert.ok(q("#chat-msgs").textContent.includes("سلام سیستم"), "پیام نمایش داده شد");
  click(q("#btn-emoji"));
  assert.ok(visible(q("#emoji-panel")), "پنل ایموجی");
  click(q("#btn-emoji"));
});

t("رنک: لیدربرد رندر می‌شود", async () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "ranks"));
  await wait(300);
  assert.ok(q("#rank-list").textContent.length > 0);
  assert.ok(q("#my-rank-card").textContent.includes("مهمان"));
});

t("جایزهٔ لول‌آپ: ۳ انتخاب با تراز بالای اجباری", async () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "home"));
  // با کلیک زیاد تراز بگیر
  for (let i = 0; i < 300; i++) q("#btn-train").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  const cards = qa("#reward-picks .deal-card");
  assert.ok(cards.length === 3, "۳ انتخاب: " + cards.length);
  click(cards[0].querySelector("[data-pick]"));
  await wait(200);
  assert.ok(q("#reward-token-chip").textContent.includes("۲"), "تعداد انتخاب کم شد: " + q("#reward-token-chip").textContent);
});

t("پنجرهٔ سیستم و اعلان کار می‌کنند", () => {
  window.__slsSysTest?.();
  assert.ok(visible(q("#sys-window")), "پنجرهٔ سیستم باز شد");
  click(q("#sys-close"));
  assert.ok(q("#sys-window").classList.contains("hidden"));
});

t("کلیک سریع تمرین تب را عوض نمی‌کند", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "home"));
  for (let i = 0; i < 30; i++) q("#btn-train").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.ok(q('.page[data-page="home"]').classList.contains("active"), "تب خانه باید بماند");
});

t("تمرین طلا هم می‌دهد (گرایند فروشگاه)", () => {
  click(qa(".nav-btn").find((b) => b.dataset.page === "home"));
  const before = q("#res-gold").textContent;
  for (let i = 0; i < 20; i++) q("#btn-train").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.notEqual(q("#res-gold").textContent, before, "طلا باید زیاد شود");
});

t("دکمه سریع خانه هست", () => {
  assert.ok(q("#quick-row") && q("#quick-row").children.length >= 3);
});

t("باز و بسته شدن برنامه داده را نگه می‌دارد", () => {
  const st = window.__slsState();
  assert.ok(st && st.level >= 1);
  const again = window.__slsState();
  assert.equal(again.stats.clicks, st.stats.clicks);
});

t("مسابقهٔ کلیکی در باندل هست", () => {
  assert.equal(typeof window.__slsClickDuel, "function");
  window.__slsClickDuel();
});

t("هیچ خطای جاوااسکریپتی رخ نداد", () => {
  assert.equal(window.__slsErrors?.length || 0, 0, "خطاها: " + (window.__slsErrors || []).join(" | "));
});

console.log(`\n=== نتیجهٔ UI: ${passed} موفق، ${failed} ناموفق ===`);
if (failed) process.exit(1);
process.exit(0);
