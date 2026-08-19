/* ================= صفحهٔ نبرد (باس/دانجن) + دوئل دوبعدی ================= */
import { sfx, el, make, faNum, fmt, dur, esc, clamp, nowMs, vibrate, deepClone } from "./util.js";
import { combatStats, calcDamage } from "./engine.js";
import { skillIndex, itemById } from "./data.js";

let battle = null;
let rafId = 0;
let shooter = null;

/* ============ نبرد باس / دانجن ============ */
export function openBattle(cfg) {
  cleanup();
  const st = cfg.st;
  const cs = combatStats(st);
  const src = cfg.src;
  const isDungeon = cfg.mode === "dungeon";

  battle = {
    cfg, st, cs, isDungeon,
    player: { hp: cs.hp, maxHp: cs.hp, mp: 100, shield: 0, rageUntil: 0, rageMult: 1, hasteUntil: 0 },
    enemy: null,
    wave: 0, totalWaves: isDungeon ? src.waves : 1,
    cds: {}, log: [], over: false, enemyTimer: 0,
    enemyDebuffs: { frozen: 0, blind: 0, silence: 0, poison: { until: 0, dps: 0 } },
    potionCd: 0,
  };
  battle.player.regen = cs.regen || 0;

  spawnWave();
  el("screen-fight").classList.remove("hidden");
  el("screen-app").classList.add("hidden");
  el("fight-title").textContent = isDungeon ? src.name : src.name;
  renderActions();
  addLog(`نبرد آغاز شد! ${src.name}`, "l-info");
  sfx.gate();

  let last = nowMs();
  const loop = () => {
    if (!battle) return;
    const now = nowMs();
    const dt = Math.min(100, now - last);
    last = now;
    if (!battle.over) update(dt);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function spawnWave() {
  const b = battle;
  const src = b.cfg.src;
  b.wave++;
  const isBossWave = !b.isDungeon || b.wave === b.totalWaves;
  let hp, atk, def, name, emoji, skills;
  if (isBossWave) {
    if (b.isDungeon) {
      hp = src.bossPower; atk = Math.floor(src.bossPower / 9); def = Math.floor(src.bossPower / 60);
      name = "نگهبان دروازه"; emoji = src.bossEmoji;
      skills = [{ name: "ضربهٔ نگهبان", mult: 1.8, cd: 7000, color: "#ff2d55" }, { name: "غرش تاریکی", mult: 1.3, cd: 10000, color: "#9b30ff" }];
    } else {
      hp = src.hp; atk = src.atk; def = src.def; name = src.name; emoji = src.emoji; skills = src.skills;
    }
  } else {
    hp = Math.floor(src.enemyPower * (0.45 + b.wave * 0.18));
    atk = Math.floor(src.enemyPower / 8);
    def = Math.floor(src.enemyPower / 70);
    name = src.monster + " (موج " + faNum(b.wave) + ")";
    emoji = src.emoji;
    skills = [];
  }
  b.enemy = { hp, maxHp: hp, atk, def, name, emoji, skills, rage: false, atkT: nowMs() + 1400 };
  b.enemyDebuffs = { frozen: 0, blind: 0, silence: 0, poison: { until: 0, dps: 0 } };
  el("enemy-sprite").textContent = emoji;
  el("enemy-name").textContent = name;
  el("fight-wave").textContent = b.isDungeon ? `موج ${faNum(b.wave)} از ${faNum(b.totalWaves)}` : rankLabel(src.rank);
  el("enemy-rage").classList.add("hidden");
  const sq = el("shadow-squad");
  if (sq) {
    sq.innerHTML = "";
    (b.st.equip.shadows || []).forEach((sid) => {
      const sh = b.st.shadows[sid];
      if (sh) {
        const n = document.createElement("div");
        n.className = "shadow-mini";
        n.textContent = sh.emoji || "👤";
        sq.appendChild(n);
      }
    });
  }
  updateBars();
}
function rankLabel(r) { return r ? r.name : ""; }

function update(dt) {
  const b = battle;
  const now = nowMs();

  // رجنسریشن
  if (b.player.regen && b.player.hp < b.player.maxHp) {
    b.regAcc = (b.regAcc || 0) + dt;
    if (b.regAcc > 5000) { b.regAcc = 0; heal(Math.floor(b.player.maxHp * b.player.regen / 100)); }
  }
  // رجنسریشن MP
  b.player.mp = Math.min(100, b.player.mp + dt * 0.006);

  // افکت‌های موقت
  if (b.player.rageUntil && now > b.player.rageUntil) { b.player.rageUntil = 0; b.player.rageMult = 1; }
  if (b.player.hasteUntil && now > b.player.hasteUntil) b.player.hasteUntil = 0;

  // سم روی دشمن
  const po = b.enemyDebuffs.poison;
  if (po.until > now) {
    po.acc = (po.acc || 0) + dt;
    if (po.acc > 1000) { po.acc = 0; enemyTake(Math.floor(po.dps)); addLog(`سم: ${faNum(po.dps)} آسیب`, "l-gold"); }
  }
  // فریز/نابینایی/سکوت
  b.enemyDebuffs.frozen = Math.max(0, b.enemyDebuffs.frozen - dt);
  b.enemyDebuffs.blind = Math.max(0, b.enemyDebuffs.blind - dt);
  b.enemyDebuffs.silence = Math.max(0, b.enemyDebuffs.silence - dt);

  // حمله دشمن — واقعی آسیب می‌زند!
  if (b.enemyDebuffs.frozen > 0) return;
  if (now >= b.enemy.atkT) {
    enemyAttack();
    const haste = b.enemy.rage ? 1.25 : 1.55;
    b.enemy.atkT = now + (1100 + Math.random() * 900) * haste;
  }
}

function enemyAttack() {
  const b = battle;
  const e = b.enemy;
  let mult = 1, label = "حمله", crit = false;

  // مهارت باس
  if (e.skills.length && b.enemyDebuffs.silence <= 0) {
    const ready = e.skills.find((s) => nowMs() >= (s._cdAt || 0));
    if (ready) {
      mult = ready.mult; label = ready.name; ready._cdAt = nowMs() + ready.cd;
      if (ready.debuff) { b.player.rageMult = 1; b.player.shield = 0; addLog(`${e.name}: ${ready.name}! دفاعت شکست`, "l-bad"); }
    }
  }
  // کور شدن
  if (b.enemyDebuffs.blind > 0 && Math.random() < 0.35) {
    addLog(`${e.name} حمله کرد اما نتوانست تو را ببیند`, "l-info");
    return;
  }
  const rageMult = e.rage ? 1.45 : 1;
  const raw = Math.max(1, e.atk * mult * rageMult - b.cs.def * 0.4);
  let dmg = Math.floor(raw * (0.8 + Math.random() * 0.4));

  // جاخالی
  if (Math.random() * 100 < b.cs.dodge) {
    addLog("جاخالی دادی!", "l-good"); sfx.skill();
    flashSprite("player-sprite", "hit");
    return;
  }
  // سپر
  if (b.player.shield > 0) {
    const absorbed = Math.min(b.player.shield, dmg);
    b.player.shield -= absorbed; dmg -= absorbed;
    if (absorbed > 0) addLog(`سپر ${faNum(absorbed)} آسیب جذب کرد`, "l-info");
  }
  // بازتاب
  if (b.cs.reflect > 0) {
    const refl = Math.floor(dmg * b.cs.reflect / 100);
    if (refl > 0) { enemyTake(refl, true); addLog(`بازتاب: ${faNum(refl)} آسیب برگشت`, "l-gold"); }
  }
  if (dmg > 0) {
    b.player.hp -= dmg;
    showFloatDmg("player-dmg", dmg, false);
    addLog(`${label}: ${faNum(dmg)} آسیب خوردی!`, "l-bad");
    sfx.hurt(); vibrate(60);
    flashSprite("player-sprite", "hit");
    updateBars();
    // خون‌آشام: با هر ضربهٔ دشمن هم جان می‌گیری (در صورت داشتن)
  }
  if (b.player.hp <= 0) { b.player.hp = 0; finish(false); return; }
  // خشم دشمن
  if (!e.rage && e.hp < e.maxHp * 0.4) {
    e.rage = true;
    el("enemy-rage").classList.remove("hidden");
    addLog("⚠️ حالت خشم! آسیب دشمن بیشتر شد", "l-bad");
    sfx.alarm();
  }
}

export function playerAttack() {
  const b = battle;
  if (!b || b.over) return;
  if (b.player.rageUntil && nowMs() > b.player.rageUntil) { b.player.rageUntil = 0; b.player.rageMult = 1; }
  let mult = 1 * b.player.rageMult * (b.player.hasteUntil > nowMs() ? 1.25 : 1);
  if (!b.isDungeon) mult *= (b.cs.slayer || 1);
  let critChance = b.cs.crit;
  const { dmg, crit } = calcDamage(b.cs.atk, b.enemy.def, critChance, mult);
  enemyTake(dmg, crit);
  // سرقت جان
  if (b.cs.lifesteal > 0) heal(Math.floor(dmg * b.cs.lifesteal / 100));
  sfx.hit(); vibrate(25);
  flashSprite("enemy-sprite", "hit");
  b.st.stats.skillsUsed = (b.st.stats.skillsUsed || 0) + 0; // حمله عادی مهارت نیست
  return dmg;
}

function enemyTake(dmg, crit) {
  const b = battle;
  if (!b || b.over) return;
  if (b.enemyDebuffs.frozen > 0 && Math.random() < 0.5) dmg = Math.floor(dmg * 1.5); // ضربه به دشمن یخ‌زده
  b.enemy.hp -= dmg;
  showFloatDmg("enemy-dmg", dmg, crit, true);
  updateBars();
  if (b.enemy.hp <= 0) {
    b.enemy.hp = 0;
    if (b.isDungeon && b.wave < b.totalWaves) {
      addLog(`موج ${faNum(b.wave)} پاک شد!`, "l-good");
      heal(Math.floor(b.player.maxHp * 0.18));
      b.player.mp = Math.min(100, b.player.mp + 30);
      setTimeout(() => { if (battle) spawnWave(); }, 700);
    } else {
      finish(true);
    }
  }
}
function heal(n) {
  const b = battle; if (!b) return;
  if (n <= 0) return;
  b.player.hp = Math.min(b.player.maxHp, b.player.hp + n);
  showFloatDmg("player-dmg", n, false, true);
  updateBars();
}

export function useSkill(sid) {
  const b = battle;
  if (!b || b.over) return { error: "نبرد تمام شده" };
  if (b.cds[sid] && b.cds[sid] > nowMs()) return { error: "در حال شارژ" };
  const sk = skillIndex(sid);
  if (!sk || sk.passive) return { error: "مهارت غیرفعال" };
  const mpCost = 18 + Math.floor(sid / 200);
  if (b.player.mp < mpCost) return { error: "انرژی مهارت کافی نیست" };
  b.player.mp -= mpCost;
  b.cds[sid] = nowMs() + sk.cd;
  b.st.stats.skillsUsed = (b.st.stats.skillsUsed || 0) + 1;
  b.cfg.onSkillUsed && b.cfg.onSkillUsed();

  let msg = "";
  const E = b.enemy;
  switch (sk.type.key) {
    case "dmg": case "cleave": case "vortex": {
      const mult = (sk.dmgPct + (sk.type.key === "cleave" ? 60 : 0)) / 100;
      const { dmg, crit } = calcDamage(b.cs.atk, E.def, b.cs.crit + (sk.type.key === "vortex" ? 10 : 0), mult);
      enemyTake(dmg, crit); msg = `${faNum(dmg)} آسیب`; break;
    }
    case "meteor": {
      const { dmg, crit } = calcDamage(b.cs.atk, E.def, b.cs.crit, (sk.dmgPct + 120) / 100);
      enemyTake(dmg, crit); msg = `شهاب! ${faNum(dmg)} آسیب`; break;
    }
    case "snipe": {
      const { dmg, crit } = calcDamage(b.cs.atk, E.def, Math.min(95, b.cs.crit + sk.pct), sk.dmgPct / 100);
      enemyTake(dmg, crit); msg = `تیر مرگ: ${faNum(dmg)}`; break;
    }
    case "heal": heal(Math.floor(b.player.maxHp * sk.pct / 100)); msg = "جان بازیابی شد"; break;
    case "shield": b.player.shield += Math.floor(b.player.maxHp * sk.pct / 100); msg = "سپر فعال شد"; break;
    case "rage": b.player.rageUntil = nowMs() + 10000; b.player.rageMult = 1 + (sk.pct + 20) / 100; msg = "خشم! آسیب +" + (sk.pct + 20) + "٪"; break;
    case "poison": b.enemyDebuffs.poison = { until: nowMs() + 8000, dps: Math.max(2, Math.floor(b.cs.atk * sk.pct / 100)) }; msg = "سم تزریق شد"; break;
    case "freeze": b.enemyDebuffs.frozen = 3000; msg = "دشمن منجمد شد!"; break;
    case "blind": b.enemyDebuffs.blind = 5000; msg = "دشمن کور شد"; break;
    case "silence": b.enemyDebuffs.silence = 5000; msg = "مهارت‌های دشمن قفل شد"; break;
    case "chain": {
      const { dmg, crit } = calcDamage(b.cs.atk, E.def, b.cs.crit, sk.dmgPct / 100);
      enemyTake(dmg, crit); enemyTake(Math.floor(dmg * 0.5), false); msg = `صاعقهٔ زنجیره‌ای: ${faNum(dmg + Math.floor(dmg * 0.5))}`; break;
    }
    case "aoe": {
      const { dmg, crit } = calcDamage(b.cs.atk, E.def, b.cs.crit, (sk.dmgPct - 40) / 100);
      enemyTake(dmg, crit); msg = `ضربهٔ فراگیر: ${faNum(dmg)}`; break;
    }
    case "summon": {
      const dmg = Math.floor(b.cs.atk * (1 + sk.rank.mult / 10));
      enemyTake(dmg, false); msg = `سایه حمله کرد: ${faNum(dmg)}`; break;
    }
    case "execute": {
      if (E.hp < E.maxHp * 0.25) { enemyTake(E.hp, true); msg = "اعدام!"; }
      else { const { dmg } = calcDamage(b.cs.atk, E.def, b.cs.crit, sk.dmgPct / 100); enemyTake(dmg, false); msg = `${faNum(dmg)} آسیب`; }
      break;
    }
    case "barrier": b.player.shield += Math.floor(b.player.maxHp * sk.pct / 100); b.player.regen += 1; msg = "حصار فعال شد"; break;
    default: {
      const { dmg } = calcDamage(b.cs.atk, E.def, b.cs.crit, sk.dmgPct / 100);
      enemyTake(dmg, false); msg = `${faNum(dmg)} آسیب`; break;
    }
  }
  addLog(`مهارت «${sk.name}»: ${msg}`, "l-info");
  sfx.skill(); vibrate(35);
  flashSprite("enemy-sprite", "hit");
  updateBars();
  renderActions();
  return { ok: true };
}

export function usePotion(itemId) {
  const b = battle;
  if (!b || b.over) return { error: "نبرد تمام شده" };
  if (b.potionCd > nowMs()) return { error: "کمی صبر کن" };
  const it = itemById(itemId);
  if (!it || !it.effects.heal) return { error: "فقط معجون جان اینجا کار می‌کند" };
  const has = b.cfg.consumeItem(itemId, 1);
  if (!has) return { error: "معجون نداری" };
  b.potionCd = nowMs() + 1500;
  heal(Math.floor(b.player.maxHp * it.effects.heal / 100));
  addLog(`${it.name}: جان بازیابی شد`, "l-good");
  sfx.coin();
  return { ok: true };
}

function finish(win) {
  if (!battle || battle.over) return;
  battle.over = true;
  const b = battle;
  const st = b.st;
  const src = b.cfg.src;
  const cs = b.cs;
  let rewards = null;

  if (win) {
    sfx.win();
    const goldMult = cs.goldMult;
    const xpMult = cs.xpMult;
    let gold, xp, essenceChance;
    if (b.isDungeon) {
      gold = Math.floor(src.gold * goldMult);
      xp = Math.floor(src.xp * xpMult);
      essenceChance = src.essenceChance * cs.extractMult;
      st.stats.dungeons++; st.stats.kills += b.totalWaves;
      b.cfg.applyProgress && b.cfg.applyProgress("dungeons", 1);
      b.cfg.applyProgress && b.cfg.applyProgress("kills", b.totalWaves);
    } else {
      gold = Math.floor(src.gold * goldMult);
      xp = Math.floor(src.xp * xpMult);
      essenceChance = src.essenceChance * cs.extractMult;
      st.stats.bosses++; st.stats.kills++;
      b.cfg.applyProgress && b.cfg.applyProgress("bosses", 1);
    }
    rewards = { gold, xp, essenceChance, isDungeon: b.isDungeon };
    b.cfg.onWin && b.cfg.onWin(rewards);
  } else {
    sfx.lose();
    const goldLoss = Math.min(st.gold, Math.floor(st.gold * 0.08) + 25);
    st.gold -= goldLoss;
    b.cfg.onLose && b.cfg.onLose({ goldLoss });
  }
  st.updatedAt = nowMs();
  b.cfg.save && b.cfg.save();
  setTimeout(() => { if (battle) hideFight(); }, win ? 1200 : 1600);
}

function showFloatDmg(zoneId, amount, crit, fromEnemy) {
  const zone = el(zoneId);
  if (!zone) return;
  const span = document.createElement("span");
  span.textContent = (fromEnemy ? "-" : "+") + faNum(amount);
  if (crit) span.className = "dmg-crit";
  else if (fromEnemy && zoneId === "player-dmg") span.className = "dmg-heal";
  else span.className = zoneId === "enemy-dmg" ? "dmg-enemy" : "dmg-player";
  span.style.right = (10 + Math.random() * 60) + "px";
  zone.appendChild(span);
  setTimeout(() => span.remove(), 950);
}
function flashSprite(id, cls) {
  const n = el(id);
  if (!n) return;
  n.classList.remove("hit");
  void n.offsetWidth;
  n.classList.add(cls);
}
function updateBars() {
  const b = battle; if (!b) return;
  const hpPct = Math.max(0, b.player.hp / b.player.maxHp * 100);
  const ehpPct = Math.max(0, b.enemy.hp / b.enemy.maxHp * 100);
  el("player-hp-fill").style.width = hpPct + "%";
  el("player-hp-txt").textContent = `${faNum(Math.max(0, Math.floor(b.player.hp)))} / ${faNum(b.player.maxHp)}`;
  el("player-mp-fill").style.width = b.player.mp + "%";
  el("enemy-hp-fill").style.width = ehpPct + "%";
  el("enemy-hp-txt").textContent = `${faNum(Math.max(0, Math.floor(b.enemy.hp)))} / ${faNum(b.enemy.maxHp)}`;
}
function addLog(txt, cls) {
  const b = battle; if (!b) return;
  b.log.unshift({ txt, cls, ts: nowMs() });
  if (b.log.length > 40) b.log.length = 40;
  const box = el("fight-log");
  if (!box) return;
  box.innerHTML = "";
  b.log.forEach((l) => {
    const d = document.createElement("div");
    d.className = l.cls || "";
    d.textContent = l.txt;
    box.appendChild(d);
  });
  box.scrollTop = 0;
}
function renderActions() {
  const b = battle; if (!b) return;
  const box = el("fight-actions");
  box.innerHTML = "";
  // حمله
  const atk = make(`<button class="fa-btn attack"><span class="fa-ico">⚔️</span>حمله</button>`);
  atk.addEventListener("click", () => { playerAttack(); renderActions(); });
  box.appendChild(atk);
  // مهارت‌های فعال غیرپسیو
  const actives = b.st.equip.active.map((sid) => skillIndex(sid)).filter((s) => s && !s.passive).slice(0, 4);
  actives.forEach((sk) => {
    const cdLeft = (b.cds[sk.i] || 0) - nowMs();
    const btn = make(`<button class="fa-btn"><span class="fa-ico">${sk.icon}</span>${esc(sk.name)}</button>`);
    if (cdLeft > 0) {
      const ov = make(`<div class="cd-ov">${dur(cdLeft)}</div>`);
      btn.appendChild(ov);
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => { useSkill(sk.i); renderActions(); });
    }
    box.appendChild(btn);
  });
  // معجون‌ها
  const potions = Object.entries(b.st.items || {})
    .map(([id, count]) => ({ it: itemById(Number(id)), count }))
    .filter((x) => x.it && x.it.effects && x.it.effects.heal)
    .slice(0, 2);
  potions.forEach(({ it, count }) => {
    const btn = make(`<button class="fa-btn"><span class="fa-ico">🧪</span>${esc(it.name)} ×${faNum(count)}</button>`);
    btn.addEventListener("click", () => { const r = usePotion(it.id); if (r && r.error && b.cfg.toast) b.cfg.toast(r.error, "bad"); renderActions(); });
    box.appendChild(btn);
  });
  // فرار
  const flee = make(`<button class="fa-btn"><span class="fa-ico">🏃</span>فرار</button>`);
  flee.addEventListener("click", () => {
    battle.over = true;
    b.cfg.onExit && b.cfg.onExit();
    b.cfg.save && b.cfg.save();
    hideFight();
  });
  box.appendChild(flee);
  updateBars();
}

export function hideFight() {
  el("screen-fight").classList.add("hidden");
  el("screen-app").classList.remove("hidden");
  battle = null;
}
export function isFighting() { return !!battle; }

/* ============ دوئل دوبعدی (شوتر واقعی) ============ */
export function openShooterDuel(cfg) {
  cleanup();
  shooter = {
    cfg, // {duelId, me:{id,name,level,power}, opp:{id,name,level,power}, isHost, send(event,payload), onEnd(result), toast}
    me: { x: 120, y: 225, hp: 100 + Math.min(100, cfg.me.level * 2), dir: 0, fire: false, lastFire: 0 },
    opp: { x: 680, y: 225, hp: 100 + Math.min(100, cfg.opp.level * 2), dir: 0, fire: false, lastFire: 0, lastInput: nowMs() },
    bullets: [], powerups: [], time: 60, over: false,
    myDmg: 7 + Math.min(30, Math.floor(cfg.me.power / 120)),
    oppDmg: 7 + Math.min(30, Math.floor(cfg.opp.power / 120)),
    joy: { x: 0, y: 0 }, mouseAim: null, keys: {},
  };
  el("screen-shooter").classList.remove("hidden");
  el("screen-app").classList.add("hidden");
  el("shooter-vs").textContent = `${cfg.me.name} در برابر ${cfg.opp.name}`;
  const cv = el("duel-canvas");
  cv.width = 800; cv.height = 450;

  setupControls();
  const loop = () => {
    if (!shooter) return;
    step();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  shooter.sendTimer = setInterval(() => {
    if (!shooter || shooter.over) return;
    cfg.send("state", {
      x: Math.round(shooter.me.x), y: Math.round(shooter.me.y),
      dir: shooter.me.dir, fire: shooter.me.fire, hp: shooter.me.hp
    });
  }, 70);
  shooter.powerupTimer = setInterval(() => {
    if (!shooter || shooter.over) return;
    if (shooter.powerups.length < 3) {
      const pw = { x: 100 + Math.random() * 600, y: 60 + Math.random() * 330, type: ["heal", "dmg", "speed"][Math.floor(Math.random() * 3)], id: Date.now() };
      shooter.powerups.push(pw);
      cfg.send("powerup", pw);
    }
  }, 7000);
}

function setupControls() {
  const cv = el("duel-canvas");
  // کیبورد
  window.addEventListener("keydown", shKeyDown);
  window.addEventListener("keyup", shKeyUp);
  window.addEventListener("mousemove", shMouse);
  window.addEventListener("mousedown", shMouseDown);
  window.addEventListener("mouseup", shMouseUp);
  cv.addEventListener("touchstart", shTouchStart, { passive: false });
  cv.addEventListener("touchmove", shTouchMove, { passive: false });
  // جوی‌استیک
  const zone = el("joystick-zone");
  const knob = el("joystick-knob");
  let jid = null;
  zone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    jid = e.changedTouches[0].identifier;
    moveKnob(e.changedTouches[0]);
  });
  zone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === jid) moveKnob(t);
  });
  const endJoy = (e) => {
    for (const t of e.changedTouches) if (t.identifier === jid) {
      jid = null; shooter.joy = { x: 0, y: 0 }; knob.style.top = "50%"; knob.style.right = "50%";
    }
  };
  zone.addEventListener("touchend", endJoy);
  zone.addEventListener("touchcancel", endJoy);
  function moveKnob(t) {
    const r = zone.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const max = r.width / 2 - 14;
    const cl = Math.min(len, max);
    dx = dx / len * cl; dy = dy / len * cl;
    knob.style.top = (cy - r.top + dy) + "px";
    knob.style.right = (r.right - cx + dx) + "px";
    shooter.joy = { x: dx / max, y: dy / max };
  }
  el("btn-fire").addEventListener("touchstart", (e) => { e.preventDefault(); shooter.me.fire = true; });
  el("btn-fire").addEventListener("touchend", (e) => { e.preventDefault(); shooter.me.fire = false; });
  el("btn-fire").addEventListener("mousedown", () => { shooter.me.fire = true; });
  el("btn-fire").addEventListener("mouseup", () => { shooter.me.fire = false; });
  el("btn-exit-duel").addEventListener("click", () => endShooter("exit"));
}
function shKeyDown(e) { if (shooter) shooter.keys[e.code] = true; }
function shKeyUp(e) { if (shooter) shooter.keys[e.code] = false; }
function shMouse(e) { if (shooter && shooter.cfg) { const r = el("duel-canvas").getBoundingClientRect(); shooter.mouseAim = { x: (e.clientX - r.left) / r.width * 800, y: (e.clientY - r.top) / r.height * 450 }; } }
function shMouseDown() { if (shooter) shooter.me.fire = true; }
function shMouseUp() { if (shooter) shooter.me.fire = false; }
function shTouchStart(e) { e.preventDefault(); }
function shTouchMove(e) { e.preventDefault(); }

