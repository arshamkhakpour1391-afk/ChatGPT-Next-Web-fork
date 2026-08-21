/* ================= رابط کاربری ================= */
import {
  el, make, esc, faNum, fmt, fmtNum, dur, timeAgo, todayKey, weekKey, nowMs,
  debounce, lsGet, lsSet, sfx, notifyLocal, vibrate, sleep, pick as pickArr, clamp,
  setMuted, isMuted
} from "./util.js";
import {
  xpNeed, maxEnergy, combatStats, computePower, doTrain, addXP, gainGold, addItem,
  consumeItem, buyItem, sellItem, useItem, equipWeapon, equipArmor, equipTitle,
  unlockSkill, meetsReq, toggleSkill, MAX_ACTIVE_SKILLS, skillUnlocked,
  assignShadow, activeMissions, applyProgress, claimMission, dailyQuests, claimDailyQuest,
  applyPunishment, activeDebuffs, tickState, yearState, claimYearDay, currentPicks, takePick,
  missionBucket, dailyDeals, addRankPts, activeBuffs,
  autoEquipBest, claimAllReady, dailyFeatured, achievementsOf,
  spendStat, upgradeShadow, fuseShadows, sweepDungeon, markFailedMission,
  featuredMult, firstClearMult, codexStats, energyCap, migrateState,
} from "./engine.js";
import {
  dungeonIndex, bossIndex, skillIndex, DUNGEON_COUNT, BOSS_COUNT, SKILL_COUNT,
  SHOP_ITEMS, SHOP_CATS, itemById, itemByName, yearQuestDay, YEAR_DAYS,
  hunterClass, rankOfLevel, missionOf, MISSION_INTERVAL_MS, RANKS, ARCHETYPES,
  shopListForCat, CATALOG_COUNT, levelTag, LEVEL_CAP,
} from "./data.js";
import { texUrl, PRESET_AVATARS, readAvatarFile, avatarMarkup } from "./gfx.js";
import {
  openBattle, hideFight, isFighting, openShooterDuel, shooterRemoteState,
  shooterRemoteBullet, shooterRemotePowerup, shooterRemoteEnd, hideShooter,
  openClickDuel, clickDuelRemote, clickDuelRemoteEnd, hideClickDuel, openFfaArena,
} from "./battleui.js";
import * as cloud from "./cloud.js";
import { SCHEMA_SQL } from "./schema-inline.js";

let app = null; // ست می‌شود توسط main
export function initUI(a) { app = a; }

const $ = (id) => el(id);
function nameTagHtml(level) {
  const r = rankOfLevel(level || 1);
  return `<span class="name-tag ${r.cls}"><b>${esc(r.key)}</b> ${esc(levelTag(level || 1))}</span>`;
}

/* ---------- توست ---------- */
export function toast(msg, type = "info", ms = 2600) {
  const wrap = $("toasts");
  if (!wrap) return;
  const t = make(`<div class="toast ${type}"><span>${esc(msg)}</span></div>`);
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 320); }, ms);
}

/* ---------- پنجرهٔ سیستم ---------- */
let sysTimer = null;
export function sysWindow(html, cls = "") {
  const w = $("sys-window");
  w.className = "sys-window " + cls;
  $("sys-window-body").innerHTML = html;
  w.classList.remove("hidden");
  sfx.notif();
  clearTimeout(sysTimer);
  sysTimer = setTimeout(() => w.classList.add("hidden"), 7000);
}
$("sys-close")?.addEventListener("click", () => $("sys-window").classList.add("hidden"));

/* ---------- مودال ---------- */
export function modal({ title, body, actions = [], cls = "", onClose }) {
  const m = $("modal");
  const html = `<h3>${esc(title)}</h3><div class="m-body">${body}</div><div class="m-actions"></div>`;
  m.innerHTML = html;
  m.className = "modal " + cls;
  const actBox = m.querySelector(".m-actions");
  actions.forEach((a) => {
    const b = make(`<button class="btn ${a.cls || "btn-ghost"}">${esc(a.label)}</button>`);
    b.addEventListener("click", () => { closeModal(); a.cb && a.cb(); });
    actBox.appendChild(b);
  });
  $("modal-wrap").classList.remove("hidden");
  m._onClose = onClose;
}
export function closeModal() {
  $("modal-wrap").classList.add("hidden");
}
function inspectThing(it) {
  if (!it) return;
  const tex = it.tex || texUrl(it.cat || "item", it.id || it.i || 0);
  const story = it.story || it.lore || it.desc || "";
  modal({
    title: it.name || "جزئیات",
    body: `<div class="tex-lg" style="background-image:url('${tex}')"></div>
      <p class="item-story">${esc(story)}</p>
      <p>${esc(it.desc || "")}${it.element ? " · عنصر " + esc(it.element) : ""}${it.archetype ? " · " + esc(it.archetype.name) : ""}</p>`,
    actions: [{ label: "بستن", cb() {} }]
  });
}
$("modal-wrap")?.addEventListener("click", (e) => {
  if (e.target === $("modal-wrap")) closeModal();
});

/* ---------- رویدادها (مرکز اعلان) ---------- */
export function addEvent(title, body, type = "info") {
  const st = app && app.getSt && app.getSt();
  if (!st) return;
  st.events = st.events || [];
  st.events.unshift({ ts: nowMs(), title, body, type });
  if (st.events.length > 60) st.events.length = 60;
  st.unreadNotifs = (st.unreadNotifs || 0) + 1;
  app.save();
  updateNotifDot();
  try { notifyLocal(title, body); sfx.notif(); vibrate(18); } catch (e) {}
}
export function updateNotifDot() {
  const st = app.getSt();
  $("notif-dot").classList.toggle("hidden", !(st.unreadNotifs > 0));
}
$("btn-notifs")?.addEventListener("click", () => {
  const st = app.getSt();
  st.unreadNotifs = 0;
  app.save(); updateNotifDot();
  const list = (st.events || []).slice(0, 40).map((e) =>
    `<div class="duel-history-item ${e.type === "bad" ? "loss" : "win"}">
      <div><b>${esc(e.title)}</b><br><span style="font-size:9px">${esc(e.body)} — ${timeAgo(e.ts)}</span></div>
    </div>`).join("") || "<p>هنوز رویدادی نیست.</p>";
  modal({ title: "اعلان‌های سیستم", body: `<div class="list" style="padding:0">${list}</div>`, actions: [{ label: "بستن", cb() {} }] });
});

/* ---------- سوییچ تب ---------- */
let currentPage = "home";
export function switchPage(name, silent) {
  if (!name || name === currentPage && silent) {
    if (name === currentPage) { renderPage(name); return; }
  }
  if (currentPage === "duel" && name !== "duel") {
    try { clearInterval(onlinePoll); onlinePoll = null; } catch (e) {}
  }
  currentPage = name;
  document.querySelectorAll(".page").forEach((p) => {
    const on = p.dataset.page === name;
    p.classList.toggle("active", on);
    if (on) { p.classList.remove("page-in"); void p.offsetWidth; p.classList.add("page-in"); }
  });
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  if ($("pages")) $("pages").scrollTop = 0;
  try { renderPage(name); } catch (e) { console.warn(e); toast("این تب یک لحظه خطا داد — دوباره بزن", "bad"); }
  if (!silent) sfx.click();
}
function renderPage(name) {
  switch (name) {
    case "home": renderHome(); break;
    case "missions": renderMissions(); break;
    case "gates": renderGates(); break;
    case "battle": renderBosses(); break;
    case "shop": renderShop(); break;
    case "bag": renderBag(); break;
    case "duel": renderDuelTab(); break;
    case "chat": renderChat(); break;
    case "ranks": renderRanks(); break;
  }
}
document.querySelectorAll(".nav-btn").forEach((b) => {
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    switchPage(b.dataset.page);
  });
});
// سوایپ تب‌ها عمداً خاموش است — اسکرول لیست و کلیک سریع نباید تب را عوض کند

/* ================= هدر و خانه ================= */
export function renderTopbar() {
  const st = app && app.getSt && app.getSt();
  if (!st) return;
  const hc = hunterClass(st.level);
  const letter = (st.username || "ش").charAt(0).toUpperCase();
  const av = $("avatar");
  if (av) av.innerHTML = avatarMarkup(st.avatar, letter);
  const al = $("avatar-letter");
  if (al && !st.avatar) al.textContent = letter;
  $("hunter-name").textContent = st.username || "—";
  const rk = rankOfLevel(st.level);
  $("hunter-rank").textContent = `${rk.key} · ${levelTag(st.level)}`;
  $("hunter-rank").style.color = rk.color;
  $("res-gold").textContent = fmtNum(st.gold);
  $("res-gems").textContent = faNum(st.gems);
  $("res-energy").textContent = `${faNum(st.energy)}/${faNum(energyCap(st))}`;
  const need = xpNeed(st.level);
  $("xp-label").textContent = `سطح ${faNum(st.level)}`;
  $("xp-nums").textContent = `${fmtNum(st.xp)} / ${fmtNum(need)}`;
  $("xp-fill").style.width = clamp(st.xp / need * 100, 0, 100) + "%";
  $("power-num").textContent = fmtNum(computePower(st));
  $("home-level").textContent = faNum(st.level);
  $("home-class").textContent = hc.name;
  const titles = ["مبتدی", "شکارچی تازه‌کار", "گرگ تنها", "نابودگر باس‌ها", "پاک‌کنندهٔ دروازه‌ها", "استاد رقابت", "پادشاه سایه‌ها", "افسانهٔ زنده", "جاودان", "اسطوره", "ارباب جهان", "تاج ابدیت"];
  const earned = titles.filter((t) => st.titles && st.titles[t]);
  $("home-title").textContent = earned[earned.length - 1] || "مبتدی";
  updateNotifDot();
}

let comboResetTimer = null;
let trainBound = false;
function bindTrain() {
  if (trainBound) return;
  trainBound = true;
  const btn = $("btn-train");
  const click = (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    const st = app.getSt();
    if (!st) return;
    const evt = doTrain(st);
    sfx.click();
    vibrate(12);
    btn.classList.remove("hit-pop"); void btn.offsetWidth; btn.classList.add("hit-pop");
    const zone = $("dmg-zone");
    if (zone) {
      const pop = make(`<div class="dmg-pop ${evt.crit ? "crit" : ""}">+${faNum(evt.xp)}${evt.gold ? " · 🪙" + faNum(evt.gold) : ""}</div>`);
      pop.style.top = (20 + Math.random() * 55) + "%";
      pop.style.right = (15 + Math.random() * 60) + "%";
      zone.appendChild(pop);
      setTimeout(() => pop.remove(), 820);
    }
    $("today-clicks").textContent = fmtNum(st.stats.dayClicks || 0);
    if (evt.combo && evt.combo > 2) {
      $("train-combo").textContent = "کمبو ×" + faNum(evt.combo);
      clearTimeout(comboResetTimer);
      comboResetTimer = setTimeout(() => { $("train-combo").textContent = ""; }, 1400);
    }
    $("best-combo").textContent = faNum(st.stats.bestCombo || 0);
    if (evt.leveled) {
      levelUpCelebrate(evt.levelUps);
      sysWindow(`<div class="sys-row"><span>سطح جدید</span><b>سطح ${faNum(st.level)}</b></div>
        <div class="sys-row"><span>قدرت</span><b>${fmtNum(computePower(st))}</b></div>
        <div class="sys-row"><span>امتیاز آمار</span><b>+${faNum(evt.levelUps)}</b></div>
        <p style="margin-top:8px">تو قوی‌تر شدی. جایزه بگیر و در کیف امتیاز آمار خرج کن.</p>`, "gold");
    }
    applyProgress(st, "clicks", 1);
    app.save();
    renderTopbar();
    if (currentPage === "home") renderDailyQuests(); // آپدیت زندهٔ ماموریت روزانه
  };
  btn.addEventListener("pointerdown", click);
}

