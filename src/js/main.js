/* ================= نقطهٔ شروع برنامه ================= */
import { el, lsGet, lsSet, lsDel, debounce, nowMs, todayKey, deepClone, notifyLocal, sfx, requestNotifPermission, faNum, initMute } from "./util.js";
import { newState, computePower, tickState, maxEnergy, STATE_VERSION, missionBucket, applyProgress, dailyQuests, regenEnergy, migrateState } from "./engine.js";
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
function stateKey(id) {
  if (id) return "state:" + id;
  return "state:" + (account ? account.userId : offlineMode ? "guest" : "anon");
}
function loadLocalState(id) {
  const raw = lsGet(stateKey(id));
  if (raw) return migrateState(raw);
  return null;
}
function pickRicher(a, b) {
  if (!a) return b;
  if (!b) return a;
  const score = (s) => (s.level || 1) * 10000 + (s.stats?.clicks || 0) + (s.gold || 0);
  return score(a) >= score(b) ? a : b;
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
async function onAuthed(r, passFromForm) {
  const uid = r.user_id || r.userId;
  const uname = r.username;
  const token = r.token;
  if (!uid || !token || !uname) {
    ui.toast("ورود ناقص بود — دوباره امتحان کن", "bad");
    return;
  }
  const pw = passFromForm || authPass || "";
  account = { username: uname, pass: pw, token, userId: uid };
  cloud.setSession(token);
  window.__sls_userId = uid;
  lsSet("account", { username: uname, pass: pw, token, userId: uid });
  lsSet("lastUser", uid);
  authPass = null;

  const named = loadLocalState(uid);
  const guest = pickRicher(loadLocalState("guest"), loadLocalState("anon"));
  let local = pickRicher(named, guest);
  const cloudPlayer = r.player;
  if (cloudPlayer && cloudPlayer.data && Object.keys(cloudPlayer.data).length) {
    const cloudUpdated = new Date(cloudPlayer.updated_at || 0).getTime();
    const localUpdated = local ? (local.updatedAt || 0) : 0;
    if (cloudUpdated >= localUpdated || !local) {
      st = migrateState(cloudPlayer.data);
      ui.toast("داده‌های ابری بارگذاری شد ✓", "good");
    } else {
      st = migrateState(local);
      ui.toast("دادهٔ دستگاه جدیدتر بود — با ابر همگام شد ✓", "info");
    }
  } else if (local) {
    st = migrateState(local);
  } else {
    st = newState(uname, uid);
  }
  st.username = uname;
  st.v = STATE_VERSION;
  offlineMode = false;
  saveNow();
  ui.initUI(appObj);
  ui.showApp();
  startOnlineServices();
  tickAndRender();
  ui.toast(`خوش آمدی، ${uname}! سیستم منتظر توست.`, "good", 3200);
  sfx.win();
}

function bootLocal(acc, msg) {
  account = acc || null;
  if (acc) {
    cloud.setSession(acc.token);
    window.__sls_userId = acc.userId;
    st = loadLocalState(acc.userId) || loadLocalState("guest") || loadLocalState("anon") || newState(acc.username, acc.userId);
    st.username = acc.username || st.username;
    offlineMode = false;
  } else {
    st = loadLocalState() || newState("", "anon");
  }
  ui.initUI(appObj);
  ui.showApp();
  tickAndRender();
  if (msg) ui.toast(msg, "info", 4200);
}

async function autoLogin() {
  try {
    cloud.initCloud?.();
    const acc = lsGet("account");
    if (!acc || !acc.userId) {
      st = loadLocalState() || newState("", "anon");
      showAuth();
      ui.toast("برای ذخیرهٔ ابری، ثبت‌نام کن یا وارد شو", "info", 4000);
      return;
    }
    cloud.setSession(acc.token);
    window.__sls_userId = acc.userId;
    const r = await cloud.loadPlayer(acc.userId);
    if (r.player) {
      account = acc;
      const cloudData = r.player.data && Object.keys(r.player.data).length ? r.player.data : null;
      st = migrateState(cloudData || loadLocalState(acc.userId) || newState(acc.username, acc.userId));
      st.username = acc.username;
      saveNow();
      ui.initUI(appObj);
      ui.showApp();
      startOnlineServices();
      tickAndRender();
      ui.toast(`خوش برگشتی، ${acc.username}!`, "good", 2800);
      return;
    }
    const timedOut = r.error && (r.error.message === "TIMEOUT" || r.error.message === "offline");
    if (timedOut || (r.error && !acc.pass)) {
      bootLocal(acc, "اتصال ابری برقرار نشد — با دادهٔ ذخیره‌شده ادامه می‌دهی");
      return;
    }
    if (acc.pass) {
      const r2 = await cloud.login(acc.username, acc.pass);
      if (!r2.error && r2.token) {
        await onAuthed(r2, acc.pass);
        return;
      }
    }
    bootLocal(acc, "نشست ابری تازه نشد — محلی بازی می‌کنی، بعداً دوباره وارد شو");
  } catch (e) {
    const acc = lsGet("account");
    if (acc && acc.userId) bootLocal(acc, "خطا در ورود خودکار — دادهٔ محلی سالم است");
    else {
      st = loadLocalState() || newState("", "anon");
      showAuth();
    }
  }
}

let authPass = null;
function logout() {
  saveNow();
  cloud.logoutCloud();
  cloud.leavePresence();
  cloud.stopHeartbeat();
  account = null;
  offlineMode = false;
  onlineStarted = false;
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
let onlineStarted = false;
function startOnlineServices() {
  if (!account || onlineStarted) return;
  onlineStarted = true;
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
