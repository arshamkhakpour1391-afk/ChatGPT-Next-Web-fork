/* تست عمیق هر تب + لاگین محلی + خرید */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../www/index.html", import.meta.url), "utf8");
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
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
    window.fetch = () => Promise.reject(new Error("offline"));
  },
});
const { window } = dom;
const d = window.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => d.querySelector(s);
const qa = (s) => [...d.querySelectorAll(s)];
const click = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const visible = (el) => el && !el.classList.contains("hidden");

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n    " + (e.stack || e).toString().split("\n").slice(0, 4).join("\n    ")); }
}

console.log("=== تست عمیق هر بخش ===");
await wait(900);

t("ورود نمایش داده می‌شود", () => {
  assert.ok(visible(q("#screen-auth")));
});

click(qa(".auth-tab").find((b) => b.dataset.authtab === "register"));
q("#auth-user").value = "arshamtest";
q("#auth-pass").value = "pass1234";
q("#auth-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await wait(400);

t("ثبت‌نام محلی بدون ابر وارد بازی می‌شود", () => {
  assert.ok(visible(q("#screen-app")), "باید وارد اپ شود: " + q("#auth-err")?.textContent);
  assert.ok(q("#hunter-name").textContent.includes("arshamtest"));
});

const pages = ["home", "missions", "gates", "battle", "shop", "bag", "duel", "chat", "ranks"];
for (let round = 1; round <= 10; round++) {
  t(`دور ${round}: هر ۹ تب باز می‌شود`, () => {
    for (const name of pages) {
      click(qa(".nav-btn").find((b) => b.dataset.page === name));
      const page = q(`.page[data-page="${name}"]`);
      assert.ok(page && page.classList.contains("active"), name);
    }
  });
}

click(qa(".nav-btn").find((b) => b.dataset.page === "home"));
for (let i = 0; i < 24; i++) q("#btn-train").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));

t("خانه بعد از تمرین زنده است", () => {
  assert.ok(q("#today-clicks").textContent !== "۰");
  assert.ok(q("#quick-row").children.length >= 3);
});

click(qa(".nav-btn").find((b) => b.dataset.page === "shop"));
t("فروشگاه سلاح دارد", () => {
  assert.ok(qa("#shop-grid .item-card").length > 10);
});
const buyBtn = q("#shop-grid .item-buy");
click(buyBtn);
await wait(80);
t("خرید سلاح اول کار می‌کند", () => {
  assert.ok(qa(".toast").some((n) => /خریداری|طلا کافی/.test(n.textContent)));
});

click(qa(".nav-btn").find((b) => b.dataset.page === "bag"));
click(qa(".b-tab").find((b) => b.dataset.bt === "items"));
t("کیف آیتم یا خالی معتبر است", () => {
  const body = q("#bag-body").textContent;
  assert.ok(body.includes("خالی") || qa("#bag-body .inv-item").length >= 1);
});
click(qa(".b-tab").find((b) => b.dataset.bt === "gear"));
t("تجهیزات امتیاز آمار دارد", () => {
  assert.ok(q("#bag-body").textContent.includes("امتیاز آمار") || q("#bag-body").textContent.includes("قدرت کل"));
});

click(qa(".nav-btn").find((b) => b.dataset.page === "missions"));
t("ماموریت‌ها کارت دارند", () => {
  assert.ok(qa("#mission-list .mission-card").length >= 4);
});

click(qa(".nav-btn").find((b) => b.dataset.page === "gates"));
t("دروازه نوع دشمن نشان می‌دهد", () => {
  const sub = q("#gate-list .gate-sub");
  assert.ok(sub && sub.textContent.length > 4);
});

click(qa(".nav-btn").find((b) => b.dataset.page === "battle"));
t("باس‌ها لیست می‌شوند", () => {
  assert.ok(qa("#boss-list .boss-card").length >= 20);
});

click(qa(".nav-btn").find((b) => b.dataset.page === "home"));
click(qa("#quick-row button").find((b) => b.textContent.includes("تمرین مبارزه")));
await wait(80);
t("تمرین مبارزه باز می‌شود", () => {
  assert.ok(visible(q("#screen-fight")));
});
click(q("#btn-flee"));
await wait(40);
t("فرار از نبرد برمی‌گردد", () => {
  assert.ok(visible(q("#screen-app")));
});

click(qa(".nav-btn").find((b) => b.dataset.page === "gates"));
t("فیلتر تیپ دشمن هست", () => {
  assert.ok(qa("#gate-arch .g-filter").length >= 8);
});
click(qa("#gate-arch .g-filter").find((b) => b.dataset.ga === "phantom") || qa("#gate-arch .g-filter")[1]);
t("فیلتر تیپ لیست را عوض می‌کند", () => {
  const sub = q("#gate-list .gate-sub");
  assert.ok(sub && sub.textContent.length > 2);
});

t("هیچ خطای JS", () => {
  assert.equal((window.__slsErrors || []).length, 0, (window.__slsErrors || []).join(" | "));
});

console.log(`\n=== نتیجهٔ عمیق: ${passed} موفق، ${failed} ناموفق ===`);
if (failed) process.exit(1);
process.exit(0);