function levelUpCelebrate(times) {
  sfx.levelup();
  const f = make(`<div class="levelup-flash"></div>`);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1150);
  confetti();
  if (times > 1) toast(`سطح چندتایی! +${faNum(times)} سطح`, "gold", 3200);
}
function confetti() {
  const layer = $("confetti");
  const colors = ["#7c5cff", "#ffc93c", "#2eff7e", "#2ad4ff", "#ff2d55"];
  for (let i = 0; i < 60; i++) {
    const p = make(`<i style="position:absolute;width:7px;height:7px;border-radius:2px;background:${colors[i % 5]};top:-10px;right:${Math.random() * 100}%;animation:confFall ${1.6 + Math.random()}s linear forwards;animation-delay:${Math.random() * 0.3}s"></i>`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}

function renderDailyQuests() {
  const st = app.getSt();
  const quests = dailyQuests(st);
  const box = $("daily-quests");
  box.innerHTML = "";
  Object.values(quests).forEach((q) => {
    const pct = clamp(q.prog / q.n * 100, 0, 100);
    const row = make(`<div class="mission-card ${q.done && !q.claimed ? "" : ""}">
      <div class="m-top"><span class="m-rank rank-S" style="background:rgba(255,45,85,.15);color:#ff8099;border:1px solid rgba(255,45,85,.4)">!</span>
      <span class="m-title">${esc(q.label)}</span></div>
      <div class="m-meta"><span>${q.done ? "انجام شد ✓" : `${fmtNum(q.prog)} / ${fmtNum(q.n)}`}</span><span class="m-deadline red">تا پایان امروز</span></div>
      <div class="m-progress"><div class="bar-fill" style="width:${pct}%"></div></div>
      ${q.done && !q.claimed ? `<button class="btn btn-gold btn-sm m-claim" data-dq="${q.id}">دریافت جایزه</button>` : q.claimed ? `<span class="chip chip-green">دریافت شد</span>` : ""}
    </div>`);
    const btn = row.querySelector("[data-dq]");
    if (btn) btn.addEventListener("click", () => {
      const r = claimDailyQuest(app.getSt(), q.id);
      if (r.error) return toast(r.error, "bad");
      toast(`جایزه روزانه: طلا +${fmtNum(r.gold)} و ۱ جواهر`, "gold");
      sfx.coin();
      app.save(); renderHome();
    });
    box.appendChild(row);
  });
}

function renderYearQuest() {
  const st = app.getSt();
  yearState(st);
  const y = st.year;
  const q = yearQuestDay(y.day);
  $("year-day-chip").textContent = `روز ${faNum(y.day)} از ${faNum(YEAR_DAYS)}`;
  const p = y.prog;
  const done = p.clicks >= q.need.clicks && p.kills >= q.need.kills && p.dungeons >= q.need.dungeons;
  $("year-quest").innerHTML = `
    <p style="font-size:11px;color:var(--txt2);line-height:2">${esc(q.story)}</p>
    <div class="m-meta"><span>زنجیره: ${faNum(y.streak)} روز</span><span class="${done ? "chip chip-green" : ""}"></span></div>
    <div class="m-meta"><span>تمرین: ${fmtNum(p.clicks)}/${fmtNum(q.need.clicks)}</span><span>شکار: ${fmtNum(p.kills)}/${fmtNum(q.need.kills)}</span><span>دانجن: ${fmtNum(p.dungeons)}/${fmtNum(q.need.dungeons)}</span></div>
    <div class="m-meta"><span class="chip chip-gold">جایزه: ${fmtNum(q.reward.gold)} طلا + ${fmtNum(q.reward.xp)} XP + ${faNum(q.reward.gems)} جواهر</span></div>
    ${done && !y.claimedToday ? `<button class="btn btn-gold btn-sm" id="btn-year-claim" style="width:100%;margin-top:6px">دریافت جایزهٔ روز ${faNum(y.day)}</button>` : y.claimedToday ? `<span class="chip chip-green">دریافت شد — فردا ادامه بده</span>` : `<span class="chip chip-blue">هنوز کامل نشده</span>`}
    <p style="font-size:9.5px;color:var(--txt3);margin-top:6px">اگر یک روز کامل نگذرد و کارها انجام نشود: مجازات!</p>`;
  $("btn-year-claim")?.addEventListener("click", () => {
    const r = claimYearDay(app.getSt());
    if (r.error) return toast(r.error, "bad");
    toast("جایزهٔ مسیر سالانه دریافت شد!", "gold");
    sfx.win(); confetti();
    app.save(); renderHome();
  });
}

function renderRewardPicks() {
  const st = app.getSt();
  const picks = currentPicks(st);
  const p = st.daily.picks;
  $("reward-token-chip").textContent = `${faNum(p.remaining)} انتخاب مانده`;
  const box = $("reward-picks");
  if (!picks.length) {
    box.innerHTML = `<p style="font-size:11px;color:var(--txt3)">با هر لِوِل‌آپ یک انتخاب جایزه می‌گیری (حداکثر ۳ در روز). امروز انتخاب‌هایت تمام شده — فردا جایزه‌های جدید و متفاوت!</p>`;
    return;
  }
  box.innerHTML = `<p style="font-size:10.5px;color:var(--txt2);margin-bottom:6px">یکی از ۳ جایزهٔ امروز را انتخاب کن (واقعی — مستقیم به حسابت می‌رود):</p><div class="deal-strip" style="padding:0">`;
  const strip = box.querySelector(".deal-strip");
  picks.forEach((pk, idx) => {
    const card = make(`<div class="deal-card"><div class="d-off">جایزهٔ امروز</div>
      <div style="font-size:30px;text-align:center;margin:6px 0">${pk.icon}</div>
      <div class="d-name">${esc(pk.name)}</div><div class="d-price">${esc(pk.desc)}</div>
      <button class="btn btn-gold btn-sm" style="width:100%;margin-top:6px" data-pick="${idx}">انتخاب</button></div>`);
    card.querySelector("[data-pick]").addEventListener("click", () => {
      const got = takePick(app.getSt(), idx);
      if (!got) return toast("انتخابی نمانده", "bad");
      toast(`«${got.name}» دریافت شد!`, "gold");
      sfx.coin(); confetti();
      app.save(); renderHome();
    });
    strip.appendChild(card);
  });
}

function renderPunishments() {
  const st = app.getSt();
  $("punish-count-chip").textContent = `${faNum(st.punish.count)} مجازات`;
  const debs = activeDebuffs(st);
  const box = $("punish-list");
  const history = (st.punish.history || []).slice(0, 6).map((h) => {
    const blocked = h.blocked ? " (با محافظ لغو شد)" : "";
    return `<div class="duel-history-item loss"><div><b>${esc(h.reason || "مجازات")}</b><br><span style="font-size:9px">${timeAgo(h.ts)}${blocked}</span></div><span>${h.goldLoss ? "-" + fmtNum(h.goldLoss) + " طلا" : ""}</span></div>`;
  }).join("");
  const debHtml = debs.length ? `<div class="chip chip-red">⚠️ دیباف فعال: قدرت -${faNum(debs[0].powerPct || 10)}٪ تا ${dur(debs[0].until - nowMs())} دیگر</div>` : "";
  box.innerHTML = debHtml + history || "<p>هنوز مجازاتی نداشتی — کارها را انجام بده!</p>";
}

function renderHomeStats() {
  const st = app.getSt();
  const box = $("home-stats");
  if (!box) return;
  const items = [
    [fmtNum(st.stats.clicks || 0), "تمرین"],
    [fmtNum(st.stats.kills || 0), "کشته"],
    [fmtNum(st.stats.dungeons || 0), "دانجن"],
    [fmtNum(Object.keys(st.shadows || {}).length), "سایه"],
    [fmtNum(st.stats.wins || 0), "برد"],
    [fmtNum(st.rank_pts ?? 1000), "رنک"],
  ];
  box.innerHTML = items.map(([v, l]) => `<div class="hs-item"><b>${v}</b><span>${l}</span></div>`).join("");
}
function renderBuffs() {
  const st = app.getSt();
  const box = $("buff-strip");
  if (!box) return;
  const names = { atk: "حمله", def: "دفاع", crit: "کریت", haste: "سرعت", xp: "XP", gold: "طلا", vamp: "خون‌آشام", extract: "سایه", regen: "بازیابی", hp: "جان" };
  box.innerHTML = activeBuffs(st).map((b) => `<span class="buff-chip">${names[b.k] || b.k} +${faNum(b.pct)}٪ · ${dur(b.until - nowMs())}</span>`).join("");
}

export function renderHome() {
  if (!app || !app.getSt || !app.getSt()) return;
  renderTopbar();
  renderQuick();
  renderHomeStats();
  renderBuffs();
  maybeDailyLogin();
  maybeIntro();
  renderFeatured();
  renderAchievements();
  renderDailyQuests();
  renderYearQuest();
  renderRewardPicks();
  renderPunishments();
}

function renderQuick() {
  const box = $("quick-row");
  if (!box) return;
  const st = app.getSt();
  const cx = codexStats(st);
  box.innerHTML = "";
  const mk = (lab, fn) => {
    const b = make(`<button class="btn btn-ghost btn-sm">${lab}</button>`);
    b.addEventListener("click", fn);
    box.appendChild(b);
  };
  mk("⚔️ تمرین مبارزه", () => startDummy());
  mk("⚙️ تجهیز خودکار", () => {
    const r = autoEquipBest(app.getSt());
    toast(r.weapon || r.armor ? "بهترین تجهیزات پوشیده شد" : "چیزی برای تجهیز نبود", "good");
    app.save(); renderTopbar();
  });
  mk("🎁 دریافت همه", () => {
    const n = claimAllReady(app.getSt());
    toast(n ? `${faNum(n)} جایزه گرفته شد` : "چیزی آماده نیست", n ? "gold" : "info");
    app.save(); renderHome();
  });
  mk("👥 دوستان", () => switchPage("chat"));
  mk("🔫 نبرد آزاد", () => { switchPage("duel"); setTimeout(() => $("btn-ffa")?.click(), 80); });
  mk(`📒 کدکس ${faNum(cx.dungeons)}/${faNum(cx.bosses)}`, () => {
    modal({
      title: "کدکس شکارچی",
      body: `<div class="m-meta"><span>دروازهٔ پاک‌شده</span><b>${faNum(cx.dungeons)}</b></div>
        <div class="m-meta"><span>باس کشته</span><b>${faNum(cx.bosses)}</b></div>
        <div class="m-meta"><span>سایه‌ها</span><b>${faNum(cx.shadows)}</b></div>
        <p>اولین پاکسازی هر دروازه جایزهٔ بیشتر می‌دهد.</p>`,
      actions: [{ label: "بستن", cb() {} }]
    });
  });
}
function startDummy() {
  const st = app.getSt();
  if (isFighting()) return;
  openBattle({
    mode: "dummy",
    src: { name: "مترسک تمرین", hp: 500 + st.level * 90, atk: 6, def: 3, emoji: "🎯", skills: [], gold: 0, xp: 0, essenceChance: 0, rank: { name: "تمرین" }, element: "سایه", archetype: { key: "warden", name: "نگهبان", tag: "تمرین" } },
    st, toast,
    save: () => app.save(),
    consumeItem: (id, n) => consumeItem(st, id, n),
    applyProgress: () => {},
    onSkillUsed: () => applyProgress(st, "skills", 1),
    onWin: () => toast("تمرین تمام شد.", "good"),
    onLose: () => toast("مترسک زدتت.", "bad"),
    onExit: () => {},
  });
}
function renderFeatured() {
  const box = $("featured-body");
  if (!box) return;
  const f = dailyFeatured();
  const d = dungeonIndex(f.dungeon);
  const b = bossIndex(f.boss);
  box.innerHTML = `<div class="m-meta"><span>🚪 ${esc(d.name)}</span><span>سطح ${faNum(d.level)}</span></div>
    <button class="btn btn-primary btn-sm" id="feat-d" style="width:100%;margin:6px 0">ورود به دانجن امروز</button>
    <div class="m-meta"><span>${b.emoji} ${esc(b.name)}</span><span>سطح ${faNum(b.level)}</span></div>
    <button class="btn btn-red btn-sm" id="feat-b" style="width:100%;margin-top:6px">شکار باس امروز</button>`;
  $("feat-d")?.addEventListener("click", () => enterDungeon(f.dungeon, d));
  $("feat-b")?.addEventListener("click", () => fightBoss(f.boss, b));
}
function renderAchievements() {
  const box = $("achieve-body");
  if (!box) return;
  const list = achievementsOf(app.getSt());
  const ok = list.filter((x) => x.ok).length;
  if ($("achieve-chip")) $("achieve-chip").textContent = `${faNum(ok)}/${faNum(list.length)}`;
  box.innerHTML = list.map((x) => `<span class="chip ${x.ok ? "chip-green" : "chip-gray"}">${x.ok ? "✓ " : "○ "}${esc(x.name)}</span>`).join(" ");
}

function maybeIntro() {
  const st = app.getSt();
  if (st.seenIntro) return;
  st.seenIntro = true;
  app.save();
  sysWindow(`<div class="sys-row"><span>سیستم</span><b>فعال شد</b></div>
    <p>تو انتخاب شدی. از این لحظه هر کلیک، هر دروازه و هر شکست ثبت می‌شود.</p>
    <p>ماموریت‌های اجباری را انجام بده. اگر نشکنی، سیستم مجازات می‌کند.</p>
    <p style="color:#c2aeff">ارتش سایه‌ات را بساز. پادشاه سایه‌ها منتظر است.</p>`, "gold");
}

function maybeDailyLogin() {
  const st = app.getSt();
  if (st.pendingLogin) {
    const r = st.pendingLogin;
    st.pendingLogin = null;
    app.save();
    sysWindow(`<div class="sys-row"><span>ورود روزانه</span><b>روز ${faNum(r.streak)}</b></div>
      <div class="sys-row"><span>طلا</span><b>+${fmtNum(r.gold)}</b></div>
      <div class="sys-row"><span>تجربه</span><b>+${fmtNum(r.xp)}</b></div>
      <div class="sys-row"><span>جواهر</span><b>+${faNum(r.gems)}</b></div>
      <p>هر روز برگرد تا زنجیره‌ات نشکند.</p>`, "gold");
    toast(`ورود روزانه: زنجیره ${faNum(r.streak)} روز`, "gold", 3200);
  }
  if (st.pendingTitles && st.pendingTitles.length) {
    const t = st.pendingTitles.shift();
    toast(`عنوان جدید: ${t}`, "gold", 3600);
    app.save();
  }
}

/* ================= ماموریت‌ها ================= */
let missionTab = "active";
document.querySelectorAll(".m-tab").forEach((b) => b.addEventListener("click", () => {
  missionTab = b.dataset.mtab;
  document.querySelectorAll(".m-tab").forEach((x) => x.classList.toggle("active", x === b));
  renderMissions();
}));
export function renderMissions() {
  const st = app.getSt();
  const list = activeMissions(st);
  const now = nowMs();
  const bucket = missionBucket(now);
  const nextIn = MISSION_INTERVAL_MS - (now % MISSION_INTERVAL_MS);
  $("mission-timer").innerHTML = `ماموریت جدید تا <b>${dur(nextIn)}</b> دیگر — هر ۲ ساعت`;
  const box = $("mission-list");
  box.innerHTML = "";
  const oldClaim = $("btn-claim-all");
  if (missionTab !== "active") {
    if (oldClaim && oldClaim.parentNode) oldClaim.parentNode.remove();
  } else if (!oldClaim) {
    const wrap = make(`<div style="padding:0 12px 8px"><button class="btn btn-gold btn-sm" id="btn-claim-all" style="width:100%">دریافت همهٔ جوایز آماده‌</button></div>`);
    box.parentNode.insertBefore(wrap, box);
    wrap.querySelector("#btn-claim-all").addEventListener("click", () => {
      const n = claimAllReady(app.getSt());
      if (!n) return toast("چیزی برای دریافت نیست", "info");
      toast(`${faNum(n)} جایزه دریافت شد`, "gold");
      sfx.coin(); app.save(); renderMissions(); renderTopbar();
    });
  }
  const done = st.missions || {};
  let shown = 0;
  list.forEach((m) => {
    const rec = done[m.id] || {};
    const isDoneTab = missionTab === "done";
    const showInDone = rec.done || rec.claimed || rec.failed;
    if (isDoneTab && !showInDone) return;
    if (!isDoneTab && rec.claimed) return;
    if (m.failDeadline && !rec.done && !rec.claimed && !rec.failed) {
      if (!markFailedMission(st, m.id)) return;
      const ev = applyPunishment(st, `ماموریت اجباری انجام نشد: ${m.title}`, {});
      app.save();
      showPunishmentModal(ev, m.title);
      return;
    }
    shown++;
    const pct = clamp((rec.prog || 0) / m.n * 100, 0, 100);
    const deadlineLeft = m.deadline - now;
    const card = make(`<div class="mission-card ${m.mandatory ? "mandatory" : ""} ${rec.claimed ? "done-card" : ""}">
      ${m.mandatory && !rec.claimed ? `<div class="punish-stamp">اجباری! مجازات دارد</div>` : ""}
      <div class="m-top"><span class="m-rank ${rankOfLevel(Math.min(st.level + m.slot * 20, 999)).cls}">${m.icon}</span>
        <span class="m-title">${esc(m.title)}</span></div>
      <div class="m-desc">${esc(m.desc)}</div>
      <div class="m-meta">
        <span>${fmtNum(rec.prog || 0)} / ${fmtNum(m.n)}</span>
        <span class="m-deadline ${m.mandatory ? "red" : ""}">${m.mandatory ? "⏳ " + dur(deadlineLeft) : "تا " + dur(deadlineLeft)}</span>
      </div>
      <div class="m-progress"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="m-reward">جایزه: ${fmtNum(m.reward.gold)} طلا · ${fmtNum(m.reward.xp)} XP${m.reward.gems ? " · " + faNum(m.reward.gems) + " جواهر" : ""}</div>
      ${rec.done && !rec.claimed ? `<button class="btn btn-gold btn-sm m-claim" data-mid="${m.id}">دریافت جایزه</button>` : rec.claimed ? `<span class="chip chip-green">دریافت شد ✓</span>` : `<span class="chip chip-blue">در حال انجام...</span>`}
    </div>`);
    const btn = card.querySelector("[data-mid]");
    if (btn) btn.addEventListener("click", () => {
      const r = claimMission(app.getSt(), m.id);
      if (r.error) return toast(r.error, "bad");
      toast(`ماموریت انجام شد: +${fmtNum(r.m.gold)} طلا، +${fmtNum(r.m.xp)} XP`, "gold");
      sfx.coin();
      app.save(); renderMissions();
    });
    box.appendChild(card);
  });
  if (!shown) box.innerHTML = `<p style="text-align:center;color:var(--txt3);padding:20px">${missionTab === "done" ? "هنوز ماموریتی تمام نشده" : "همهٔ ماموریت‌ها انجام شد! ماموریت جدید هر ۲ ساعت می‌آید."}</p>`;
}

export function showPunishmentModal(ev, reason) {
  if (!ev || ev.blocked) {
    if (ev && ev.blocked) { toast("محافظ مجازات فعال شد — مجازات لغو شد!", "good"); addEvent("مجازات لغو شد", reason, "good"); }
    return;
  }
  sfx.punish(); vibrate([200, 100, 200]);
  const f = make(`<div class="punish-flash"></div>`);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1450);
  notifyLocal("مجازات سیستم!", reason);
  addEvent("مجازات!", `${reason} — طلا -${fmtNum(ev.goldLoss)} و قدرت -${faNum(ev.debuffPct)}٪ برای ۲۴ ساعت`, "bad");
  modal({
    title: "⚠️ مجازات سیستم", cls: "punish-modal",
    body: `<div class="punish-ico">💀</div>
      <p style="text-align:center"><b>${esc(reason)}</b><br>
      سیستم: «تو شکست خوردی.»<br>
      <span style="color:#ff7d97">طلا: -${fmtNum(ev.goldLoss)}</span><br>
      <span style="color:#ff7d97">دیباف قدرت: -${faNum(ev.debuffPct)}٪ تا ۲۴ ساعت</span></p>`,
    actions: [{ label: "می‌پذیرم...", cls: "btn-red", cb() { renderHome(); } }]
  });
}

/* ================= دروازه‌ها ================= */
let gateFilter = "all";
let gateArch = "all";
let gateShown = 30;
let gateSort = "level";
function paintSort(id, opts, cur, fn) {
  const bar = $(id);
  if (!bar) return;
  if (!bar.children.length) {
    opts.forEach(([k, lab]) => {
      const b = make(`<button data-sk="${k}">${lab}</button>`);
      b.addEventListener("click", () => fn(k));
      bar.appendChild(b);
    });
  }
  [...bar.children].forEach((b) => b.classList.toggle("on", b.dataset.sk === cur));
}
export function renderGates() {
  const st = app.getSt();
  const filters = ["all", "E", "D", "C", "B", "A", "S", "SS", "N", "M"];
  if (!$("gate-filters").children.length) {
    filters.forEach((f) => {
      const b = make(`<button class="g-filter ${f === gateFilter ? "active" : ""}" data-gf="${f}">${f === "all" ? "همه" : f}</button>`);
      b.addEventListener("click", () => {
        gateFilter = f; gateShown = 30;
        document.querySelectorAll("#gate-filters .g-filter").forEach((x) => x.classList.toggle("active", x === b));
        renderGates();
      });
      $("gate-filters").appendChild(b);
    });
  }
  if ($("gate-arch") && !$("gate-arch").children.length) {
    const allB = make(`<button class="g-filter active" data-ga="all">همهٔ تیپ‌ها</button>`);
    allB.addEventListener("click", () => { gateArch = "all"; gateShown = 30; [...$("gate-arch").children].forEach((x) => x.classList.toggle("active", x === allB)); renderGates(); });
    $("gate-arch").appendChild(allB);
    ARCHETYPES.forEach((a) => {
      const b = make(`<button class="g-filter" data-ga="${a.key}">${a.name}</button>`);
      b.addEventListener("click", () => {
        gateArch = a.key; gateShown = 30;
        [...$("gate-arch").children].forEach((x) => x.classList.toggle("active", x === b));
        renderGates();
      });
      $("gate-arch").appendChild(b);
    });
  }
  const q = (($("gate-search") && $("gate-search").value) || "").trim();
  if ($("gate-search") && !$("gate-search")._bound) {
    $("gate-search")._bound = true;
    $("gate-search").addEventListener("input", debounce(() => { gateShown = 30; renderGates(); }, 180));
  }
  paintSort("gate-sort", [["level","سطح"],["gold","پاداش"],["open","قابل ورود"],["done","پاک‌شده"]], gateSort, (k) => { gateSort = k; gateShown = 30; renderGates(); });
  const box = $("gate-list");
  box.innerHTML = "";
  let shown = 0, total = 0;
  const match = (d) => {
    if (gateFilter !== "all" && d.rank.key !== gateFilter) return false;
    if (gateArch !== "all" && d.archetype && d.archetype.key !== gateArch) return false;
    if (q && !(`${d.name} ${d.monster} ${d.archetype?.name || ""} ${d.element || ""}`).includes(q)) return false;
    return true;
  };
  const order = [];
  const need = gateShown + 1;
  if (gateSort === "gold" || gateSort === "done") {
    const start = Math.max(0, (st.level - 8) * 10);
    const end = Math.min(DUNGEON_COUNT, start + 500);
    for (let i = start; i < end; i++) {
      const d = dungeonIndex(i);
      if (match(d)) order.push(d);
    }
    if (gateSort === "gold") order.sort((a, b) => b.gold - a.gold);
    else order.sort((a, b) => ((st.dungeons && st.dungeons[b.i]) ? 1 : 0) - ((st.dungeons && st.dungeons[a.i]) ? 1 : 0));
  } else {
    for (let i = 0; i < DUNGEON_COUNT && order.length < need; i++) {
      const d = dungeonIndex(i);
      if (match(d)) order.push(d);
    }
    if (gateSort === "open") order.sort((a, b) => (st.level >= a.level ? 0 : 1) - (st.level >= b.level ? 0 : 1) || a.level - b.level);
  }
  for (const d of order) {
    if (shown >= gateShown) break;
    const i = d.i;
    total++;
    shown++;
    const locked = st.level < d.level;
    const cleared = st.dungeons && st.dungeons[i] && st.dungeons[i].cleared;
    const card = make(`<div class="gate-card" style="${cleared ? "border-color:rgba(46,255,126,.4)" : ""}">
      <div class="rank-ico ${d.rank.cls} rank-tex" style="background-image:url('${d.tex || ""}')"><b>${d.rank.key}</b><span>سطح ${faNum(d.level)}</span></div>
      <div class="gate-info">
        <div class="gate-name">${esc(d.name)} ${cleared ? "✓" : ""}</div>
        <div class="gate-sub">${esc(d.monster)} · ${d.archetype ? esc(d.archetype.name) + " · " : ""}${d.element ? esc(d.element) + " · " : ""}${faNum(d.waves)} موج</div>
        <div class="gate-rew">🏆 ${fmtNum(d.gold)} طلا · ${fmtNum(d.xp)} XP · شانس سایه ${faNum(Math.floor(d.essenceChance * 100))}٪</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
      <button class="btn ${locked ? "btn-ghost" : "btn-primary"} btn-sm gate-go" data-g="${i}">${locked ? `سطح ${faNum(d.level)} لازم است` : cleared ? "دوباره" : "ورود"}</button>
      ${cleared && !locked ? `<button class="btn btn-ghost btn-sm" data-sw="${i}">جارو</button>` : ""}
      </div>
    </div>`);
    card.querySelector(".rank-ico")?.addEventListener("click", () => inspectThing({ name: d.name, story: d.story, tex: d.tex, desc: d.monster, element: d.element, archetype: d.archetype, i: d.i }));
    card.querySelector(".gate-go").addEventListener("click", () => enterDungeon(i, d));
    card.querySelector("[data-sw]")?.addEventListener("click", () => {
      const r = sweepDungeon(app.getSt(), i);
      if (r.error) return toast(r.error, "bad");
      toast(`جارو شد! +${fmtNum(r.gold)} طلا · +${fmtNum(r.xp)} XP`, "gold");
      sfx.coin(); app.save(); renderTopbar(); renderGates();
    });
    box.appendChild(card);
  }
  $("gates-more").classList.toggle("hidden", shown < gateShown);
  $("gates-more").onclick = () => { gateShown += 30; renderGates(); };
}

function enterDungeon(i, d) {
  const st = app.getSt();
  if (st.level < d.level) return toast(`برای این دروازه سطح ${faNum(d.level)} لازم داری — گرایند کن!`, "bad");
  const energyCost = 5;
  if (st.energy < energyCost) return toast("انرژی کافی نداری — معجون انرژی بخر یا صبر کن", "bad");
  if (isFighting()) return;
  st.energy -= energyCost;
  st.stats.energyUsed = (st.stats.energyUsed || 0) + energyCost;
  applyProgress(st, "energy", energyCost);
  app.save();
  const src = dungeonIndex(i);
  if (d.level >= st.level) applyProgress(st, "gates", 1);
  const rewardMult = featuredMult(st, "dungeon", i) * firstClearMult(st, "dungeon", i);
  openBattle({
    mode: "dungeon", src, st, rewardMult,
    toast,
    save: () => app.save(),
    consumeItem: (id, n) => consumeItem(st, id, n),
    applyProgress: (t, n) => applyProgress(st, t, n),
    onSkillUsed: () => applyProgress(st, "skills", 1),
    onWin: (rewards) => {
      gainGold(st, rewards.gold);
      addXP(st, rewards.xp);
      st.dungeons = st.dungeons || {};
      st.dungeons[i] = { cleared: true, count: (st.dungeons[i]?.count || 0) + 1, last: nowMs() };
      app.save();
      const extra = rewardMult > 1.01 ? " (جایزهٔ ویژه)" : "";
      toast(`دانجن پاک شد! +${fmtNum(rewards.gold)} طلا، +${fmtNum(rewards.xp)} XP${extra}`, "good", 3400);
      if (rewards.essenceChance > 0.02) maybeArise({ name: "سایهٔ " + src.monster, rankKey: src.rank.key, power: src.bossPower, emoji: src.bossEmoji, baseChance: rewards.essenceChance });
      renderTopbar();
      if (currentPage === "gates") renderGates();
    },
    onLose: ({ goldLoss }) => {
      toast(`شکست خوردی... ${fmtNum(goldLoss)} طلا از دست دادی. قوی‌تر برگرد!`, "bad", 3400);
      renderTopbar();
    },
    onExit: () => {},
  });
}

/* ================= باس‌ها ================= */
let bossFilter = "all";
let bossArch = "all";
let bossShown = 30;
let bossSort = "level";
export function renderBosses() {
  const filters = ["all", "E", "D", "C", "B", "A", "S", "SS", "N", "M"];
  if (!$("battle-filters").children.length) {
    filters.forEach((f) => {
      const b = make(`<button class="g-filter ${f === bossFilter ? "active" : ""}" data-bf="${f}">${f === "all" ? "همه" : f}</button>`);
      b.addEventListener("click", () => {
        bossFilter = f; bossShown = 30;
        document.querySelectorAll("#battle-filters .g-filter").forEach((x) => x.classList.toggle("active", x === b));
        renderBosses();
      });
      $("battle-filters").appendChild(b);
    });
  }
  if ($("battle-arch") && !$("battle-arch").children.length) {
    const allB = make(`<button class="g-filter active" data-ba="all">همهٔ تیپ‌ها</button>`);
    allB.addEventListener("click", () => { bossArch = "all"; bossShown = 30; [...$("battle-arch").children].forEach((x) => x.classList.toggle("active", x === allB)); renderBosses(); });
    $("battle-arch").appendChild(allB);
    ARCHETYPES.forEach((a) => {
      const b = make(`<button class="g-filter" data-ba="${a.key}">${a.name}</button>`);
      b.addEventListener("click", () => {
        bossArch = a.key; bossShown = 30;
        [...$("battle-arch").children].forEach((x) => x.classList.toggle("active", x === b));
        renderBosses();
      });
      $("battle-arch").appendChild(b);
    });
  }
  const st = app.getSt();
  const q = (($("boss-search") && $("boss-search").value) || "").trim();
  if ($("boss-search") && !$("boss-search")._bound) {
    $("boss-search")._bound = true;
    $("boss-search").addEventListener("input", debounce(() => { bossShown = 30; renderBosses(); }, 180));
  }
  paintSort("boss-sort", [["level","سطح"],["gold","پاداش"],["kill","کشته‌شده"]], bossSort, (k) => { bossSort = k; bossShown = 30; renderBosses(); });
  const box = $("boss-list");
  box.innerHTML = "";
  let shown = 0;
  const match = (b) => {
    if (bossFilter !== "all" && b.rank.key !== bossFilter) return false;
    if (bossArch !== "all" && b.archetype && b.archetype.key !== bossArch) return false;
    if (q && !(`${b.name} ${b.archetype?.name || ""} ${b.element || ""}`).includes(q)) return false;
    return true;
  };
  const order = [];
  const need = bossShown + 1;
  if (bossSort === "gold" || bossSort === "kill") {
    const start = Math.max(0, st.level - 8);
    const end = Math.min(BOSS_COUNT, start + 400);
    for (let i = start; i < end; i++) {
      const b = bossIndex(i);
      if (match(b)) order.push(b);
    }
    if (bossSort === "gold") order.sort((a, b) => b.gold - a.gold);
    else order.sort((a, b) => ((st.bosses && st.bosses[b.i]) ? 1 : 0) - ((st.bosses && st.bosses[a.i]) ? 1 : 0));
  } else {
    for (let i = 0; i < BOSS_COUNT && order.length < need; i++) {
      const b = bossIndex(i);
      if (match(b)) order.push(b);
    }
  }
  for (const b of order) {
    if (shown >= bossShown) break;
    const i = b.i;
    shown++;
    const killed = st.bosses && st.bosses[i] && st.bosses[i].killed;
    const tooStrong = st.level + 15 < b.level;
    const card = make(`<div class="boss-card" style="${killed ? "border-color:rgba(46,255,126,.4)" : ""}">
      <div class="rank-ico ${b.rank.cls} rank-tex" style="background-image:url('${b.tex || ""}')"><b>${b.rank.key}</b><span>سطح ${faNum(b.level)}</span></div>
      <div class="boss-info">
        <div class="boss-name">${b.emoji} ${esc(b.name)} ${killed ? "✓" : ""}</div>
        <div class="boss-sub">${b.archetype ? esc(b.archetype.name) + " · " : ""}${b.element ? esc(b.element) + " · " : ""}جان ${fmtNum(b.hp)} · ${esc(b.skills.map((s) => s.name).join("، "))}</div>
        <div class="gate-rew">🏆 ${fmtNum(b.gold)} طلا · ${fmtNum(b.xp)} XP · شانس سایه ${faNum(Math.floor(b.essenceChance * 100))}٪</div>
      </div>
      <button class="btn ${tooStrong ? "btn-ghost" : "btn-red"} btn-sm gate-go" data-b="${i}">${killed ? "دوباره" : "مبارزه!"}</button>
    </div>`);
    card.querySelector(".rank-ico")?.addEventListener("click", () => inspectThing({ name: b.name, lore: b.lore, tex: b.tex, desc: b.skills.map((s) => s.name).join("، "), element: b.element, archetype: b.archetype, i: b.i }));
    card.querySelector(".gate-go").addEventListener("click", () => fightBoss(i, b));
    box.appendChild(card);
  }
  $("bosses-more").classList.toggle("hidden", shown < bossShown);
  $("bosses-more").onclick = () => { bossShown += 30; renderBosses(); };
}

function fightBoss(i, b) {
  const st = app.getSt();
  const energyCost = 3;
  if (st.energy < energyCost) return toast("انرژی کافی نداری!", "bad");
  if (isFighting()) return;
  st.energy -= energyCost;
  st.stats.energyUsed = (st.stats.energyUsed || 0) + energyCost;
  applyProgress(st, "energy", energyCost);
  app.save();
  const src = bossIndex(i);
  const rewardMult = featuredMult(st, "boss", i) * firstClearMult(st, "boss", i);
  openBattle({
    mode: "boss", src, st, rewardMult, toast,
    save: () => app.save(),
    consumeItem: (id, n) => consumeItem(st, id, n),
    applyProgress: (t, n) => applyProgress(st, t, n),
    onSkillUsed: () => applyProgress(st, "skills", 1),
    onWin: (rewards) => {
      gainGold(st, rewards.gold);
      addXP(st, rewards.xp);
      st.bosses = st.bosses || {};
      st.bosses[i] = { killed: true, count: (st.bosses[i]?.count || 0) + 1, last: nowMs() };
      app.save();
      toast(`باس شکست خورد! +${fmtNum(rewards.gold)} طلا، +${fmtNum(rewards.xp)} XP`, "good", 3400);
      if (rewards.essenceChance > 0.02) maybeArise({ name: b.name, rankKey: b.rank.key, power: b.atk * 6, emoji: b.emoji, baseChance: rewards.essenceChance });
      renderTopbar();
      if (currentPage === "battle") renderBosses();
    },
    onLose: ({ goldLoss }) => {
      toast(`شکست خوردی... ${fmtNum(goldLoss)} طلا از دست دادی.`, "bad", 3400);
      renderTopbar();
    },
    onExit: () => {},
  });
}

/* ---------- استخراج سایه (برخاستن!) ---------- */
function maybeArise(src) {
  const st = app.getSt();
  const stones = Object.entries(st.items || {})
    .map(([id, count]) => ({ it: itemById(Number(id)), count }))
    .filter((x) => x.it && x.it.effects && x.it.effects.boost && x.count > 0)
    .sort((a, b) => b.it.effects.boost - a.it.effects.boost);
  const bestBoost = stones.length ? stones[0].it.effects.boost : 0;
  const baseChance = Math.floor(Math.min(0.92, src.baseChance) * 100);
  const boosted = Math.floor(Math.min(0.92, src.baseChance * (1 + bestBoost / 100)) * 100);
  modal({
    title: "برخاستن!", cls: "arise-modal",
    body: `<div class="arise-shadow">${src.emoji}</div>
      <div class="arise-title">سایه‌ای احساس می‌شود...</div>
      <p>می‌توانی روح این دشمن شکست‌خورده را به سایهٔ خودت تبدیل کنی.<br>
      شانس موفقیت: <b style="color:#c2aeff">${faNum(baseChance)}٪</b>${bestBoost ? ` ← با سنگ سایه: <b style="color:#2eff7e">${faNum(boosted)}٪</b>` : ""}<br>
      اگر شکست بخوری، روح برای همیشه ناپدید می‌شود. باید چیزی بشکنی تا صاحب سایه شوی!</p>`,
    actions: [
      { label: `استخراج سایه (${faNum(baseChance)}٪)`, cls: "btn-primary", cb() { doExtract(src, null); } },
      ...(stones.length ? [{ label: `با ${esc(stones[0].it.name)} (${faNum(boosted)}٪)`, cls: "btn-gold", cb() { doExtract(src, stones[0].it.id); } }] : []),
      { label: "رد شدن", cls: "btn-ghost", cb() {} },
    ]
  });
}
function doExtract(src, stoneId) {
  const st = app.getSt();
  let boost = 0;
  if (stoneId) { if (!consumeItem(st, stoneId, 1)) return toast("سنگ نداری", "bad"); boost = itemById(stoneId).effects.boost; }
  const res = (() => {
    const chance = Math.min(0.92, src.baseChance * (1 + boost / 100));
    const roll = Math.random();
    const success = roll < chance;
    let id = null;
    if (success) {
      const sid = "sh_" + nowMs().toString(36) + "_" + Math.floor(Math.random() * 1e6);
      st.shadows[sid] = { id: sid, name: src.name, rank: src.rankKey, power: Math.floor(src.power * (0.4 + Math.random() * 0.5)), emoji: src.emoji, created: nowMs() };
      id = sid;
    }
    st.stats.extracts = (st.stats.extracts || 0) + 1;
    applyProgress(st, "extract", 1);
    app.save();
    return { success, id };
  })();
  if (res.success) {
    sfx.arise(); confetti();
    toast(`برخاستن موفق! سایهٔ «${src.name}» به ارتشت پیوست!`, "good", 4000);
    addEvent("استخراج سایه", `سایهٔ «${src.name}» به ارتش تو پیوست — در کیف مدیریتش کن`, "good");
  } else {
    sfx.lose();
    toast("استخراج شکست خورد... روح ناپدید شد.", "bad", 3200);
  }
}

/* ================= فروشگاه ================= */
let shopCat = "weapon";
let shopSort = "default";
export function renderShop() {
  const st = app.getSt();
  if (!$("shop-tabs").children.length) {
    SHOP_CATS.forEach((c) => {
      const b = make(`<button class="s-tab ${c.key === shopCat ? "active" : ""}" data-sc="${c.key}">${c.icon} ${c.name}</button>`);
      b.addEventListener("click", () => {
        shopCat = c.key;
        document.querySelectorAll(".s-tab").forEach((x) => x.classList.toggle("active", x === b));
        renderShop();
      });
      $("shop-tabs").appendChild(b);
    });
  }
  // تخفیف روزانه
  const deals = dailyDeals(st);
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  $("shop-refresh").innerHTML = `۱۰۰٬۰۰۰ وسیله · تخفیف تا <b>${dur(midnight.getTime() - nowMs())}</b>`;
  $("deal-strip").innerHTML = "";
  deals.forEach((d) => {
    const card = make(`<div class="deal-card">
      <span class="d-off">-${faNum(d.discount)}٪</span>
      <div style="font-size:26px;text-align:center;margin:4px 0">${d.item.icon}</div>
      <div class="d-name">${esc(d.item.name)}</div>
      <div class="d-price">${d.price.gem != null ? `<span style="color:#c8a2ff">💎 ${faNum(d.price.gem)}</span>` : `<span>🪙 ${fmtNum(d.price.gold)}</span>`} <s>${d.item.price.gem != null ? faNum(d.item.price.gem) : fmtNum(d.item.price.gold)}</s></div>
      <button class="btn btn-gold btn-sm" style="width:100%;margin-top:5px" data-deal="${d.item.id}">خرید</button>
    </div>`);
    card.querySelector("[data-deal]").addEventListener("click", () => buyFromShop(d.item.id, true));
    $("deal-strip").appendChild(card);
  });
  // آیتم‌ها
  paintSort("shop-sort", [["default","پیش‌فرض"],["cheap","ارزان"],["rich","گران"],["own","مال خودم"]], shopSort, (k) => { shopSort = k; renderShop(); });
  const grid = $("shop-grid");
  grid.innerHTML = "";
  let list = shopListForCat(shopCat, 36);
  if (shopSort === "cheap") list = list.slice().sort((a, b) => (a.price.gold || a.price.gem * 200 || 0) - (b.price.gold || b.price.gem * 200 || 0));
  if (shopSort === "rich") list = list.slice().sort((a, b) => (b.price.gold || b.price.gem * 200 || 0) - (a.price.gold || a.price.gem * 200 || 0));
  if (shopSort === "own") list = list.slice().sort((a, b) => (st.items[b.id] || 0) - (st.items[a.id] || 0));
  list.forEach((it) => {
    const owned = st.items[it.id] || 0;
    const tex = it.tex || texUrl(it.cat === "weapon" ? "weapon" : it.cat === "armor" ? "armor" : "item", it.id);
    const rar = it.rarity ? `<span class="rarity r${Math.min(4, it.tier || 0)}">${esc(it.rarity)}</span>` : "";
    const card = make(`<div class="item-card">
      <div class="item-ico tex" style="background-image:url('${tex}')">${it.icon}</div>
      <div class="item-name">${esc(it.name)} ${rar}</div>
      <div class="item-desc">${esc(it.desc)}</div>
      <div class="item-foot">
        <span class="item-price ${it.price.gem != null ? "gem" : ""}">${it.price.gem != null ? "💎 " + faNum(it.price.gem) : "🪙 " + fmtNum(it.price.gold)}</span>
        <button class="btn btn-ghost btn-sm" data-info="${it.id}">ℹ</button>
        <button class="btn btn-primary btn-sm item-buy" data-buy="${it.id}">${owned ? "دارید ×" + faNum(owned) : "خرید"}</button>
      </div>
    </div>`);
    card.querySelector("[data-buy]").addEventListener("click", () => buyFromShop(it.id, false));
    card.querySelector("[data-info]").addEventListener("click", () => inspectThing(it));
    grid.appendChild(card);
  });
}
function buyFromShop(itemId, deal) {
  const st = app.getSt();
  let cost;
  if (deal) {
    const d = dailyDeals(st).find((x) => x.item.id === itemId);
    if (d) cost = d.price;
    else return toast("این تخفیف تمام شده", "bad");
  }
  const it = itemById(itemId);
  const price = cost || it.price;
  if (price.gem != null) {
    if (st.gems < price.gem) return toast("جواهر کافی نداری!", "bad");
    st.gems -= price.gem;
  } else {
    if (st.gold < price.gold) return toast("طلا کافی نداری! گرایند کن یا بفروش", "bad");
    st.gold -= price.gold;
  }
  addItem(st, itemId, 1);
  st.stats.shopBuys = (st.stats.shopBuys || 0) + 1;
  applyProgress(st, "shop", 1);
  app.save();
  toast(`«${it.name}» خریداری شد و به کیف رفت`, "good");
  sfx.buy();
  renderTopbar();
  renderShop();
}

/* ================= کیف ================= */
let bagTab = "skills";
export function renderBag() {
  const st = app.getSt();
  if ($("skill-search")) {
    $("skill-search").classList.toggle("hidden", bagTab !== "skills");
    if ($("skill-search") && !$("skill-search")._bound) {
      $("skill-search")._bound = true;
      $("skill-search").addEventListener("input", debounce(() => renderBag(), 160));
    }
  }
  if (!$("bag-tabs").children.length) {
    [["skills", "✨ مهارت‌ها"], ["items", "🎒 آیتم‌ها"], ["shadows", "🌑 سایه‌ها"], ["gear", "🛡️ تجهیزات"]].forEach(([k, label]) => {
      const b = make(`<button class="b-tab ${k === bagTab ? "active" : ""}" data-bt="${k}">${label}</button>`);
      b.addEventListener("click", () => {
        bagTab = k;
        document.querySelectorAll(".b-tab").forEach((x) => x.classList.toggle("active", x === b));
        renderBag();
      });
      $("bag-tabs").appendChild(b);
    });
  }
  const box = $("bag-body");
  box.innerHTML = "";
  if (bagTab === "skills") renderSkills(box);
  else if (bagTab === "items") renderItems(box);
  else if (bagTab === "shadows") renderShadows(box);
  else renderGear(box);
}

function renderSkills(box) {
  const st = app.getSt();
  box.className = "bag-sec";
  const active = st.equip.active;
  const shown = active.length ? `<div class="chip chip-green" style="margin-bottom:2px">${faNum(active.length)}/${faNum(MAX_ACTIVE_SKILLS)} مهارت فعال</div>` : "";
  box.innerHTML = shown;
  const sq = (($("skill-search") && $("skill-search").value) || "").trim();
  let count = 0;
  for (let i = 0; i < SKILL_COUNT && count < 120; i++) {
    const sk = skillIndex(i);
    const unlocked = skillUnlocked(st, i);
    const equipped = active.includes(i);
    if (sq && !(`${sk.name} ${sk.desc} ${sk.type?.name || ""}`).includes(sq)) continue;
    if (!sq && !unlocked && i > 40) continue;
    if (!sq && !unlocked && !meetsReq(st, sk.req) && i > 12) continue;
    count++;
    const card = make(`<div class="skill-card ${unlocked ? "" : "locked"} ${equipped ? "equipped" : ""}">
      <div class="skill-ico tex" style="background-image:url('${sk.tex || ""}')">${sk.icon}</div>
      <div class="skill-info">
        <div class="skill-name">${esc(sk.name)} <span class="chip ${sk.passive ? "chip-blue" : "chip-purple"}">${sk.passive ? "پسیو" : "اکتیو"}</span> ${equipped ? `<span class="chip chip-green">فعال</span>` : ""}</div>
        <div class="skill-desc">${esc(sk.desc)} ${sk.passive ? "" : `· شارژ ${dur(sk.cd)}`}</div>
        ${unlocked ? `<div class="skill-req">${sk.rank.name}</div>` : `<div class="skill-req">🔒 برای باز شدن: ${esc(sk.req.label)} + طلا</div>`}
      </div>
      ${unlocked
        ? `<button class="toggle ${equipped ? "on" : ""}" data-tog="${i}" aria-label="فعال/غیرفعال"></button>`
        : `<button class="btn btn-ghost btn-sm" data-unlock="${i}">باز کردن</button>`}
    </div>`);
    card.querySelector("[data-tog]")?.addEventListener("click", () => {
      const r = toggleSkill(app.getSt(), i);
      if (r.error) return toast(r.error, "bad");
      toast(r.on ? `«${sk.name}» فعال شد` : `«${sk.name}» غیرفعال شد`, r.on ? "good" : "info");
      sfx.skill();
      app.save(); renderBag();
    });
    card.querySelector("[data-unlock]")?.addEventListener("click", () => {
      const r = unlockSkill(app.getSt(), i);
      if (r.error) return toast(r.error, "bad");
      toast(`مهارت «${sk.name}» باز شد!`, "good");
      sfx.levelup();
      app.save(); renderBag();
    });
    box.appendChild(card);
  }
}

function renderItems(box) {
  const st = app.getSt();
  box.className = "bag-sec";
  const entries = Object.entries(st.items || {});
  if (!entries.length) { box.innerHTML = "<p>کیفت خالی است — از فروشگاه بخر یا جایزه بگیر.</p>"; return; }
  box.innerHTML = "";
  entries.forEach(([id, count]) => {
    const it = itemById(Number(id));
    if (!it) return;
    const isWeapon = it.effects.type === "weapon";
    const isArmor = it.effects.type === "armor";
    const isTitle = it.effects.pow != null && it.cat === "title";
    const equippedW = st.equip.weapon === it.id;
    const equippedA = st.equip.armor === it.id;
    const equippedT = st.equip.titleItem === it.id;
    const fx = it.effects;
    const usable = fx.energy != null || fx.xp != null || fx.gold != null || fx.protect != null || fx.box != null || fx.rerollShop != null || fx.punishShield != null || fx.fullEnergy != null || fx.duelTicket != null || fx.rage != null || fx.haste != null || fx.focus != null || fx.luck != null || fx.def != null || fx.atk != null || fx.vamp != null || fx.regen != null || fx.greed != null || fx.shadow != null || fx.yearBoost != null || fx.chatColor != null || fx.sysBell != null || fx.secretKey != null || fx.statPts != null || fx.shadowFood != null;
    const row = make(`<div class="inv-item">
      <div class="item-ico tex" style="background-image:url('${it.tex || texUrl("item", it.id)}')">${it.icon}</div>
      <div class="skill-info">
        <div class="skill-name">${esc(it.name)} ×${faNum(count)} ${equippedW || equippedA || equippedT ? `<span class="chip chip-green">مجهر</span>` : ""}</div>
        <div class="skill-desc">${esc(it.desc)}</div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${usable ? `<button class="btn btn-primary btn-sm" data-use="${it.id}">استفاده</button>` : ""}
        ${isWeapon ? `<button class="btn ${equippedW ? "btn-ghost" : "btn-green"} btn-sm" data-eqw="${it.id}">${equippedW ? "برداشتن" : "تجهیز"}</button>` : ""}
        ${isArmor ? `<button class="btn ${equippedA ? "btn-ghost" : "btn-green"} btn-sm" data-eqa="${it.id}">${equippedA ? "برداشتن" : "تجهیز"}</button>` : ""}
        ${isTitle ? `<button class="btn ${equippedT ? "btn-ghost" : "btn-green"} btn-sm" data-eqt="${it.id}">${equippedT ? "برداشتن" : "تجهیز"}</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-sell="${it.id}">فروش</button>
      </div>
    </div>`);
    row.querySelector("[data-use]")?.addEventListener("click", () => {
      const r = useItem(app.getSt(), it.id);
      if (r.error) return toast(r.error, "bad");
      toast(r.msg || "استفاده شد", "good"); sfx.buy();
      app.save(); renderTopbar(); renderBag();
    });
    row.querySelector("[data-eqw]")?.addEventListener("click", () => {
      const r = equipWeapon(app.getSt(), equippedW ? null : it.id);
      if (r.error) return toast(r.error, "bad");
      app.save(); renderTopbar(); renderBag();
    });
    row.querySelector("[data-eqa]")?.addEventListener("click", () => {
      const r = equipArmor(app.getSt(), equippedA ? null : it.id);
      if (r.error) return toast(r.error, "bad");
      app.save(); renderTopbar(); renderBag();
    });
    row.querySelector("[data-eqt]")?.addEventListener("click", () => {
      const r = equipTitle(app.getSt(), equippedT ? null : it.id);
      if (r.error) return toast(r.error, "bad");
      app.save(); renderTopbar(); renderBag();
    });
    row.querySelector("[data-sell]")?.addEventListener("click", () => {
      modal({
        title: "فروش آیتم",
        body: `<p>«${esc(it.name)}» فروخته شود؟</p>`,
        actions: [
          { label: "بله، بفروش", cls: "btn-primary", cb() {
            const r = sellItem(app.getSt(), it.id, 1);
            if (r.error) return toast(r.error, "bad");
            toast("فروخته شد", "info"); sfx.coin();
            app.save(); renderTopbar(); renderBag();
          } },
          { label: "انصراف", cb() {} },
        ]
      });
    });
    box.appendChild(row);
  });
}

function renderShadows(box) {
  const st = app.getSt();
  box.className = "bag-sec";
  const entries = Object.values(st.shadows || {});
  const active = st.equip.shadows;
  box.innerHTML = `<div class="chip chip-purple" style="margin-bottom:2px">${faNum(active.length)}/۳ سایهٔ همراه — ارتقا و ترکیب قدرت می‌دهد</div>`;
  if (!entries.length) { box.innerHTML += "<p>هنوز سایه‌ای نداری. باس‌ها را بکش و با «برخاستن!» روحشان را بگیر.</p>"; return; }
  entries.forEach((sh) => {
    const on = active.includes(sh.id);
    const lv = sh.lv || 1;
    const card = make(`<div class="shadow-card ${on ? "assigned" : ""}">
      <div class="item-ico" style="font-size:22px">${sh.emoji}</div>
      <div class="skill-info">
        <div class="skill-name">${esc(sh.name)} <span class="chip chip-blue">Lv ${faNum(lv)}</span></div>
        <div class="skill-desc">قدرت: ${fmtNum(sh.power)} · رتبهٔ ${esc(sh.rank)} · ${timeAgo(sh.created)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="btn ${on ? "btn-ghost" : "btn-green"} btn-sm" data-sh="${sh.id}">${on ? "برگردان" : "همراه کن"}</button>
        <button class="btn btn-gold btn-sm" data-up="${sh.id}">ارتقاء</button>
      </div>
    </div>`);
    card.querySelector("[data-sh]").addEventListener("click", () => {
      const r = assignShadow(app.getSt(), sh.id, !on);
      if (r.error) return toast(r.error, "bad");
      toast(on ? "سایه برگشت" : "سایه همراهت شد", "good"); sfx.arise();
      app.save(); renderTopbar(); renderBag();
    });
    card.querySelector("[data-up]").addEventListener("click", () => {
      const r = upgradeShadow(app.getSt(), sh.id);
      if (r.error) return toast(r.error, "bad");
      toast(`سایه سطح ${faNum(r.sh.lv)} شد (+قدرت)`, "gold");
      sfx.levelup(); app.save(); renderTopbar(); renderBag();
    });
    box.appendChild(card);
  });
  if (entries.length >= 2) {
    const fuseBtn = make(`<button class="btn btn-primary btn-sm" style="margin-top:6px">ترکیب دو سایه (ضعیف در قوی حل می‌شود)</button>`);
    fuseBtn.addEventListener("click", () => {
      const list = Object.values(app.getSt().shadows || {}).sort((a, b) => b.power - a.power);
      if (list.length < 2) return toast("حداقل دو سایه لازم است", "bad");
      const r = fuseShadows(app.getSt(), list[0].id, list[list.length - 1].id);
      if (r.error) return toast(r.error, "bad");
      toast(`ترکیب شد! قدرت جدید ${fmtNum(r.sh.power)}`, "gold");
      sfx.arise(); app.save(); renderTopbar(); renderBag();
    });
    box.appendChild(fuseBtn);
  }
}

function renderGear(box) {
  const st = app.getSt();
  const cs = combatStats(st);
  box.className = "bag-sec";
  const w = itemById(st.equip.weapon);
  const a = itemById(st.equip.armor);
  const t = itemById(st.equip.titleItem);
  const pts = st.statPts || 0;
  const sp = st.spent || { hp: 0, atk: 0, def: 0, crit: 0 };
  box.innerHTML = `
    <div class="card" style="margin:0"><div class="card-body">
      <div class="m-meta"><span>جان: <b>${fmtNum(cs.hp)}</b></span><span>حمله: <b>${fmtNum(cs.atk)}</b></span><span>دفاع: <b>${fmtNum(cs.def)}</b></span></div>
      <div class="m-meta"><span>کریت: <b>${faNum(Math.floor(cs.crit))}٪</b></span><span>جاخالی: <b>${faNum(Math.floor(cs.dodge))}٪</b></span><span>قدرت کل: <b>${fmtNum(computePower(st))}</b></span></div>
      <div class="m-meta"><span>XP+: <b>${faNum(Math.floor((cs.xpMult - 1) * 100))}٪</b></span><span>طلا+: <b>${faNum(Math.floor((cs.goldMult - 1) * 100))}٪</b></span><span>سایه+: <b>${faNum(Math.floor((cs.extractMult - 1) * 100))}٪</b></span></div>
    </div></div>
    <div class="card" style="margin:0"><div class="card-head"><h3>امتیاز آمار</h3><span class="chip chip-gold">${faNum(pts)} مانده</span></div>
    <div class="card-body">
      <div class="m-meta"><span>جان (${faNum(sp.hp || 0)})</span><button class="btn btn-sm btn-primary" data-st="hp">+۱</button></div>
      <div class="m-meta"><span>حمله (${faNum(sp.atk || 0)})</span><button class="btn btn-sm btn-primary" data-st="atk">+۱</button></div>
      <div class="m-meta"><span>دفاع (${faNum(sp.def || 0)})</span><button class="btn btn-sm btn-primary" data-st="def">+۱</button></div>
      <div class="m-meta"><span>کریت (${faNum(sp.crit || 0)})</span><button class="btn btn-sm btn-primary" data-st="crit">+۱</button></div>
    </div></div>
    <div class="card" style="margin:0"><div class="card-head"><h3>تجهیزات فعلی</h3></div><div class="card-body">
      <div class="m-meta"><span>سلاح: <b>${w ? esc(w.name) : "—"}</b></span></div>
      <div class="m-meta"><span>زره: <b>${a ? esc(a.name) : "—"}</b></span></div>
      <div class="m-meta"><span>عنوان: <b>${t ? esc(t.name) : "—"}</b></span></div>
      <div class="m-meta"><span>سایه‌های همراه: <b>${faNum(st.equip.shadows.length)}/۳</b></span></div>
    </div></div>`;
  box.querySelectorAll("[data-st]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = spendStat(app.getSt(), btn.dataset.st);
      if (r.error) return toast(r.error, "bad");
      toast("آمار تقویت شد", "good"); sfx.skill();
      app.save(); renderTopbar(); renderBag();
    });
  });
}

/* ================= رقابت ================= */
let queueMode = null;
let queueBusy = false;
export function renderDuelTab() {
  const st = app.getSt();
  refreshOnlineList();
  refreshOpenDuels();
  renderDuelHistory();
  refreshFfaList();
  $("queue-status").textContent = queueBusy ? "در انتظار حریف واقعی..." : "آمادهٔ مبارزه";
  $("btn-queue").disabled = queueBusy;
}
let onlinePoll = null;
function refreshOnlineList() {
  clearInterval(onlinePoll);
  const load = async () => {
    if (currentPage !== "duel") { clearInterval(onlinePoll); onlinePoll = null; return; }
    const r = await cloud.onlinePlayers();
    const st = app.getSt();
    const box = $("online-list");
    box.innerHTML = "";
    if (r.error || !r.list || !r.list.length) {
      box.innerHTML = `<p style="text-align:center;color:var(--txt3);padding:8px">فعلاً کسی آنلاین نیست${r.error ? " — اتصال ابری برقرار نشد" : ""}. نفر اولِ بعد از تو، حریفت می‌شود.</p>`;
      $("online-count").textContent = "۰ آنلاین";
      return;
    }
    $("online-count").textContent = `${faNum(r.list.length)} آنلاین`;
    onlineCache = {};
    r.list.slice(0, 30).forEach((p) => {
      onlineCache[p.user_id] = p;
      const row = make(`<div class="player-row">
        <div class="avatar" style="width:32px;height:32px;font-size:13px">${esc((p.username || "؟").charAt(0).toUpperCase())}</div>
        <div class="skill-info">
          <div class="p-name">${esc(p.username)} ${nameTagHtml(p.level)} <span class="chip chip-blue">${esc(p.hunter_class || "")}</span></div>
          <div class="p-sub">سطح ${faNum(p.level)} · قدرت ${fmtNum(p.power)}</div>
        </div>
        <button class="btn btn-red btn-sm" data-ch="${esc(p.username)}" data-chid="${p.user_id}">چالش!</button>
        <button class="btn btn-ghost btn-sm" data-dm="${esc(p.username)}" data-dmid="${p.user_id}">💬</button>
      </div>`);
      row.querySelector("[data-ch]").addEventListener("click", () => challengePlayer(p.user_id, p.username));
      row.querySelector("[data-fr]")?.addEventListener("click", () => addFriendByName(p.username));
      row.querySelector("[data-dm]").addEventListener("click", () => openDM(p.user_id, p.username));
      box.appendChild(row);
    });
  };
  load();
  onlinePoll = setInterval(load, 5000);
}

async function challengePlayer(oppId, oppName) {
  const st = app.getSt();
  if (!app.isLoggedIn()) return toast("برای رقابت آنلاین باید وارد شوی", "bad");
  if (oppId === app.myUserId()) return toast("با خودت نمی‌توانی بجنگی!", "bad");
  const mode = await pickDuelMode();
  if (!mode) return;
  const r = await cloud.createDuel(app.myUserId(), st.username, mode);
  if (r.error) return toast("ساخت مبارزه ناموفق بود — دیتابیس را چک کن", "bad");
  const duel = r.duel;
  await cloud.updateDuel(duel.id, { p2: oppId, p2name: oppName, status: "challenged" });
  cloud.broadcastMatch({ type: "challenge", duelId: duel.id, p1: app.myUserId(), p2: oppId, p1name: st.username, p2name: oppName, mode });
  toast(`چالش برای ${oppName} فرستاده شد — منتظر جواب بمان`, "info", 3500);
  addEvent("چالش فرستاده شد", `منتظر پاسخ ${oppName} هستی`, "info");
}
function pickDuelMode() {
  return new Promise((resolve) => {
    modal({
      title: "نوع مبارزه را انتخاب کن",
      body: `<div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-big" id="dm-shooter">🔫 مبارزهٔ شوتر دوبعدی (واقعی — همزمان با حریف)</button>
        <button class="btn btn-gold btn-big" id="dm-click">👊 مسابقهٔ کلیکی (۳۰ ثانیه)</button>
      </div>`,
      actions: [{ label: "انصراف", cb() { resolve(null); } }]
    });
    $("dm-shooter").onclick = () => { closeModal(); resolve("shooter"); };
    $("dm-click").onclick = () => { closeModal(); resolve("click"); };
  });
}

function refreshOpenDuels() {
  const box = $("open-duels");
  box.innerHTML = "<p style='text-align:center;color:var(--txt3);padding:6px'>چالش‌های دریافتی اینجا ظاهر می‌شوند...</p>";
  cloud.openDuels().then((r) => {
    if (r.error || !r.list || !r.list.length) return;
    const mine = r.list.filter((d) => d.p2 === app.myUserId() && (d.status === "open" || d.status === "challenged"));
    if (!mine.length) { box.innerHTML = "<p style='text-align:center;color:var(--txt3);padding:6px'>چالش دریافت‌شده‌ای نداری.</p>"; return; }
    box.innerHTML = "";
    mine.forEach((d) => {
      const row = make(`<div class="player-row">
        <div class="skill-info"><div class="p-name">${esc(d.p1name)} تو را به مبارزه می‌طلبد!</div>
        <div class="p-sub">حالت: ${d.mode === "shooter" ? "شوتر دوبعدی" : "مسابقهٔ کلیکی"}</div></div>
        <button class="btn btn-green btn-sm" data-accept="${d.id}">قبول!</button>
        <button class="btn btn-ghost btn-sm" data-reject="${d.id}">رد</button>
      </div>`);
      row.querySelector("[data-accept]").addEventListener("click", () => acceptDuel(d));
      row.querySelector("[data-reject]").addEventListener("click", () => {
        cloud.updateDuel(d.id, { status: "declined" });
        refreshOpenDuels();
      });
      box.appendChild(row);
    });
  });
}
async function acceptDuel(d) {
  const st = app.getSt();
  await cloud.updateDuel(d.id, { status: "starting", result: { acceptedAt: nowMs() } });
  cloud.broadcastMatch({ type: "accepted", duelId: d.id, p1: d.p1, p2: d.p2, mode: d.mode });
  const me = { id: d.p2, name: st.username, level: st.level, power: computePower(st) };
  const opp = { id: d.p1, name: d.p1name, level: 1, power: 100 };
  startDuelSession(d.id, d.mode, false, me, opp, d);
}

$("btn-queue").addEventListener("click", async () => {
  const st = app.getSt();
  if (!app.isLoggedIn()) return toast("برای رقابت آنلاین باید ثبت‌نام کنی", "bad");
  if (queueBusy) return;
  const mode = await pickDuelMode();
  if (!mode) return;
  queueBusy = true;
  $("btn-queue").disabled = true;
  $("queue-status").textContent = "در انتظار حریف واقعی...";
  toast("داری دنبال حریف می‌گردی... اگر کسی آنلاین نباشد باید صبر کنی", "info", 4200);
  addEvent("صف رقابت", "به صف یافتن حریف پیوستی", "info");
  // پیدا کردن حریف از لیست آنلاین
  let tries = 0;
  const finder = setInterval(async () => {
    tries++;
    const r = await cloud.onlinePlayers();
    if (r.list && r.list.length) {
      const opp = r.list[Math.floor(Math.random() * Math.min(r.list.length, 3))];
      if (opp && opp.user_id !== app.myUserId()) {
        clearInterval(finder);
        const d = await cloud.createDuel(app.myUserId(), st.username, mode);
        if (d.duel) {
          await cloud.updateDuel(d.duel.id, { p2: opp.user_id, p2name: opp.username, status: "challenged" });
          cloud.broadcastMatch({ type: "challenge", duelId: d.duel.id, p1: app.myUserId(), p2: opp.user_id, p1name: st.username, p2name: opp.username, mode });
          toast(`حریف پیدا شد: ${opp.username} — چالش فرستاده شد!`, "good", 4000);
        }
        queueBusy = false; $("btn-queue").disabled = false;
        $("queue-status").textContent = "آمادهٔ مبارزه";
        return;
      }
    }
    if (tries > 40) {
      clearInterval(finder);
      queueBusy = false; $("btn-queue").disabled = false;
      $("queue-status").textContent = "حریفی پیدا نشد";
      toast("الان کسی آنلاین نیست. بعداً امتحان کن — هیچ رباتی وجود ندارد!", "info", 4200);
      addEvent("صف رقابت", "حریفی آنلاین پیدا نشد — دوباره امتحان کن", "info");
    }
  }, 2500);
});

/* ---------- جلسهٔ دوئل ---------- */
let activeDuel = null;
function startDuelSession(duelId, mode, isHost, me, opp, duelRow) {
  activeDuel = { duelId, mode, isHost, me, opp };
  const send = (event, payload) => cloud.broadcastDuel(duelId, event, payload);
  cloud.onDuelBroadcast(duelId, (event, payload) => {
    if (!activeDuel) return;
    if (mode === "shooter") {
      if (event === "state") shooterRemoteState(payload);
      else if (event === "bullet") shooterRemoteBullet(payload);
      else if (event === "powerup") shooterRemotePowerup(payload);
      else if (event === "end") shooterRemoteEnd(payload);
    } else if (mode === "click") {
      if (event === "clicks") clickDuelRemote(payload.n);
      else if (event === "end") clickDuelRemoteEnd(payload);
    }
  });
  const onEnd = async (res) => {
    activeDuel = null;
    const st = app.getSt();
    st.stats.duels = (st.stats.duels || 0) + 1;
    const oppName = me.id === duelRow?.p1 ? (duelRow?.p2name || opp.name) : (duelRow?.p1name || opp.name);
    st.duelLog = st.duelLog || [];
    st.duelLog.unshift({ opp: oppName, won: res.won, mode, ts: nowMs() });
    if (st.duelLog.length > 30) st.duelLog.length = 30;
    if (res.won) {
      st.stats.wins++;
      applyProgress(st, "duels", 1);
      addRankPts(st, 18 + Math.floor(st.level / 5));
      const g = 100 + st.level * 35;
      gainGold(st, g);
      addXP(st, 300 + st.level * 60);
      toast(`🏆 پیروزی! +${fmtNum(g)} طلا و XP`, "gold", 4000);
      sfx.win(); confetti();
      addEvent("پیروزی در رقابت", `حریف ${me.name === duelRow?.p1name ? duelRow?.p2name : duelRow?.p1name || opp.name} را شکست دادی`, "good");
    } else {
      st.stats.losses++;
      addRankPts(st, -10);
      const loss = Math.min(st.gold, 40 + st.level * 8);
      st.gold -= loss;
      toast(`شکست خوردی... ${fmtNum(loss)} طلا از دست دادی. دفعهٔ بعد انتقام بگیر!`, "bad", 4000);
      sfx.lose();
      addEvent("شکست در رقابت", `به ${opp.name} باختی — قوی‌تر برگرد`, "bad");
    }
    app.save();
    renderTopbar();
    // ثبت نتیجه در ابر
    try {
      await cloud.updateDuel(duelId, {
        status: "done",
        result: { winner: res.won ? me.id : opp.id, mode, scores: { [me.id]: res.meClicks ?? res.meHp, [opp.id]: res.oppClicks ?? res.oppHp }, forfeit: !!res.forfeit, finishedAt: nowMs() }
      });
    } catch (e) {}
    cloud.closeDuelChannel(duelId);
    if (currentPage === "duel") renderDuelTab();
  };
  if (mode === "shooter") {
    openShooterDuel({ duelId, me, opp, isHost, send, onEnd, localTest: false });
  } else {
    openClickDuel({ duelId, me, opp, isHost, send, onEnd });
  }
}

function renderDuelHistory() {
  const st = app.getSt();
  const box = $("duel-history");
  box.innerHTML = "";
  const h = (st.duelLog || []).slice(0, 12);
  if (!h.length) { box.innerHTML = "<p>هنوز مبارزه‌ای نداشتی.</p>"; return; }
  h.forEach((e) => {
    box.appendChild(make(`<div class="duel-history-item ${e.won ? "win" : "loss"}"><div><b>${e.won ? "برد" : "باخت"}</b> در برابر ${esc(e.opp)} (${e.mode === "shooter" ? "شوتر" : e.mode === "ffa" ? "FFA" : "کلیکی"})</div><span>${timeAgo(e.ts)}</span></div>`));
  });
}

function localFriends() { return lsGet("friends") || { req: [], list: [] }; }
function saveLocalFriends(db) { lsSet("friends", db); }
async function addFriendByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return toast("نام کاربری را بنویس", "bad");
  if (app.isLoggedIn() && app.isCloud && app.isCloud()) {
    const r = await cloud.friendRequest(n);
    if (r.error) return toast(r.error, "bad");
    toast("درخواست دوستی فرستاده شد", "good");
    addEvent("درخواست دوستی", n, "info");
    return;
  }
  const db = localFriends();
  if (!db.list.includes(n) && !db.req.includes(n)) db.req.push(n);
  if (!db.list.includes(n)) db.list.push(n);
  saveLocalFriends(db);
  toast("دوست روی این دستگاه ذخیره شد — با ابر همگام می‌شود", "info");
  renderFriends();
}
async function renderFriends() {
  const box = $("friend-list");
  if (!box) return;
  box.innerHTML = "";
  let list = [];
  if (app.isLoggedIn() && app.isCloud && app.isCloud()) {
    const r = await cloud.friendList();
    if (r.list) list = r.list;
  }
  if (!list.length) {
    const loc = localFriends();
    list = (loc.list || []).map((u) => ({ username: u, status: "local" }));
  }
  if (!list.length) {
    box.innerHTML = `<p style="font-size:9px;color:var(--txt3);text-align:center">دوستی نداری</p>`;
    return;
  }
  list.slice(0, 20).forEach((p) => {
    const b = make(`<button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px">${esc(p.username)}</button>`);
    b.addEventListener("click", () => {
      modal({
        title: p.username,
        body: `<p>دوستت را به FFA دعوت کن یا پیام بده.</p>`,
        actions: [
          { label: "دعوت FFA", cls: "btn-gold", cb() {
            modal({
              title: "کد لابی FFA",
              body: `<label class="field"><span>کد ۶ حرفی</span><input id="inv-code" maxlength="8"></label>`,
              actions: [
                { label: "ارسال دعوت", cls: "btn-primary", cb() {
                  const c = $("inv-code")?.value.trim();
                  if (c) cloud.ffaInvite(c, p.username).then((r) => toast(r.error || "دعوت فرستاده شد", r.error ? "bad" : "good"));
                } },
                { label: "انصراف", cb() {} }
              ]
            });
          } },
          { label: "پیام", cb() { openDM(p.user_id || p.username, p.username); } },
          { label: "بستن", cb() {} }
        ]
      });
    });
    box.appendChild(b);
  });
}
async function refreshFfaList() {
  const box = $("ffa-list");
  if (!box) return;
  const r = await cloud.ffaList();
  if (r.error || !r.list || !r.list.length) {
    box.innerHTML = `<p style="text-align:center;color:var(--txt3);padding:8px">لابی باز نیست. «FFA تا ۱۰۰ نفر» را بزن یا با کد وارد شو.</p>`;
    if ($("ffa-count")) $("ffa-count").textContent = "۰ لابی";
    return;
  }
  if ($("ffa-count")) $("ffa-count").textContent = `${faNum(r.list.length)} لابی`;
  box.innerHTML = "";
  r.list.forEach((room) => {
    const row = make(`<div class="player-row">
      <div class="skill-info"><div class="p-name">${esc(room.name)} <span class="chip chip-blue">${esc(room.code)}</span></div>
      <div class="p-sub">${faNum(room.count || 0)}/${faNum(room.max_players || 100)} نفر</div></div>
      <button class="btn btn-primary btn-sm" data-join="${esc(room.code)}">ورود</button>
    </div>`);
    row.querySelector("[data-join]").addEventListener("click", () => joinFfa(room.code));
    box.appendChild(row);
  });
}
async function createFfaLobby() {
  const st = app.getSt();
  if (!app.isLoggedIn()) return toast("برای FFA باید وارد شوی", "bad");
  const r = await cloud.ffaCreate((st.username || "FFA") + " lobby");
  if (r.error) return toast(r.error, "bad");
  toast(`لابی ساخته شد — کد ${r.code}`, "gold", 5000);
  addEvent("لابی FFA", `کد: ${r.code}`, "good");
  startFfaSession(r.code, r.id, true);
}
async function joinFfa(code) {
  if (!app.isLoggedIn()) return toast("برای FFA باید وارد شوی", "bad");
  const r = await cloud.ffaJoin(code);
  if (r.error) return toast(r.error, "bad");
  toast(`وارد لابی ${r.code} شدی`, "good");
  startFfaSession(r.code, r.id, false);
}
function startFfaSession(code, id, isHost) {
  const st = app.getSt();
  const me = { id: app.myUserId(), name: st.username, level: st.level, power: computePower(st) };
  const send = (event, payload) => cloud.broadcastFfa(code, event, payload);
  cloud.onFfaBroadcast(code, (event, payload) => {
    if (event === "state") shooterRemoteState({ ...payload, ffa: true });
    else if (event === "bullet") shooterRemoteBullet(payload);
    else if (event === "end") shooterRemoteEnd(payload);
  });
  openFfaArena({
    code, id, me, isHost, send,
    onEnd: (res) => {
      st.stats.duels = (st.stats.duels || 0) + 1;
      st.duelLog = st.duelLog || [];
      st.duelLog.unshift({ opp: "FFA " + code, won: !!res.won, mode: "ffa", ts: nowMs() });
      if (res.won) { st.stats.wins++; addRankPts(st, 22); gainGold(st, 140 + st.level * 20); addXP(st, 400); toast("برنده FFA شدی!", "gold"); }
      else { st.stats.losses++; toast("از FFA خارج شدی", "info"); }
      app.save(); renderTopbar();
      if (currentPage === "duel") renderDuelTab();
    }
  });
}
$("btn-ffa")?.addEventListener("click", () => {
  modal({
    title: "نبرد آزاد تا ۱۰۰ بازیکن",
    body: `<p>لابی بساز و دوستان را دعوت کن، یا با کد وارد شو. مبارزه شوتر مثل کانتر است.</p>
      <label class="field"><span>کد لابی (اگر داری)</span><input id="ffa-code" maxlength="8" placeholder="ABC123"></label>`,
    actions: [
      { label: "ساخت لابی", cls: "btn-gold", cb() { createFfaLobby(); } },
      { label: "ورود با کد", cls: "btn-primary", cb() { const c = $("ffa-code")?.value.trim(); if (c) joinFfa(c); else toast("کد را بنویس", "bad"); } },
      { label: "انصراف", cb() {} }
    ]
  });
});
$("btn-add-friend")?.addEventListener("click", () => {
  modal({
    title: "افزودن دوست",
    body: `<label class="field"><span>نام کاربری انگلیسی</span><input id="fr-name" maxlength="20" placeholder="arsham"></label>`,
    actions: [
      { label: "ارسال درخواست", cls: "btn-primary", cb() { addFriendByName($("fr-name")?.value); } },
      { label: "انصراف", cb() {} }
    ]
  });
});

/* ---------- پیام خصوصی ---------- */
function openDM(uid, uname) {
  const st = app.getSt();
  st.dms = st.dms || {};
  st.dms[uid] = st.dms[uid] || [];
  const msgs = st.dms[uid].slice(-30).map((m) => `<div class="msg ${m.from === app.myUserId() ? "mine" : "other"}"><span class="m-user">${m.from === app.myUserId() ? "تو" : esc(uname)}</span>${esc(m.text)}<span class="m-time">${timeAgo(m.ts)}</span></div>`).join("");
  modal({
    title: `گفتگوی خصوصی با ${uname}`,
    body: `<div class="chat-msgs" id="dm-msgs" style="height:220px;border:1px solid var(--card-border);border-radius:10px;background:rgba(0,0,0,.25)">${msgs || "<p>هنوز پیامی نیست.</p>"}</div>
      <div class="chat-input" style="padding:8px 0 0;border:none"><input id="dm-text" placeholder="پیامت را بنویس..."><button class="btn btn-primary btn-sm" id="dm-send">ارسال</button></div>`,
    actions: [{ label: "بستن", cb() {} }]
  });
  const sendDm = () => {
    const inp = $("dm-text");
    const txt = inp.value.trim();
    if (!txt) return;
    const msg = { from: app.myUserId(), text: txt, ts: nowMs() };
    st.dms[uid].push(msg);
    cloud.broadcastDM(uid, msg);
    app.save();
    inp.value = "";
    const box = $("dm-msgs");
    box.appendChild(make(`<div class="msg mine"><span class="m-user">تو</span>${esc(txt)}<span class="m-time">همین الان</span></div>`));
    box.scrollTop = box.scrollHeight;
    sfx.msg();
  };
  $("dm-send").onclick = sendDm;
  $("dm-text").addEventListener("keydown", (e) => { if (e.key === "Enter") sendDm(); });
  // دریافت زنده در همین مودال
  const off = cloud.listenDM(app.myUserId(), (payload) => {
    const box = $("dm-msgs");
    if (!box) { off(); return; }
    st.dms[uid].push({ from: uid, text: payload.text, ts: nowMs() });
    app.save();
    box.appendChild(make(`<div class="msg other"><span class="m-user">${esc(uname)}</span>${esc(payload.text)}<span class="m-time">همین الان</span></div>`));
    box.scrollTop = box.scrollHeight;
    sfx.msg();
  });
}

/* ================= چت ================= */
let chatRoom = "عمومی";
let recording = null;
let recorder = null;
let voicePushActive = false;

const roomsHooked = new Set();
export function renderChat() {
  $("chat-room-title").textContent = chatRoom;
  document.querySelectorAll(".room-btn").forEach((b) => b.classList.toggle("active", b.dataset.room === chatRoom));
  loadChatHistory();
  cloud.subscribeRoom(chatRoom);
  if (!roomsHooked.has(chatRoom)) {
    roomsHooked.add(chatRoom);
    const room = chatRoom;
    cloud.onRoomBroadcast(room, (msg) => {
      if (chatRoom !== room) return;
      if (msg.local || msg.userId === app.myUserId()) return;
      appendChatMsg(msg);
      sfx.msg();
      notifyLocal("پیام جدید", `${msg.username}: ${(msg.body || "").slice(0, 60)}`);
    });
    cloud.onVoiceBroadcast(room, (v) => { if (chatRoom === room) handleVoiceChunk(v); });
  }
  refreshGroups();
  renderFriends();
}
function loadChatHistory() {
  const box = $("chat-msgs");
  box.innerHTML = `<p style="text-align:center;color:var(--txt3)">در حال بارگذاری پیام‌ها...</p>`;
  cloud.loadHistory(chatRoom).then((r) => {
    box.innerHTML = "";
    if (r.error) { box.innerHTML = `<p style="text-align:center;color:var(--txt3)">${r.error.code === "PGRST205" ? "دیتابیس نصب نشده — چت ذخیره نمی‌شود" : "پیام‌ها در دسترس نیستند"}</p>`; return; }
    if (!r.list || !r.list.length) { box.innerHTML = `<p style="text-align:center;color:var(--txt3)">اولین نفر باش که پیام می‌فرستد!</p>`; return; }
    r.list.forEach(appendChatMsg);
    box.scrollTop = box.scrollHeight;
  });
}
function appendChatMsg(m) {
  const box = $("chat-msgs");
  if (!box) return;
  const mine = m.userId === app.myUserId() || m.user_id === app.myUserId();
  const msg = make(`<div class="msg ${m.kind === "system" ? "system" : mine ? "mine" : "other"}">
    ${m.kind !== "system" ? `<span class="m-user">${mine ? "تو" : esc(m.username || "؟")} ${nameTagHtml((mine && app.getSt() ? app.getSt().level : m.level) || 1)}</span>` : ""}
    ${m.kind === "voice" ? `<audio controls src="${esc(m.body)}"></audio>` : esc(m.body || "")}
    <span class="m-time">${timeAgo(m.created_at || m.ts)}</span>
  </div>`);
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}
document.querySelectorAll(".room-btn").forEach((b) => b.addEventListener("click", () => {
  chatRoom = b.dataset.room;
  renderChat();
}));
async function refreshGroups() {
  const r = await cloud.listRooms();
  const box = $("chat-groups");
  box.innerHTML = "";
  if (r.list && r.list.length) {
    r.list.forEach((rm) => {
      const b = make(`<button class="room-btn" data-room="${esc(rm.name)}">${esc(rm.name)}</button>`);
      b.addEventListener("click", () => {
        cloud.joinRoom(rm.id).then(() => {
          chatRoom = rm.name;
          document.querySelectorAll(".room-btn").forEach((x) => x.classList.toggle("active", x.dataset.room === chatRoom));
          renderChat();
        });
      });
      box.appendChild(b);
    });
  }
}
$("btn-new-group").addEventListener("click", () => {
  modal({
    title: "ساخت گروه جدید",
    body: `<label class="field"><span>نام گروه (برای همه قابل مشاهده)</span><input id="grp-name" maxlength="40" placeholder="مثلا: ارتش سایه‌ها"></label>`,
    actions: [
      { label: "ساخت گروه", cls: "btn-primary", cb() {
        const name = $("grp-name").value.trim();
        if (!name) return toast("نام را بنویس", "bad");
        cloud.createRoom(name).then((r) => {
          if (r.error) return toast(r.error, "bad");
          toast(`گروه «${name}» ساخته شد!`, "good");
          chatRoom = name;
          renderChat();
        });
      } },
      { label: "انصراف", cb() {} }
    ]
  });
});
function sendChat() {
  const inp = $("chat-text");
  const txt = inp.value.trim();
  if (!txt) return;
  const localOnly = !app.isLoggedIn() || (app.isCloud && !app.isCloud());
  if (localOnly) {
    inp.value = "";
    const msg = { room: chatRoom, username: app.getSt().username, userId: app.myUserId() || "local", body: txt, kind: "text", created_at: nowMs() };
    appendChatMsg(msg);
    applyProgress(app.getSt(), "chat", 1);
    app.save();
    if (!app.isLoggedIn()) toast("آفلاین هستی — پیامت فقط روی همین دستگاه دیده می‌شود", "info", 2600);
    return;
  }
  inp.value = "";
  const st = app.getSt();
  const msg = { room: chatRoom, username: st.username, userId: app.myUserId(), body: txt, kind: "text", created_at: nowMs() };
  appendChatMsg(msg);
  applyProgress(st, "chat", 1);
  st.stats.chatMsgs = (st.stats.chatMsgs || 0) + 1;
  app.save();
  cloud.sendMessage(chatRoom, st.username, app.myUserId(), txt, "text").then((r) => {
    if (!r.ok) toast("پیام ذخیره ابری نشد (حالت موقت)", "bad", 3000);
  });
  sfx.msg();
}
$("btn-send").addEventListener("click", sendChat);
$("chat-text").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
$("btn-emoji").addEventListener("click", () => {
  const p = $("emoji-panel");
  if (!p.children.length) {
    const emojis = ["😀","😂","😍","😎","🥶","🤬","😭","😱","🤯","🥳","😴","🤔","👍","👎","👏","🙏","💪","🔥","⚡","💀","👻","👑","🗡️","🛡️","💰","💎","❤️","💜","🖤","🏆","⚔️","🐉"];
    emojis.forEach((e2) => {
      const b = make(`<button>${e2}</button>`);
      b.addEventListener("click", () => { $("chat-text").value += e2; $("chat-text").focus(); });
      p.appendChild(b);
    });
  }
  p.classList.toggle("hidden");
});
/* پیام صوتی */
$("btn-voice-msg").addEventListener("click", () => {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast("مرورگرت ضبط صدا ندارد", "bad");
  if (recording && recorder && recorder.state === "recording") { recorder.stop(); return; }
  if (recording) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    recording = true;
    $("btn-voice-msg").innerHTML = `<span class="rec-ind"></span>`;
    toast("در حال ضبط... دوباره بزن تا تمام شود", "info", 2000);
    recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      recording = false;
      $("btn-voice-msg").textContent = "🎤";
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size < 500) return toast("خیلی کوتاه بود", "bad");
      toast("در حال آپلود صدا...", "info", 3000);
      const up = await cloud.uploadVoice(blob, "webm");
      const st = app.getSt();
      if (up.url) {
        const msg = { room: chatRoom, username: st.username, userId: app.myUserId(), body: up.url, kind: "voice", created_at: nowMs() };
        appendChatMsg(msg);
        cloud.sendMessage(chatRoom, st.username, app.myUserId(), up.url, "voice");
      } else {
        toast("آپلود صدا ناموفق", "bad");
        cloud.broadcastRoom(chatRoom, { username: st.username, userId: app.myUserId(), kind: "voice", body: "", voiceBlob: blob, ts: nowMs() });
      }
    };
    recorder.start();
    recorder.timer = setTimeout(() => { if (recorder && recorder.state === "recording") recorder.stop(); }, 30000);
  }).catch(() => toast("دسترسی میکروفون رد شد", "bad"));
});
/* صحبت زنده (واکی‌تاکی) */
const pushBtn = $("btn-voice-push");
let pushTimer = null, pushRec = null;
const stopPush = () => {
  if (pushRec && pushRec.state === "recording") pushRec.stop();
  voicePushActive = false;
  $("voice-live").classList.add("hidden");
  cloud.broadcastVoice(chatRoom, { type: "end", username: app.getSt().username });
};
pushBtn.addEventListener("pointerdown", () => {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast("ضبط صدا پشتیبانی نمی‌شود", "bad");
  if (voicePushActive) return stopPush();
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    voicePushActive = true;
    $("voice-live").classList.remove("hidden");
    toast("صحبت کن! (نگه داشته باش)", "good", 1500);
    cloud.broadcastVoice(chatRoom, { type: "start", username: app.getSt().username });
    let idx = 0;
    const makeRec = () => {
      pushRec = new MediaRecorder(stream);
      pushRec.ondataavailable = async (e) => {
        if (e.data.size > 200) {
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf).slice(0, 200000)));
          cloud.broadcastVoice(chatRoom, { type: "chunk", username: app.getSt().username, idx: idx++, data: b64 });
        }
      };
      pushRec.onstop = () => { if (voicePushActive) { pushTimer = setTimeout(makeRec, 60); } };
      pushRec.start();
      pushTimer = setTimeout(() => { if (pushRec.state === "recording") pushRec.stop(); }, 900);
    };
    makeRec();
    pushBtn._stream = stream;
  }).catch(() => toast("دسترسی میکروفون رد شد", "bad"));
});
pushBtn.addEventListener("pointerup", stopPush);
pushBtn.addEventListener("pointerleave", stopPush);

