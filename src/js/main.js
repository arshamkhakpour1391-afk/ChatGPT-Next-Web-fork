/* ================= نقطهٔ شروع برنامه ================= */
import { el, lsGet, lsSet, lsDel, debounce, nowMs, todayKey, deepClone, notifyLocal, sfx, requestNotifPermission, faNum, initMute } from "./util.js";
import { newState, computePower, tickState, maxEnergy, STATE_VERSION, missionBucket, applyProgress, dailyQuests, regenEnergy } from "./engine.js";
import { hunterClass } from "./data.js";
import { MISSION_INTERVAL_MS, missionOf } from "./data.js";
import * as cloud from "./cloud.js";
import * as ui from "./ui.js";
import { showAuth, showApp } from "./ui.js";

/* ---------- وضعیت ---------- */
let st = null;
let account = null; // {username, pass, token, userId}
let offlineMode = false;

/* ---------- ذخیره ---------- */
function stateKey() { return "state:" + (account ? account.userId : offlineMode ? "guest" : "anon"); }
function loadLocalState() {
  const raw = lsGet(stateKey());
  if (raw && raw.v === STATE_VERSION) return raw;
  if (raw) { // مهاجرت نسخه‌های قدیمی — هیچ‌وقت داده حذف نمی‌شود
    raw.v = STATE_VERSION;
    raw.gold = raw.gold || 0;
    if (raw.rank_pts == null) raw.rank_pts = 1000;
    if (!raw.login) raw.login = { date: "", streak: 0 };
    if (!raw.buffs) raw.buffs = [];
    return raw;
  }
  return null;
}
const pushCloud = debounce(async () => {
  if (offlineMode || !account) return;
  const cols = {
    userId: account.userId,
    username: st.username,
    level: st.level, xp: st.xp, gold: st.gold, gems: st.gems,
    power: computePower(st), wins: st.stats.wins, losses: st.stats.losses,
    kills: st.stats.kills, rankPts: st.rank_pts ?? 1000,
    hunterClass: hunterClass(st.level).name,
  };
  const r = await cloud.savePlayer(st, cols);
  if (!r.ok && r.error) console.warn("cloud save:", r.error?.message || r.error);
}, 700);

function save() {
  lsSet(stateKey(), st);
  pushCloud();
}
function saveNow() {
  lsSet(stateKey(), st);
  pushCloud.flush?.();
}

/* ---------- حساب ---------- */
async function onAuthed(r) {
  account = { username: r.username, pass: authPass, token: r.token, userId: r.user_id };
  cloud.setSession(r.token);
  window.__sls_userId = r.user_id;
  lsSet("account", { ...account, pass: authPass });
  lsSet("lastUser", account.userId);
  authPass = null;

  // ادغام با ابر
  const local = loadLocalState();
  const cloudPlayer = r.player;
  if (cloudPlayer && cloudPlayer.data && Object.keys(cloudPlayer.data).length) {
    const cloudUpdated = new Date(cloudPlayer.updated_at || 0).getTime();
    const localUpdated = local ? (local.updatedAt || 0) : 0;
    if (cloudUpdated >= localUpdated || !local) {
      st = cloudPlayer.data;
      st.username = r.username;
      st.v = STATE_VERSION;
      saveNow();
      ui.toast("داده‌های ابری بارگذاری شد ✓", "good");
    } else {
      st = local;
      saveNow();
      ui.toast("دادهٔ دستگاه جدیدتر بود — با ابر همگام شد ✓", "info");
    }
  } else if (local) {
    st = local;
    st.username = r.username;
    saveNow();
  } else {
    st = newState(r.username, r.user_id);
    saveNow();
  }
  offlineMode = false;
  ui.initUI(appObj);
  ui.showApp();
  startOnlineServices();
  tickAndRender();
  ui.toast(`خوش آمدی، ${r.username}! سیستم منتظر توست.`, "good", 3200);
  sfx.win();
}

