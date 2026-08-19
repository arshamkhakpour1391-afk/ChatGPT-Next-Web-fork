/* ================= ابزارهای پایه ================= */
"use strict";

// ---------- RNG قطعی (برای محتوای یکسان برای همه) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seedOf(...parts) { return hashStr(parts.join("::")); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

// ---------- فرمت اعداد فارسی ----------
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export function faNum(n) {
  if (n == null || isNaN(n)) return "۰";
  const s = String(Math.round(n));
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}
export function fmt(n) {
  if (n >= 1e12) return faNum(n / 1e12) + " تریلیون";
  if (n >= 1e9) return faNum(n / 1e9) + " میلیارد";
  if (n >= 1e6) return faNum(n / 1e6) + " میلیون";
  if (n >= 1e3) return faNum(n / 1e3) + " هزار";
  return faNum(n);
}
export function fmtNum(n) {
  const neg = n < 0 ? "-" : "";
  const s = String(Math.abs(Math.round(n)));
  const parts = [];
  for (let i = s.length; i > 0; i -= 3) parts.unshift(s.slice(Math.max(0, i - 3), i));
  return neg + parts.join(",").replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}
export function faTime(ts) {
  const d = new Date(ts);
  return faNum(d.getHours()).padStart(2, "۰") + ":" + faNum(d.getMinutes()).padStart(2, "۰");
}
export function faDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("fa-IR", { day: "numeric", month: "long" });
  } catch (e) { return ""; }
}
export function dur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x) => faNum(x).padStart(2, "۰");
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "همین الان";
  if (s < 3600) return faNum(Math.floor(s / 60)) + " دقیقه پیش";
  if (s < 86400) return faNum(Math.floor(s / 3600)) + " ساعت پیش";
  return faNum(Math.floor(s / 86400)) + " روز پیش";
}

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- ذخیره محلی مقاوم ----------
const LS_PREFIX = "sls_v2_";
const memoryStore = new Map();
let lsOK = true;
try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); } catch (e) { lsOK = false; }

export function lsGet(key) {
  try {
    if (!lsOK) return memoryStore.get(key) ?? null;
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) { return null; }
}
export function lsSet(key, val) {
  try {
    const raw = JSON.stringify(val);
    if (lsOK) localStorage.setItem(LS_PREFIX + key, raw);
    else memoryStore.set(key, val);
  } catch (e) { try { memoryStore.set(key, val); } catch (e2) {} }
}
export function lsDel(key) {
  try { if (lsOK) localStorage.removeItem(LS_PREFIX + key); memoryStore.delete(key); } catch (e) {}
}

// ---------- debounce ----------
export function debounce(fn, ms) {
  let t = null;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
  wrapped.cancel = () => { clearTimeout(t); t = null; };
  wrapped.flush = () => {
    if (t) { clearTimeout(t); t = null; if (lastArgs) fn(...lastArgs); }
  };
  return wrapped;
}

// ---------- صداهای سینتزی ----------
let actx = null;
function ctx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}
let muted = false;
export function setMuted(v) { muted = !!v; try { lsSet("muted", muted); } catch (e) {} }
export function isMuted() { return muted; }
export function initMute() { try { muted = !!lsGet("muted"); } catch (e) { muted = false; } }

function tone(freq, dur, type = "sine", vol = 0.12, slide = 0, delay = 0) {
  if (muted) return;
  const c = ctx(); if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  } catch (e) {}
}
export const sfx = {
  click() { tone(220 + Math.random() * 60, 0.06, "triangle", 0.07); },
  crit() { tone(660, 0.12, "sawtooth", 0.09, -200); tone(990, 0.1, "square", 0.05); },
  hit() { tone(180, 0.1, "square", 0.09, -80); },
  hurt() { tone(120, 0.16, "sawtooth", 0.11, -60); },
  coin() { tone(880, 0.08, "sine", 0.09); tone(1320, 0.12, "sine", 0.08, 0, 0.05); },
  buy() { tone(523, 0.08, "sine", 0.1); tone(659, 0.08, "sine", 0.1, 0, 0.07); tone(784, 0.14, "sine", 0.1, 0, 0.14); },
  levelup() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, "triangle", 0.11, 0, i * 0.08)); },
  alarm() { for (let i = 0; i < 3; i++) { tone(740, 0.22, "square", 0.1, 0, i * 0.3); tone(520, 0.22, "square", 0.1, 0, i * 0.3 + 0.15); } },
  punish() { tone(160, 0.5, "sawtooth", 0.16, -110); tone(90, 0.6, "square", 0.12, -50, 0.25); },
  skill() { tone(440, 0.12, "triangle", 0.1, 220); },
  arise() { tone(220, 0.4, "sawtooth", 0.1, 320); tone(440, 0.5, "triangle", 0.09, 240, 0.18); },
  shoot() { tone(340, 0.05, "square", 0.06, -140); },
  boom() { tone(90, 0.25, "sawtooth", 0.14, -60); },
  win() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, "triangle", 0.1, 0, i * 0.1)); },
  lose() { [330, 262, 196].forEach((f, i) => tone(f, 0.24, "sawtooth", 0.1, 0, i * 0.16)); },
  msg() { tone(660, 0.07, "sine", 0.07); },
  notif() { tone(880, 0.1, "sine", 0.08); tone(1174, 0.16, "sine", 0.08, 0, 0.1); },
  gate() { tone(196, 0.3, "triangle", 0.11, 160); tone(98, 0.4, "sine", 0.1, -30, 0.1); }
};

// ---------- اعلان‌ها ----------
export function notifyLocal(title, body) {
  try {
    if (window.Notification && Notification.permission === "granted") {
      new Notification(title, { body, tag: "sls", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 6 L38 26 L56 30 L38 34 L32 58 L26 34 L8 30 L26 26 Z' fill='%237c5cff'/%3E%3C/svg%3E" });
      return;
    }
  } catch (e) {}
  // در اندروید: اعلان سیستمی
  try {
    const LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN && window.Capacitor?.isNativePlatform?.()) {
      LN.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title, body,
          schedule: { at: new Date(Date.now() + 1500) }
        }]
      });
    }
  } catch (e) {}
}
export function scheduleLocalNotify(id, title, body, atMs) {
  try {
    const LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN && window.Capacitor?.isNativePlatform?.()) {
      LN.schedule({ notifications: [{ id: id % 2147483647, title, body, schedule: { at: new Date(atMs) } }] });
    }
  } catch (e) {}
}
export async function requestNotifPermission() {
  try {
    const LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN && window.Capacitor?.isNativePlatform?.()) { await LN.requestPermissions(); return; }
  } catch (e) {}
  try { if (window.Notification && Notification.permission === "default") await Notification.requestPermission(); } catch (e) {}
}

// ---------- متفرقه ----------
export function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function deepClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }
export function jsonEq(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
export function nowMs() { return Date.now(); }
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function keyToMs(k) {
  const p = String(k).split("-").map(Number);
  if (p.length !== 3 || p.some(isNaN)) return NaN;
  return new Date(p[0], p[1] - 1, p[2]).getTime();
}
export function weekKey() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // شنبه = 0
  const start = new Date(d); start.setDate(d.getDate() - day);
  return start.toISOString().slice(0, 10);
}
export function el(id) { return document.getElementById(id); }
export function make(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