let voiceChunkQueue = {};
let voiceChunkTimer = {};
function handleVoiceChunk(v) {
  const st = app.getSt();
  if (v.type === "start") { toast(`🔊 ${esc(v.username)} دارد صحبت می‌کند...`, "info", 2000); return; }
  if (v.type === "chunk") {
    // هر تکه یک فایل مستقل وب‌ام است → پخش فوری
    try {
      const bin = atob(v.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/webm" }));
      const audio = new Audio(url);
      audio.play().catch(() => {});
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {}
    return;
  }
  if (v.type === "end") { toast(`🔇 ${esc(v.username)} دیگر صحبت نمی‌کند`, "info", 1500); }
}

/* ================= رنک ================= */
let rankKind = "power";
export function renderRanks() {
  const st = app.getSt();
  if (!$("rank-tabs").children.length) {
    [["power", "قدرت"], ["level", "سطح"], ["xp", "تجربه"], ["wins", "بردها"], ["rank", "امتیاز"]].forEach(([k, label]) => {
      const b = make(`<button class="rk-tab ${k === rankKind ? "active" : ""}" data-rk="${k}">${label}</button>`);
      b.addEventListener("click", () => {
        rankKind = k;
        document.querySelectorAll(".rk-tab").forEach((x) => x.classList.toggle("active", x === b));
        renderRanks();
      });
      $("rank-tabs").appendChild(b);
    });
  }
  const load = async () => {
    const r = await cloud.leaderboard(rankKind, 100);
    const box = $("rank-list");
    const myCard = $("my-rank-card");
    myCard.innerHTML = `<div class="my-rank-num" id="my-rank-num">…</div>
      <div class="skill-info">
        <div class="p-name">${esc(st.username)} <span class="chip chip-blue">${esc(hunterClass(st.level).name)}</span></div>
        <div class="p-sub">سطح ${faNum(st.level)} · قدرت ${fmtNum(computePower(st))} · ${faNum(st.stats.wins || 0)} برد</div>
      </div>`;
    cloud.myRank(rankKind).then((mr) => {
      if (mr.rank) $("my-rank-num").textContent = faNum(mr.rank);
      else $("my-rank-num").textContent = "—";
    });
    box.innerHTML = "";
    if (r.error) {
      box.innerHTML = `<p style="text-align:center;color:var(--txt3);padding:14px">${r.error.code === "PGRST205" ? "دیتابیس نصب نشده — لیدربرد ابری غیرفعال است" : "لیدربرد در دسترس نیست — اینترنت را چک کن"}</p>`;
      return;
    }
    if (!r.list || !r.list.length) { box.innerHTML = "<p style='text-align:center;color:var(--txt3);padding:14px'>هنوز کسی ثبت‌نام نکرده — نفر اول باش!</p>"; return; }
    r.list.forEach((p, idx) => {
      const val = rankKind === "power" ? fmtNum(p.power) : rankKind === "level" ? faNum(p.level) : rankKind === "xp" ? fmtNum(p.xp) : rankKind === "wins" ? faNum(p.wins) : fmtNum(p.rank_pts);
      const row = make(`<div class="rank-row ${idx === 0 ? "top1" : idx === 1 ? "top2" : idx === 2 ? "top3" : ""}">
        <span class="rank-pos">${idx === 0 ? "👑" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : faNum(idx + 1)}</span>
        <div class="rk-main">
          <div class="rk-name">${esc(p.username)} ${p.username === st.username ? "<span class='chip chip-green'>تو</span>" : ""}</div>
          <div class="rk-sub">سطح ${faNum(p.level)} · ${esc(p.hunter_class || "")} · ${timeAgo(new Date(p.last_seen).getTime())}</div>
        </div>
        <span class="rk-val">${val}</span>
      </div>`);
      box.appendChild(row);
    });
  };
  load();
}

/* ================= تنظیمات ================= */
$("btn-settings").addEventListener("click", () => {
  const st = app.getSt();
  const cloudState = cloud.isOnline() ? "🟢 آنلاین" : "🔴 آفلاین";
  modal({
    title: "تنظیمات",
    body: `
      <div class="m-meta" style="justify-content:space-between"><span>وضعیت ابر: <b>${cloudState}</b></span><span>دیتابیس: <b>${cloud.schemaReady() ? "✅ نصب شده" : "❌ نصب نشده"}</b></span></div>
      <div class="m-meta" style="justify-content:space-between"><span>حساب: <b>${esc(st.username)}</b></span><span>سیستم سولو ۳.۴</span></div>
      <div class="m-meta"><span>همگام ابر: <b>${app.isCloud && app.isCloud() ? "فعال — مهارت و آمار کامل" : "محلی (وقتی اینترنت باشد می‌رود روی ابر)"}</b></span></div>
      <p style="margin-top:10px">ساختهٔ ارشام — داده‌ها روی ابر و دستگاه می‌مانند.</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
        <button class="btn btn-ghost btn-sm" id="set-sound">${isMuted() ? "🔊 روشن کردن صدا" : "🔇 خاموش کردن صدا"}</button>
        <button class="btn btn-ghost btn-sm" id="set-autop">${st.settings?.autoPotion ? "🧪 معجون خودکار: روشن" : "🧪 معجون خودکار: خاموش"}</button>
        <button class="btn btn-ghost btn-sm" id="set-export">خروجی پشتیبان ذخیره</button>
        <button class="btn btn-ghost btn-sm" id="set-import">بازیابی از پشتیبان</button>
        <button class="btn btn-ghost btn-sm" id="set-install">نصب / بررسی دیتابیس ابری</button>
        <button class="btn btn-ghost btn-sm" id="set-notif">فعال‌سازی اعلان‌ها</button>
        <button class="btn btn-red btn-sm" id="set-logout">خروج از حساب</button>
      </div>`,
    actions: [{ label: "بستن", cb() {} }]
  });
  $("set-sound").onclick = () => { setMuted(!isMuted()); toast(isMuted() ? "صدا خاموش شد" : "صدا روشن شد", "info"); closeModal(); };
  $("set-autop").onclick = () => {
    st.settings = st.settings || {};
    st.settings.autoPotion = !st.settings.autoPotion;
    app.save();
    toast(st.settings.autoPotion ? "معجون خودکار روشن شد" : "معجون خودکار خاموش شد", "info");
    closeModal();
  };
  $("set-export").onclick = () => {
    try {
      const blob = new Blob([JSON.stringify(st)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "solo-system-save.json";
      a.click();
      toast("فایل پشتیبان ذخیره شد", "good");
    } catch (e) { toast("خروجی گرفته نشد", "bad"); }
  };
  $("set-import").onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || typeof data.level !== "number") throw new Error("bad");
          Object.assign(app.getSt(), migrateState(data));
          app.saveNow();
          toast("ذخیره بازیابی شد", "good");
          closeModal();
          renderHome();
        } catch (e) { toast("فایل پشتیبان نامعتبر است", "bad"); }
      };
      r.readAsText(f);
    };
    inp.click();
  };
  $("set-install").onclick = () => showInstaller();
  $("set-notif").onclick = () => { requestNotifPerm().then(() => toast("اعلان‌ها فعال شد", "good")); };
  $("set-logout").onclick = () => { closeModal(); app.logout(); };
});
async function requestNotifPerm() {
  try {
    const LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN && window.Capacitor?.isNativePlatform?.()) { await LN.requestPermissions(); return; }
  } catch (e) {}
  try { if (window.Notification && Notification.permission === "default") await Notification.requestPermission(); } catch (e) {}
}