async function autoLogin() {
  const acc = lsGet("account");
  const lastUser = lsGet("lastUser");
  if (!acc) {
    st = loadLocalState() || newState("", "anon");
    showAuth();
    ui.toast("برای ذخیرهٔ ابری، ثبت‌نام کن یا وارد شو", "info", 4000);
    return;
  }
  cloud.setSession(acc.token);
  window.__sls_userId = acc.userId;
  try {
    const r = await cloud.loadPlayer(acc.userId);
    if (r.player) {
      account = acc;
      st = r.player.data && Object.keys(r.player.data).length ? r.player.data : (loadLocalState() || newState(acc.username, acc.userId));
      st.username = acc.username;
      st.v = STATE_VERSION;
      saveNow();
      ui.initUI(appObj);
      ui.showApp();
      startOnlineServices();
      tickAndRender();
      ui.toast(`خوش برگشتی، ${acc.username}! همه‌چیز از ابر بارگذاری شد ✓`, "good", 3200);
      return;
    }
    if (r.error && r.error.message === "TIMEOUT") throw new Error("offline");
  } catch (e) {
    // ادامهٔ آفلاین با دادهٔ محلی — بعداً همگام می‌شود
    account = acc;
    cloud.setSession(acc.token);
    window.__sls_userId = acc.userId;
    st = loadLocalState() || newState(acc.username, acc.userId);
    ui.initUI(appObj);
    ui.showApp();
    tickAndRender();
    ui.toast("اتصال ابری برقرار نشد — با دادهٔ ذخیره‌شده ادامه می‌دهی، بعداً همگام می‌شود", "bad", 5000);
    return;
  }
  // نشست منقضی: ورود خودکار با رمز ذخیره‌شده
  const r2 = await cloud.login(acc.username, acc.pass);
  if (!r2.error) {
    authPass = acc.pass;
    await onAuthed(r2);
    return;
  }
  showAuth("نشست تمام شده — دوباره وارد شو");
}

let authPass = null;
function logout() {
  saveNow();
  cloud.logoutCloud();
  cloud.leavePresence();
  cloud.stopHeartbeat();
  account = null;
  offlineMode = false;
  lsDel("account");
  cloud.setSession(null);
  showAuth();
  ui.toast("از حساب خارج شدی — داده‌ها روی ابر و دستگاه محفوظ است", "info");
}

function onOfflineMode() {
  offlineMode = true;
  account = null;
  st = loadLocalState() || newState("مهمان", "guest");
  ui.initUI(appObj);
  ui.showApp();
  tickAndRender();
  ui.toast("حالت آفلاین: بازی می‌کنی ولی ابر/لیدربرد/چت غیرفعال است. برای ذخیرهٔ همیشگی ثبت‌نام کن.", "bad", 5000);
}

/* ---------- سرویس‌های آنلاین ---------- */
function startOnlineServices() {
  cloud.joinPresence({
    userId: account.userId, username: st.username, level: st.level,
    power: computePower(st), hunterClass: hunterClass(st.level).name
  });
  cloud.startHeartbeat(account.userId);
  cloud.subscribeDuels(handleDuelFeed);
  cloud.onMatchBroadcast(handleMatchEvent);
  cloud.listenDM(account.userId, (msg) => {
    st.dms = st.dms || {};
    const who = Object.keys(st.dms).find(() => true) || msg.from;
    st.dms[msg.from] = st.dms[msg.from] || [];
    st.dms[msg.from].push({ from: msg.from, text: msg.text, ts: nowMs() });
    save();
    notifyLocal("پیام خصوصی", (msg.text || "").slice(0, 80));
    ui.toast("💬 پیام خصوصی جدید!", "info");
    sfx.msg();
  });
  cloud.on("status", (s) => {
    if (!s.online) ui.toast("اتصال ابر قطع شد — داده‌ها محلی ذخیره می‌شوند و بعداً همگام می‌شوند", "bad", 4000);
  });
}

function handleDuelFeed(payload) {
  const d = payload.new || {};
  const myId = account?.userId;
  if (!myId) return;
  if (payload.eventType === "INSERT" && d.p2 === myId && (d.status === "open" || d.status === "challenged")) {
    ui.toast(`⚔️ ${d.p1name} تو را به مبارزه می‌طلبد! برو تب رقابت`, "gold", 5000);
    notifyLocal("چالش رقابت!", `${d.p1name} تو را به مبارزه می‌طلبد`);
    ui.addEvent("چالش جدید", `${d.p1name} تو را به مبارزه طلبیده`, "info");
    sfx.alarm();
    if (ui.currentPageName() === "duel") ui.renderDuelTab();
  }
  if (payload.eventType === "UPDATE" && d.status === "starting" && (d.p1 === myId || d.p2 === myId)) {
    ui.beginDuelFromCloud(d);
  }
  if (payload.eventType === "UPDATE" && d.status === "done" && (d.p1 === myId || d.p2 === myId)) {
    if (ui.currentPageName() === "duel") ui.renderDuelTab();
  }
}

function handleMatchEvent(m) {
  const myId = account?.userId;
  if (!myId || !m) return;
  if (m.type === "challenge" && m.p2 === myId) {
    ui.toast(`⚔️ ${m.p1name} تو را به مبارزه می‌طلبد!`, "gold", 5000);
    sfx.alarm();
    if (ui.currentPageName() === "duel") ui.renderDuelTab();
  }
  if (m.type === "accepted" && m.p1 === myId) {
    ui.toast(`${m.p2name || "حریف"} چالش را قبول کرد — مبارزه شروع می‌شود!`, "good", 4000);
    sfx.win();
    ui.beginDuelFromCloud({ id: m.duelId, p1: m.p1, p2: m.p2, p1name: st.username, p2name: "حریف", mode: m.mode, status: "starting" });
  }
}