export function shooterRemoteState(payload) {
  if (!shooter || shooter.over) return;
  shooter.opp.x = payload.x; shooter.opp.y = payload.y;
  shooter.opp.dir = payload.dir; shooter.opp.fire = payload.fire;
  shooter.opp.hp = payload.hp;
  shooter.opp.lastInput = nowMs();
  if (payload.hp <= 0) endShooter("win");
}
export function shooterRemoteBullet(p) {
  if (!shooter || shooter.over) return;
  shooter.bullets.push(p);
  sfx.shoot();
}
export function shooterRemotePowerup(p) {
  if (!shooter || shooter.over) return;
  if (!shooter.powerups.find((x) => x.id === p.id)) shooter.powerups.push(p);
}

function step() {
  const s = shooter; if (!s) return;
  const now = nowMs();

  // حرکت من
  let mx = 0, my = 0;
  if (s.keys["KeyW"] || s.keys["ArrowUp"]) my -= 1;
  if (s.keys["KeyS"] || s.keys["ArrowDown"]) my += 1;
  if (s.keys["KeyA"] || s.keys["ArrowLeft"]) mx -= 1;
  if (s.keys["KeyD"] || s.keys["ArrowRight"]) mx += 1;
  mx += s.joy.x; my += s.joy.y;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const speed = (s.me.speedUntil && s.me.speedUntil > now) ? 300 : 220;
  s.me.x = clamp(s.me.x + mx * speed * 0.016, 16, 784);
  s.me.y = clamp(s.me.y + my * speed * 0.016, 16, 434);

  // جهت من
  if (s.mouseAim) s.me.dir = Math.atan2(s.mouseAim.y - s.me.y, s.mouseAim.x - s.me.x);
  else if (ml > 0.05) s.me.dir = Math.atan2(my, mx);
  // جهت حریف
  const odx = s.me.x - s.opp.x, ody = s.me.y - s.opp.y;
  s.opp.dir = Math.atan2(ody, odx);

  // شلیک
  if (s.me.fire && now - s.me.lastFire > 320) {
    s.me.lastFire = now;
    spawnBullet(s, "me");
  }
  if (s.opp.fire && now - s.opp.lastFire > 320) {
    s.opp.lastFire = now;
    spawnBullet(s, "opp");
  }

  // گلوله‌ها
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.x += b.vx * 0.016; b.y += b.vy * 0.016;
    let dead = b.x < 0 || b.x > 800 || b.y < 0 || b.y > 450;
    // برخورد با من (گلوله حریف)
    if (!dead && b.owner === "opp" && Math.hypot(b.x - s.me.x, b.y - s.me.y) < 18) {
      s.me.hp -= s.oppDmg; dead = true;
      if (s.me.hp <= 0) { s.me.hp = 0; endShooter("lose"); return; }
    }
    // برخورد با حریف (گلوله من)
    if (!dead && b.owner === "me" && Math.hypot(b.x - s.opp.x, b.y - s.opp.y) < 18) {
      s.opp.hp -= s.myDmg; dead = true;
      if (s.opp.hp <= 0) { s.opp.hp = 0; endShooter("win"); return; }
    }
    if (dead) s.bullets.splice(i, 1);
  }

  // پاورآپ‌ها
  for (let i = s.powerups.length - 1; i >= 0; i--) {
    const p = s.powerups[i];
    if (Math.hypot(p.x - s.me.x, p.y - s.me.y) < 22) {
      if (p.type === "heal") { s.me.hp = Math.min(s.me.hp + 35, 200); }
      if (p.type === "dmg") { s.myDmg *= 1.5; s.dmgUntil = now + 6000; setTimeout(() => { if (shooter) shooter.myDmg = 7 + Math.min(30, Math.floor(shooter.cfg.me.power / 120)); }, 6000); }
      if (p.type === "speed") s.me.speedUntil = now + 6000;
      s.powerups.splice(i, 1);
      sfx.coin();
    }
  }

  // تایمر
  s.time -= 0.016;
  el("shooter-time").textContent = faNum(Math.max(0, Math.ceil(s.time)));
  if (s.time <= 0) {
    endShooter(s.me.hp >= s.opp.hp ? "win" : "lose");
    return;
  }
  // قطع ارتباط حریف
  if (now - s.opp.lastInput > 9000 && !s.cfg.localTest) {
    endShooter("win-forfeit");
    return;
  }
  draw();
}