/* ================= نصب‌کنندهٔ دیتابیس ================= */
export function showInstaller() {
  modal({
    title: "نصب دیتابیس ابری (یک‌بار)",
    body: `
      <p>برای اینکه حساب‌ها، لیدربرد، چت و رقابت آنلاین <b>واقعاً</b> کار کنند، باید این SQL یک‌بار در دیتابیس تو اجرا شود:</p>
      <ol style="font-size:11.5px;color:var(--txt2);line-height:2.2;padding-right:16px;margin-bottom:10px">
        <li>دکمهٔ «کپی SQL» را بزن</li>
        <li>وارد <b>supabase.com/dashboard</b> شو و پروژهٔ «baooyxmxzkzwimitjfjk» را باز کن</li>
        <li>از منوی چپ: <b>SQL Editor → New query</b></li>
        <li>SQL را Paste کن و <b>Run</b> را بزن (سبز شود = تمام)</li>
        <li>برگرد و «بررسی دوباره» را بزن</li>
      </ol>
      <textarea id="sql-text" readonly style="width:100%;height:120px;background:rgba(0,0,0,.35);color:#9db8ff;border:1px solid var(--card-border);border-radius:10px;font-size:9px;direction:ltr;text-align:left;padding:8px">${esc(SCHEMA_SQL.slice(0, 4000))}…</textarea>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary btn-sm" id="inst-copy">کپی SQL کامل</button>
        <button class="btn btn-gold btn-sm" id="inst-check">بررسی دوباره</button>
      </div>
      <p id="inst-status" style="margin-top:8px"></p>`,
    actions: [{ label: "بستن", cb() {} }]
  });
  $("inst-copy").onclick = () => {
    try {
      navigator.clipboard.writeText(SCHEMA_SQL).then(() => toast("SQL کپی شد!", "good"));
    } catch (e) {
      const ta = $("sql-text");
      ta.value = SCHEMA_SQL;
      ta.select();
      document.execCommand("copy");
      toast("SQL کپی شد!", "good");
    }
  };
  $("inst-check").onclick = async () => {
    $("inst-status").textContent = "در حال بررسی...";
    const r = await cloud.checkSchema();
    if (r.ok) {
      $("inst-status").innerHTML = `<span style="color:#2eff7e">✅ دیتابیس نصب است! همهٔ قابلیت‌های آنلاین فعال شد.</span>`;
      toast("دیتابیس وصل شد! حالا همه‌چیز واقعی کار می‌کند", "good", 4000);
    } else {
      $("inst-status").innerHTML = `<span style="color:#ff7d97">هنوز نصب نشده. مراحل بالا را کامل کن.</span>`;
    }
  };
}

