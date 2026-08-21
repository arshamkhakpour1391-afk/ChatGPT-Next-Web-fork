/* ================= نقطهٔ شروع برنامه ================= */
import { el, lsGet, lsSet, lsDel, debounce, nowMs, todayKey, deepClone, notifyLocal, sfx, requestNotifPermission, faNum, initMute } from "./util.js";
import { newState, computePower, tickState, maxEnergy, STATE_VERSION, missionBucket, applyProgress, dailyQuests, regenEnergy, migrateState, packCloudState } from "./engine.js";
import { overlayServerEconomy } from "./economy.js";
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
let lastCloudSync = 0;
function isLocalAcc(acc) {
  const a = acc || account;
  return !a || String(a.token || "").startsWith("local-") || String(a.userId || "").startsWith("loc_");
}
async function upgradeToCloud() {
  if (offlineMode || !account || !account.pass || !account.username) return false;
  if (!isLocalAcc(account)) return true;
  try {
    let r = await cloud.login(account.username, account.pass);
    if (r.error) r = await cloud.register(account.username, account.pass);
    if (r.error && /قبلا|taken|exists|ثبت شده/i.test(String(r.error))) r = await cloud.login(account.username, account.pass);
    if (r.error || !r.token) return false;
    const oldId = account.userId;
    const uid = r.user_id || r.userId;
    account = { username: account.username, pass: account.pass, token: r.token, userId: uid };
    cloud.setSession(r.token);
    window.__sls_userId = uid;
    lsSet("account", account);
    lsSet("lastUser", uid);
    if (oldId && oldId !== uid && st) lsSet(stateKey(uid), st);
    onlineStarted = false;
    startOnlineServices();
    return true;
  } catch (e) { return false; }
}
const pushCloud = debounce(async () => {
  if (offlineMode || !account || !st) return;
  if (isLocalAcc(account)) {
    const ok = await upgradeToCloud();
    if (!ok) return;
  }
  try {
    const dc = (st.stats.clicks || 0) - (st.cloudClicks || 0);
    if (dc >= 4) {
      const n = Math.min(120, dc);
      const cid = "train-" + nowMs().toString(36) + "-" + n;
      const play = await cloud.applyPlay("train", cid, n, 0);
      if (play && play.player) overlayServerEconomy(st, play.player);
      if (play && (play.ok || play.already)) st.cloudClicks = (st.cloudClicks || 0) + n;
    }
  } catch (e) {}
  const packed = packCloudState(st);
  packed.power = computePower(st);
  packed.hunterClass = hunterClass(st.level).name;
  const cols = {
    userId: account.userId,
    username: st.username,
    level: st.level, xp: st.xp, gold: st.gold, gems: st.gems,
    power: packed.power, wins: st.stats.wins, losses: st.stats.losses,
    kills: st.stats.kills, rankPts: st.rank_pts ?? 1000,
    hunterClass: packed.hunterClass,
  };
  const r = await cloud.savePlayer(packed, cols);
  if (r.ok) {
    lastCloudSync = nowMs();
    st.cloudAt = lastCloudSync;
    if (r.player) overlayServerEconomy(st, r.player);
    ui.setCloudBanner("cloud");
  } else if (r.error) {
    ui.setCloudBanner("offline");
    ui.toast("شما آفلاینید — ذخیره روی دستگاه ماند تا اینترنت برگردد", "bad", 3600);
  }
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
  if (cloudPlayer) overlayServerEconomy(st, cloudPlayer);
  offlineMode = false;
  saveNow();
  ui.initUI(appObj);
  ui.showApp();
  if (isLocalAcc(account)) {
    ui.setCloudBanner("offline");
    ui.toast("شما آفلاینید — وارد حساب آفلاین شدی. اینترنت که بیاید همه چیز اجباری روی ابر می‌رود.", "bad", 4800);
    upgradeToCloud().then((ok) => { if (ok && st) saveNow(); }).catch(() => {});
  } else {
    ui.setCloudBanner("cloud");
    startOnlineServices();
    ui.toast(`خوش آمدی، ${uname}! همه چیز روی ابر ذخیره می‌شود.`, "good", 3200);
  }
  tickAndRender();
  sfx.win();
}

function bootLocal(acc, msg) {
  account = acc || null;
  if (acc) {
    cloud.setSession(acc.token);
    window.__sls_userId = acc.userId;
    st = loadLocalState(acc.userId) || loadLocalState("guest") || loadLocalState("anon") || newState(acc.username, acc.userId);
    st.username = acc.username || st.username;
    offlineMode = isLocalAcc(acc);
  } else {
    st = loadLocalState() || newState("مهمان", "guest");
    offlineMode = true;
  }
  ui.initUI(appObj);
  ui.showApp();
  tickAndRender();
  ui.setCloudBanner(offlineMode || isLocalAcc(acc) ? (offlineMode ? "guest" : "offline") : "offline");
  ui.toast(msg || "شما آفلاینید — وارد حساب آفلاین شدی", "bad", 4800);
  if (acc && acc.pass) upgradeToCloud().then((ok) => { if (ok && st) saveNow(); }).catch(() => {});
}

async function autoLogin() {
  try {
    cloud.initCloud?.();
    const acc = lsGet("account");
    if (!acc || !acc.userId) {
      st = loadLocalState() || newState("", "anon");
      showAuth();
      ui.toast("ذخیره اجباری روی ابر است — ثبت‌نام کن یا اگر اینترنت نداری حساب آفلاین بزن", "info", 4200);
      return;
    }
    if (String(acc.token || "").startsWith("local-") || String(acc.userId).startsWith("loc_")) {
      bootLocal(acc, "شما آفلاینید — وارد حساب آفلاین شدی");
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
      overlayServerEconomy(st, r.player);
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
      bootLocal(acc, "شما آفلاینید — وارد حساب آفلاین شدی");
      return;
    }
    if (acc.pass) {
      const r2 = await cloud.login(acc.username, acc.pass);
      if (!r2.error && r2.token) {
        await onAuthed(r2, acc.pass);
        return;
      }
    }
    bootLocal(acc, "شما آفلاینید — وارد حساب آفلاین شدی");
  } catch (e) {
    const acc = lsGet("account");
    if (acc && acc.userId) bootLocal(acc, "شما آفلاینید — وارد حساب آفلاین شدی");
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
  account = { username: "مهمان", pass: "", token: "local-guest", userId: "guest" };
  st = loadLocalState("guest") || loadLocalState() || newState("مهمان", "guest");
  st.username = "مهمان";
  ui.initUI(appObj);
  ui.showApp();
  tickAndRender();
  ui.setCloudBanner("guest");
  ui.toast("شما آفلاینید — وارد حساب آفلاین (مهمان) شدی. ذخیره فقط روی این دستگاه است تا اینترنت بیاید.", "bad", 5200);
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
    if (!s.online) {
      ui.setCloudBanner("offline");
      ui.toast("شما آفلاینید — اتصال ابر قطع شد", "bad", 4000);
    } else ui.setCloudBanner("cloud");
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
    ui.showPunishmentModal(ev, ev.reason || "مجازات سیستم");
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
  if (!cv || typeof cv.getContext !== "function") return;
  const g = cv.getContext("2d");
  if (!g) return;
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
  isCloud: () => !!(account && !offlineMode && !isLocalAcc(account)),
  isOffline: () => offlineMode,
  lastCloudSync: () => lastCloudSync,
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
window.__slsClickDuel = () => {
  import("./battleui.js").then((B) => {
    B.openClickDuel({
      duelId: "demo-click",
      me: { id: "me", name: st.username || "تو", level: st.level || 1, power: computePower(st) },
      opp: { id: "opp", name: "رقیب", level: 1, power: 10 },
      isHost: true,
      send: () => {},
      onEnd: () => {}
    });
  });
};
document.addEventListener("visibilitychange", () => {
  if (!st) return;
  if (document.hidden) {
    try { saveNow(); } catch (e) {}
    return;
  }
  if (!el("screen-auth")?.classList.contains("hidden")) return;
  try {
    tickAndRender();
    ui.renderTopbar();
    if (ui.currentPageName() === "home") ui.renderHome();
  } catch (e) { console.warn(e); }
});
window.addEventListener("beforeunload", () => { try { if (st) saveNow(); } catch (e) {} });
try {
  const CapApp = window.Capacitor?.Plugins?.App;
  CapApp?.addListener?.("pause", () => { try { if (st) saveNow(); } catch (e) {} });
} catch (e) {}
window.addEventListener("online", () => { ui.toast("اینترنت برگشت — در حال همگام‌سازی...", "good"); if (account) saveNow(); });

initMute();
startBgFX();
requestNotifPermission();
autoLogin();