function spawnBullet(s, owner) {
  const p = owner === "me" ? s.me : s.opp;
  const dmg = owner === "me" ? s.myDmg : s.oppDmg;
  const b = {
    id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
    x: p.x + Math.cos(p.dir) * 22, y: p.y + Math.sin(p.dir) * 22,
    vx: Math.cos(p.dir) * 460, vy: Math.sin(p.dir) * 460,
    owner
  };
  s.bullets.push(b);
  s.cfg.send("bullet", b);
  sfx.shoot();
}

function draw() {
  const s = shooter; if (!s) return;
  const cv = el("duel-canvas");
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 800, 450);
  // شبکه
  g.strokeStyle = "rgba(124,92,255,.08)";
  for (let x = 0; x <= 800; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 450); g.stroke(); }
  for (let y = 0; y <= 450; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(800, y); g.stroke(); }
  // پاورآپ‌ها
  s.powerups.forEach((p) => {
    g.fillStyle = p.type === "heal" ? "#2eff7e" : p.type === "dmg" ? "#ff8a2a" : "#2ad4ff";
    g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
  });
  // گلوله‌ها
  s.bullets.forEach((b) => {
    g.fillStyle = b.owner === "me" ? "#7c5cff" : "#ff2d55";
    g.shadowColor = g.fillStyle; g.shadowBlur = 8;
    g.beginPath(); g.arc(b.x, b.y, 5, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  });
  drawFighter(g, s.me, "#4f7cff", "تو");
  drawFighter(g, s.opp, "#ff2d55", s.cfg.opp.name);
  // HP
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(10, 10, 380, 10);
  g.fillStyle = "#2eff7e"; g.fillRect(10, 10, 380 * clamp(s.me.hp / 200, 0, 1), 10);
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(410, 10, 380, 10);
  g.fillStyle = "#ff2d55"; g.fillRect(800 - 380 * clamp(s.opp.hp / 200, 0, 1), 10, 380 * clamp(s.opp.hp / 200, 0, 1), 10);
  g.fillStyle = "#9aa3bd"; g.font = "bold 11px Vazirmatn, sans-serif";
  g.textAlign = "right"; g.fillText(s.cfg.me.name, 390, 18);
  g.textAlign = "left"; g.fillText(s.cfg.opp.name, 410, 18);
}
function drawFighter(g, p, color, label) {
  g.save();
  g.translate(p.x, p.y);
  // هاله
  g.fillStyle = color + "33";
  g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
  // بدن
  g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = 14;
  g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  // شمشیر
  g.rotate(p.dir);
  g.strokeStyle = "#fff"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(14, 0); g.lineTo(30, 0); g.stroke();
  g.rotate(-p.dir);
  g.fillStyle = "#fff"; g.font = "bold 11px Vazirmatn, sans-serif";
  g.textAlign = "center"; g.fillText(label, 0, 36);
  g.restore();
}