/* ---------- ورود / ثبت‌نام ---------- */
let pendingAvatar = "";
function paintAuthPreview() {
  const box = $("auth-avatar-preview");
  if (!box) return;
  const letter = (($("auth-user") && $("auth-user").value) || "؟").charAt(0).toUpperCase() || "؟";
  box.innerHTML = avatarMarkup(pendingAvatar, letter);
}
function bindAvatarPick() {
  const presets = $("auth-presets");
  if (presets && !presets.children.length) {
    PRESET_AVATARS.forEach((src, i) => {
      const b = make(`<button type="button" class="av-preset" data-av="${i}"><img alt="" src="${src}"></button>`);
      b.addEventListener("click", () => {
        pendingAvatar = src;
        [...presets.children].forEach((x) => x.classList.toggle("on", x === b));
        paintAuthPreview();
      });
      presets.appendChild(b);
    });
  }
  $("auth-photo")?.addEventListener("click", () => $("auth-photo-file")?.click());
  $("auth-photo-file")?.addEventListener("change", async () => {
    const f = $("auth-photo-file").files && $("auth-photo-file").files[0];
    if (!f) return;
    try {
      pendingAvatar = await readAvatarFile(f);
      paintAuthPreview();
      toast("عکس پروفایل آماده شد", "good");
    } catch (e) { toast("عکس خوانده نشد — یک پروفایل آماده انتخاب کن", "bad"); }
  });
  $("auth-user")?.addEventListener("input", () => { if (!pendingAvatar) paintAuthPreview(); });
}
bindAvatarPick();
$("hunter-chip")?.addEventListener("click", () => {
  const st = app && app.getSt && app.getSt();
  if (!st) return;
  const presets = PRESET_AVATARS.map((src, i) => `<button type="button" class="av-preset" data-av="${i}"><img alt="" src="${src}"></button>`).join("");
  modal({
    title: "پروفایل شکارچی",
    body: `<div class="avatar-pick"><div class="avatar avatar-lg" id="chg-av">${avatarMarkup(st.avatar, (st.username || "ش").charAt(0))}</div>
      <div class="avatar-presets" id="chg-presets">${presets}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="chg-photo">📷 عکس خودم</button>
      <input type="file" id="chg-file" accept="image/*" hidden></div>`,
    actions: [{ label: "بستن", cb() {} }]
  });
  const apply = (src) => {
    st.avatar = src;
    app.save();
    renderTopbar();
    const p = $("chg-av");
    if (p) p.innerHTML = avatarMarkup(src, (st.username || "ش").charAt(0));
  };
  $("chg-presets")?.querySelectorAll(".av-preset").forEach((b) => {
    b.addEventListener("click", () => apply(PRESET_AVATARS[Number(b.dataset.av)]));
  });
  $("chg-photo")?.addEventListener("click", () => $("chg-file")?.click());
  $("chg-file")?.addEventListener("change", async () => {
    const f = $("chg-file").files && $("chg-file").files[0];
    if (!f) return;
    try { apply(await readAvatarFile(f)); toast("پروفایل عوض شد", "good"); }
    catch (e) { toast("عکس خوانده نشد", "bad"); }
  });
});
let authTab = "register";
document.querySelectorAll(".auth-tab").forEach((b) => b.addEventListener("click", () => {
  authTab = b.dataset.authtab;
  document.querySelectorAll(".auth-tab").forEach((x) => x.classList.toggle("active", x === b));
  $("auth-submit").textContent = authTab === "login" ? "ورود به سیستم" : "ساخت حساب و ورود";
  $("auth-err").textContent = "";
}));
$("auth-pass-toggle")?.addEventListener("click", () => {
  const inp = $("auth-pass");
  if (!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
});
function localAuthFallback(mode, user, pass) {
  const db = lsGet("local_accounts") || {};
  if (mode === "register") {
    if (db[user]) return { error: "این نام کاربری از قبل روی دستگاه ثبت شده" };
    const userId = "loc_" + user + "_" + Math.abs((user + pass).split("").reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0));
    db[user] = { pass, userId };
    lsSet("local_accounts", db);
    return { token: "local-" + userId, user_id: userId, username: user, player: null };
  }
  if (!db[user] || db[user].pass !== pass) return { error: "نام کاربری یا رمز عبور اشتباه است" };
  return { token: "local-" + db[user].userId, user_id: db[user].userId, username: user, player: null };
}
$("auth-form").addEventListener("submit", (e) => {
  e.preventDefault();
  doAuth();
});
async function doAuth() {
  const user = $("auth-user").value.trim().toLowerCase();
  const saved = lsGet("account");
  let pass = $("auth-pass").value;
  if (!pass && saved && saved.username === user && saved.pass) pass = saved.pass;
  $("auth-err").textContent = "";
  if (!user || !pass) { $("auth-err").textContent = "نام کاربری و رمز را کامل بنویس"; return; }
  if (user.length < 3 || user.length > 20) { $("auth-err").textContent = "نام کاربری باید ۳ تا ۲۰ حرف انگلیسی باشد"; return; }
  if (!/^[a-z0-9_]+$/.test(user)) { $("auth-err").textContent = "فقط حروف انگلیسی، عدد و _"; return; }
  if (pass.length < 4) { $("auth-err").textContent = "رمز حداقل ۴ حرف"; return; }
  const btn = $("auth-submit");
  btn.disabled = true; btn.textContent = authTab === "login" ? "در حال ورود..." : "در حال ساخت حساب...";
  try {
    cloud.initCloud?.();
    const locals = lsGet("local_accounts") || {};
    let r = { error: "no" };
    if (authTab === "login" && locals[user] && locals[user].pass === pass) {
      r = localAuthFallback("login", user, pass);
    } else {
      try {
        r = authTab === "login" ? await cloud.login(user, pass) : await cloud.register(user, pass);
      } catch (e) {
        r = { error: "اتصال به سرور برقرار نشد" };
      }
    }
    const errStr = r && r.error ? String(r.error.message || r.error.code || r.error) : "";
    const netFail = !r || (r.error && /اتصال|TIMEOUT|سرور|Failed|fetch|network|offline|no client|PGRST205|نصب نشده|خطای سرور|Could not find|schema|JWT|invalid api|function public/i.test(errStr));
    if (r.error) {
      const taken = /قبلا|taken|exists|duplicate|ثبت شده/i.test(errStr);
      if (authTab === "register" && taken) {
        const tryLogin = await cloud.login(user, pass).catch(() => ({ error: "x" }));
        if (tryLogin && tryLogin.token && !tryLogin.error) r = tryLogin;
      }
    }
    if (r.error) {
      if (netFail || authTab === "register" || (authTab === "login" && locals[user])) {
        let local = localAuthFallback(authTab, user, pass);
        if (local.error && authTab === "register") local = localAuthFallback("login", user, pass);
        if (local.error) { $("auth-err").textContent = local.error; return; }
        r = local;
        toast("بدون ابر وارد شدی — بعداً همگام می‌شود", "info", 3200);
      } else {
        $("auth-err").textContent = typeof r.error === "string" ? r.error : (r.error.message || "ورود ناموفق");
        return;
      }
    }
    if (!r.token) { $("auth-err").textContent = "توکن نیامد — دوباره بزن"; return; }
    await app.onAuthed(r, pass);
    if (pendingAvatar && app.getSt()) {
      app.getSt().avatar = pendingAvatar;
      app.save();
      renderTopbar();
    }
  } catch (e) {
    $("auth-err").textContent = "خطای غیرمنتظره — دوباره بزن";
  } finally {
    btn.disabled = false;
    btn.textContent = authTab === "login" ? "ورود به سیستم" : "ساخت حساب و ورود";
  }
}
$("auth-offline").addEventListener("click", () => app.onOfflineMode());