/* ---------- تیک و اعلان‌ها ---------- */
let lastBucket = missionBucket(nowMs());
let lastDay = todayKey();
let lastNotifCheck = 0;
function tickAndRender() {
  const changed = tickState(st);
  if (st.pendingPunish) {
    const ev = st.pendingPunish;
    st.pendingPunish = null;
    ui.showPunishmentModal(ev, "مسیر سالانهٔ ناقص");
  }
  if (changed) save();
}
setInterval(() => {
  if (!st || !ui.ready()) return;
  // انرژی
  if (regenEnergy(st) > 0) {
    save();
    if (document.querySelector(".page.active")?.dataset.page === "home") ui.renderTopbar();
  }
  // تیک روزانه
  const now = nowMs();
  if (now - lastNotifCheck > 20000) {
    lastNotifCheck = now;
    const b = missionBucket(now);
    if (b !== lastBucket) {
      lastBucket = b;
      const m = missionOf(st.seed, 0, b); // ماموریت اجباری جدید
      ui.addEvent("ماموریت اجباری جدید!", m.title + " — اگر انجام نشود مجازات می‌شوی", "bad");
      notifyLocal("⚠️ ماموریت اجباری جدید", m.title);
      sfx.alarm();
      if (ui.currentPageName() === "missions") ui.renderMissions();
    }
    if (lastDay !== todayKey()) {
      lastDay = todayKey();
      dailyQuests(st);
      save();
      notifyLocal("ماموریت‌های روزانه", "کارهای امروز اعلام شد — تا آخر شب وقت داری!");
      ui.addEvent("روز جدید", "ماموریت‌های روزانهٔ جدید اعلام شد", "info");
    }
  }
}, 60000);

/* ---------- ذرات پس‌زمینه (زنده و سبک) ---------- */
function startBgFX() {
  const cv = el("bg-fx");
  const g = cv.getContext("2d");
  let W, H;
  const parts = [];
  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    parts.length = 0;
    const n = Math.min(46, Math.floor(W * H / 26000));
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.6 + Math.random() * 1.8,
        vy: 0.12 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.15,
        a: 0.12 + Math.random() * 0.4,
        hue: Math.random() < 0.7 ? 255 : 155
      });
    }
  }
  resize();
  window.addEventListener("resize", resize);
  let last = 0;
  (function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    if (t - last < 50) return;
    last = t;
    g.clearRect(0, 0, W, H);
    parts.forEach((p) => {
      p.y -= p.vy; p.x += p.vx;
      if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
      if (p.x < -6) p.x = W + 6;
      if (p.x > W + 6) p.x = -6;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fillStyle = `hsla(${p.hue}, 85%, 62%, ${p.a * (0.6 + Math.sin(t / 1800 + p.x) * 0.4)})`;
      g.fill();
    });
  })(0);
}

/* ---------- app object ---------- */
const appObj = {
  getSt: () => st,
  save: () => save(),
  saveNow: () => saveNow(),
  isLoggedIn: () => !!account && !offlineMode,
  myUserId: () => account?.userId || null,
  onAuthed,
  onOfflineMode,
  logout,
};
ui.initUI(appObj);

/* ---------- آغاز ---------- */
window.__slsErrors = [];
window.addEventListener("error", (e) => { if (window.__slsErrors) window.__slsErrors.push(String(e.message).slice(0, 200)); });
window.__slsSysTest = () => ui.sysWindow(`<div class="sys-row"><span>سیستم</span><b>فعال</b></div><p>همهٔ قابلیت‌ها در دسترس است.</p>`);
window.__slsState = () => st;
window.__slsShooterDemo = () => {
  import("./battleui.js").then((B) => {
    B.openShooterDuel({
      duelId: "demo",
      me: { id: "me", name: st.username || "تو", level: st.level, power: computePower(st) },
      opp: { id: "opp", name: "رقیب", level: Math.max(1, st.level), power: computePower(st) },
      isHost: true, localTest: true,
      send: () => {},
      onEnd: () => {}
    });
  });
};
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && st && !el("screen-auth")?.classList.contains("hidden") === false) {
    tickAndRender();
    if (ui.currentPageName() === "home") ui.renderHome();
    ui.renderTopbar();
  }
});
window.addEventListener("beforeunload", () => { try { if (st) lsSet(stateKey(), st); } catch (e) {} });
window.addEventListener("online", () => { ui.toast("اینترنت برگشت — در حال همگام‌سازی...", "good"); if (account) saveNow(); });

initMute();
startBgFX();
requestNotifPermission();
autoLogin();