function endShooter(result) {
  const s = shooter;
  if (!s || s.over) return;
  s.over = true;
  const meHp = Math.max(0, Math.round(s.me.hp));
  const oppHp = Math.max(0, Math.round(s.opp.hp));
  const won = result === "win" || result === "win-forfeit";
  s.cfg.send("end", { result: won ? "lose" : "win", hp: oppHp, forfeit: result === "win-forfeit" });
  s.cfg.onEnd({ won, meHp, oppHp, forfeit: result === "win-forfeit" });
  s.cfg.onEnd = null;
  setTimeout(() => { hideShooter(); }, 2600);
}
export function shooterRemoteEnd(payload) {
  if (!shooter || shooter.over) return;
  shooter.over = true;
  const won = payload.result === "lose"; // حریف باخت یعنی من بردم
  shooter.cfg.onEnd({ won, meHp: payload.hp, oppHp: Math.round(shooter.opp.hp), forfeit: !!payload.forfeit });
  shooter.cfg.onEnd = null;
  setTimeout(() => { hideShooter(); }, 2600);
}
export function hideShooter() {
  el("screen-shooter").classList.add("hidden");
  el("screen-app").classList.remove("hidden");
  window.removeEventListener("keydown", shKeyDown);
  window.removeEventListener("keyup", shKeyUp);
  window.removeEventListener("mousemove", shMouse);
  window.removeEventListener("mousedown", shMouseDown);
  window.removeEventListener("mouseup", shMouseUp);
  cleanupShooter();
}
function cleanupShooter() {
  if (shooter) {
    clearInterval(shooter.sendTimer);
    clearInterval(shooter.powerupTimer);
  }
  shooter = null;
}