export function showAuth(errMsg) {
  $("screen-auth").classList.remove("hidden");
  $("screen-app").classList.add("hidden");
  if (errMsg) $("auth-err").textContent = errMsg;
  const acc = lsGet("account");
  const base = (acc && acc.username)
    ? `حساب ذخیره‌شده: <b>${esc(acc.username)}</b> — فقط رمز را بزن و وارد شو.`
    : "نام کاربری برای همیشه می‌ماند — خوب انتخاب کن.";
  if (acc && acc.username && !$("auth-user").value) $("auth-user").value = acc.username;
  if (acc && acc.pass && $("auth-pass") && !$("auth-pass").value) $("auth-pass").value = acc.pass;
  if (acc && acc.username) {
    authTab = "login";
    document.querySelectorAll(".auth-tab").forEach((x) => x.classList.toggle("active", x.dataset.authtab === "login"));
    if ($("auth-submit")) $("auth-submit").textContent = "ورود به سیستم";
  }
  $("auth-note").innerHTML = base;
  $("auth-offline").classList.remove("hidden");
  cloud.checkSchema().then((r) => {
    const extra = r.ok
      ? `<br><span style="color:#6fffa8">دیتابیس ابری آماده است.</span>`
      : `<br><a href="#" id="auth-install" style="color:#ffd76b;font-weight:800">⚠️ دیتابیس ابری نصب نیست — کلیک کن</a>`;
    $("auth-note").innerHTML = base + extra;
    $("auth-install")?.addEventListener("click", (e2) => { e2.preventDefault(); showInstaller(); });
  });
}
export function showApp() {
  $("screen-auth").classList.add("hidden");
  $("screen-app").classList.remove("hidden");
  bindTrain();
  renderHome();
  switchPage("home", true);
}

/* ---------- API برای main ---------- */
export function currentPageName() { return currentPage; }
export function ready() { return !!app; }

let onlineCache = {};
export function beginDuelFromCloud(d) {
  const st = app.getSt();
  const myId = app.myUserId();
  if (!myId) return;
  const iAmP1 = d.p1 === myId;
  const oppId = iAmP1 ? d.p2 : d.p1;
  const oppName = iAmP1 ? (d.p2name || "حریف") : (d.p1name || "حریف");
  const oppInfo = onlineCache[oppId];
  const me = { id: myId, name: st.username, level: st.level, power: computePower(st) };
  const opp = { id: oppId, name: oppName, level: oppInfo?.level || Math.max(1, st.level), power: oppInfo?.power || computePower(st) };
  if (currentPage === "duel") renderDuelTab();
  startDuelSession(d.id, d.mode || "click", iAmP1, me, opp, d);
}