/* ============ دوئل کلیکی ============ */
let clickDuel = null;
export function openClickDuel(cfg) {
  cleanup();
  clickDuel = {
    cfg, // {me, opp, duelId, send, onEnd}
    myClicks: 0, oppClicks: 0, time: 30, over: false, interval: null, sendTimer: null
  };
  el("screen-shooter").classList.remove("hidden");
  el("screen-app").classList.add("hidden");
  el("shooter-vs").textContent = `${cfg.me.name} ⚔️ ${cfg.opp.name} — هر کی بیشتر بزند!`;
  el("duel-canvas").classList.add("hidden");
  el("shooter-controls").classList.add("hidden");
  el("shooter-hp").classList.add("hidden");
  const top = el("shooter-top");
  top.insertAdjacentHTML("beforeend", `<div id="click-duel-ui" style="flex:1;text-align:center;padding:40px 10px">
    <div style="font-size:13px;color:#9aa3bd;margin-bottom:14px">دکمهٔ بزرگ را بزن! سریع‌تر از حریف واقعی</div>
    <button id="click-duel-btn" style="width:180px;height:180px;border-radius:50%;font-size:44px;font-weight:900;
      background:radial-gradient(circle at 35% 30%,#3a4a8a,#151b38 70%);border:2px solid rgba(124,92,255,.6);box-shadow:0 0 34px rgba(124,92,255,.4)">👊</button>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:18px;font-weight:900">
      <span style="color:#6fa8ff">تو: <b id="cd-my">۰</b></span>
      <span style="color:#ff8099">${esc(cfg.opp.name)}: <b id="cd-opp">۰</b></span>
    </div>
  </div>`);
  el("click-duel-btn").addEventListener("pointerdown", () => {
    if (!clickDuel || clickDuel.over) return;
    clickDuel.myClicks++;
    el("cd-my").textContent = faNum(clickDuel.myClicks);
    sfx.click(); vibrate(10);
  });
  clickDuel.interval = setInterval(() => {
    const c = clickDuel; if (!c) return;
    c.time--;
    el("shooter-time").textContent = faNum(Math.max(0, c.time));
    if (c.time <= 0) {
      endClickDuel(c.myClicks >= c.oppClicks ? "win" : "lose");
    }
  }, 1000);
  clickDuel.sendTimer = setInterval(() => {
    if (clickDuel) cfg.send("clicks", { n: clickDuel.myClicks });
  }, 500);
}
export function clickDuelRemote(n) {
  if (!clickDuel) return;
  clickDuel.oppClicks = n;
  const oppEl = el("cd-opp");
  if (oppEl) oppEl.textContent = faNum(n);
}
function endClickDuel(result) {
  const c = clickDuel;
  if (!c || c.over) return;
  c.over = true;
  const won = result === "win";
  c.cfg.send("end", { result: won ? "lose" : "win", clicks: c.myClicks });
  c.cfg.onEnd({ won, meClicks: c.myClicks, oppClicks: c.oppClicks });
  c.cfg.onEnd = null;
  setTimeout(() => hideClickDuel(), 2400);
}
export function clickDuelRemoteEnd(payload) {
  if (!clickDuel || clickDuel.over) return;
  clickDuel.over = true;
  const won = payload.result === "lose";
  clickDuel.cfg.onEnd({ won, meClicks: clickDuel.myClicks, oppClicks: payload.clicks });
  clickDuel.cfg.onEnd = null;
  setTimeout(() => hideClickDuel(), 2400);
}
export function hideClickDuel() {
  el("screen-shooter").classList.add("hidden");
  el("screen-app").classList.remove("hidden");
  el("duel-canvas").classList.remove("hidden");
  el("shooter-controls").classList.remove("hidden");
  el("shooter-hp").classList.remove("hidden");
  const ui = el("click-duel-ui");
  if (ui) ui.remove();
  if (clickDuel) { clearInterval(clickDuel.interval); clearInterval(clickDuel.sendTimer); }
  clickDuel = null;
}

/* ---------- پاکسازی ---------- */
export function cleanup() {
  cancelAnimationFrame(rafId);
  if (battle) { battle.over = true; battle = null; }
  if (shooter) cleanupShooter();
  if (clickDuel) { clearInterval(clickDuel.interval); clearInterval(clickDuel.sendTimer); clickDuel = null; }
  window.removeEventListener("keydown", shKeyDown);
  window.removeEventListener("keyup", shKeyUp);
  window.removeEventListener("mousemove", shMouse);
  window.removeEventListener("mousedown", shMouseDown);
  window.removeEventListener("mouseup", shMouseUp);
}
