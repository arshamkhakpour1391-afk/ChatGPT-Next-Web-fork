/* ================= لایهٔ ابری (Supabase) + ری‌تایم ================= */
import { createClient } from "@supabase/supabase-js";
import { nowMs, sleep } from "./util.js";

export const SUPABASE_URL = "https://baooyxmxzkzwimitjfjk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_n8EE3d9MUYK9ah_hdMi9kg_WhMsHKRI";

let sb = null;
let sessionToken = null;
let online = false;
let schemaOk = null;

const listeners = { chat: [], duelEvent: [], online: [], status: [], dm: [], voice: [], roomList: [] };
export function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); }; }
function emit(ev, data) { (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.warn(e); } }); }

function withTimeout(p, ms = 9000) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);
}
export function isOnline() { return online; }

export function initCloud() {
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    global: { headers: sessionToken ? { "x-session-token": sessionToken } : {} },
    realtime: { params: { eventsPerSecond: 20 } }
  });
}
export function setSession(token) {
  sessionToken = token || null;
  initCloud();
}
export function getSession() { return sessionToken; }

/* ---------- نصب دیتابیس ---------- */
export async function checkSchema() {
  if (!sb) initCloud();
  try {
    const ping = await withTimeout(sb.rpc("schema_ok"));
    if (!ping.error && ping.data === true) {
      schemaOk = true;
      return { ok: true, error: null };
    }
    const { error } = await withTimeout(sb.from("chat_rooms").select("id", { head: true, count: "exact" }));
    schemaOk = !error;
    return { ok: !error, error: error || ping.error };
  } catch (e) {
    schemaOk = false;
    return { ok: false, error: e };
  }
}
export function schemaReady() { return schemaOk === true; }

/* ---------- ثبت / ورود ---------- */
function unwrapRpc(data) {
  if (!data) return data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return { error: data }; }
  }
  if (Array.isArray(data)) data = data[0];
  return data;
}
export async function register(username, pass) {
  if (!sb) initCloud();
  try {
    const { data, error } = await withTimeout(sb.rpc("register", { p_username: username, p_pass: pass }), 2200);
    if (error) return { error: friendlyError(error) };
    const out = unwrapRpc(data);
    if (out && out.error) return { error: out.error };
    if (!out || !out.token) return { error: "پاسخ سرور ناقص بود — دوباره امتحان کن" };
    return out;
  } catch (e) {
    return { error: "اتصال به سرور برقرار نشد. اینترنت را چک کن." };
  }
}
export async function login(username, pass) {
  if (!sb) initCloud();
  if (!username || !pass) return { error: "نام کاربری و رمز را کامل بنویس" };
  try {
    const { data, error } = await withTimeout(sb.rpc("login", { p_username: username, p_pass: pass }), 2200);
    if (error) return { error: friendlyError(error) };
    const out = unwrapRpc(data);
    if (out && out.error) return { error: out.error };
    if (!out || !out.token) return { error: "پاسخ سرور ناقص بود — دوباره امتحان کن" };
    return out;
  } catch (e) {
    return { error: "اتصال به سرور برقرار نشد. اینترنت را چک کن." };
  }
}
export async function logoutCloud() {
  try { await withTimeout(sb.rpc("logout")); } catch (e) {}
  sessionToken = null;
  initCloud();
}
function friendlyError(e) {
  if (e && e.code === "PGRST205") return "دیتابیس هنوز نصب نشده. دکمهٔ «نصب دیتابیس» را بزن.";
  const msg = (e && e.message) ? String(e.message) : "";
  if (/offline|Failed to fetch|NetworkError|TIMEOUT/i.test(msg)) return "اتصال به سرور برقرار نشد. اینترنت را چک کن.";
  if (msg) return msg;
  return "خطای سرور";
}

/* ---------- ذخیره / بارگذاری ---------- */
export async function savePlayer(state, cols) {
  if (!sb || !cols || !cols.userId) return { ok: false };
  if (String(cols.userId).startsWith("loc_")) return { ok: false, error: "local-only" };
  const packed = state && typeof state === "object" ? { ...state, power: cols.power, hunterClass: cols.hunterClass } : {};
  try {
    const rpc = await withTimeout(sb.rpc("save_full_state", { p_data: packed }), 15000);
    if (!rpc.error && rpc.data && !rpc.data.error) {
      online = true;
      emit("status", { online: true });
      return { ok: true };
    }
    const { error } = await withTimeout(
      sb.from("players").upsert({
        user_id: cols.userId,
        username: cols.username,
        level: cols.level, xp: cols.xp, gold: cols.gold, gems: cols.gems,
        power: cols.power, wins: cols.wins, losses: cols.losses, kills: cols.kills,
        rank_pts: cols.rankPts, hunter_class: cols.hunterClass,
        data: packed, updated_at: new Date().toISOString(), last_seen: new Date().toISOString()
      }, { onConflict: "user_id" }),
      15000
    );
    online = !error;
    if (error) { emit("status", { online: false }); return { ok: false, error }; }
    emit("status", { online: true });
    return { ok: true };
  } catch (e) {
    online = false;
    emit("status", { online: false });
    return { ok: false, error: e };
  }
}
export async function loadPlayer(userId) {
  if (!sb) return { error: "no client" };
  try {
    const rpc = await withTimeout(sb.rpc("load_full_state"), 12000);
    if (!rpc.error && rpc.data && rpc.data.player) {
      online = true;
      return { player: rpc.data.player };
    }
    if (!userId || String(userId).startsWith("loc_")) return { player: rpc?.data?.player || null, error: rpc?.error };
    const { data, error } = await withTimeout(
      sb.from("players").select("*").eq("user_id", userId).maybeSingle()
    );
    online = !error;
    if (error) return { error };
    return { player: data };
  } catch (e) {
    online = false;
    return { error: e };
  }
}
export async function touchSeen(userId) {
  if (!sb) return;
  try {
    await withTimeout(sb.from("players").update({ last_seen: new Date().toISOString() }).eq("user_id", userId), 6000);
  } catch (e) {}
}

/* ---------- لیدربرد ---------- */
export async function leaderboard(kind, limit = 100) {
  try {
    const { data, error } = await withTimeout(sb.rpc("leaderboard", { p_kind: kind, p_lim: limit }));
    if (error) return { error };
    return { list: data };
  } catch (e) { return { error: e }; }
}
export async function myRank(kind) {
  try {
    const { data, error } = await withTimeout(sb.rpc("my_rank", { p_kind: kind }));
    if (error) return { error };
    return { rank: data };
  } catch (e) { return { error: e }; }
}
export async function onlinePlayers() {
  try {
    const { data, error } = await withTimeout(sb.rpc("online_players"));
    if (error) return { error };
    return { list: data };
  } catch (e) { return { error: e }; }
}

/* ---------- گروه‌ها و چت ---------- */
let chatChannel = null;
export async function listRooms() {
  try {
    const { data, error } = await withTimeout(sb.rpc("list_rooms"));
    if (error) return { error };
    emit("roomList", data || []);
    return { list: data || [] };
  } catch (e) { return { error: e }; }
}
export async function createRoom(name) {
  try {
    const { data, error } = await withTimeout(sb.rpc("create_room", { p_name: name }));
    if (error) return { error: friendlyError(error) };
    if (data && data.error) return { error: data.error };
    emit("roomList", await refreshRooms());
    return data;
  } catch (e) { return { error: "خطای شبکه" }; }
}
export async function joinRoom(id) {
  try {
    const { data, error } = await withTimeout(sb.rpc("join_room", { p_id: id }));
    if (error) return { error };
    if (data && data.error) return { error: data.error };
    return data;
  } catch (e) { return { error: "خطای شبکه" }; }
}
async function refreshRooms() {
  try {
    const { data } = await withTimeout(sb.rpc("list_rooms"));
    return data || [];
  } catch (e) { return []; }
}

export async function loadHistory(room, limit = 100) {
  try {
    const { data, error } = await withTimeout(
      sb.from("chat_messages").select("*").eq("room", room).order("id", { ascending: false }).limit(limit)
    );
    if (error) return { error };
    return { list: (data || []).reverse() };
  } catch (e) { return { error: e }; }
}
export async function sendMessage(room, username, userId, body, kind = "text") {
  if (!sb) return { ok: false };
  try {
    const { error } = await withTimeout(
      sb.from("chat_messages").insert({ room, username, user_id: userId, body, kind }), 9000
    );
    if (error) {
      // حالت جایگزین: برادکست
      broadcastRoom(room, { username, userId, body, kind, ts: nowMs(), local: true });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    broadcastRoom(room, { username, userId, body, kind, ts: nowMs(), local: true });
    return { ok: false };
  }
}
export function subscribeRoom(room) {
  if (!sb) return;
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) {} }
  chatChannel = sb
    .channel("chat-" + encodeURIComponent(room))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${room}` },
      (payload) => {
        if (payload.new && payload.new.user_id !== (window.__sls_userId || null)) {
          emit("chat", payload.new);
        }
      })
    .subscribe((status) => { if (status === "CHANNEL_ERROR") subscribeRoom(room); });
}

/* ---------- صدا (آپلود + برادکست زنده) ---------- */
export async function uploadVoice(blob, ext) {
  try {
    const path = `v-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext || "webm"}`;
    const { error } = await withTimeout(
      sb.storage.from("voice").upload(path, blob, { contentType: blob.type || "audio/webm" }), 20000
    );
    if (error) return { error };
    const { data } = sb.storage.from("voice").getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (e) { return { error: e }; }
}

/* ---------- برادکست ری‌تایم ---------- */
let liveChannels = {};
function getBroadcastChannel(name) {
  if (!sb) return null;
  if (!liveChannels[name]) {
    liveChannels[name] = sb.channel(name, { config: { broadcast: { self: false } } });
    liveChannels[name].subscribe();
  }
  return liveChannels[name];
}
export function broadcastRoom(room, payload) {
  const ch = getBroadcastChannel("room-" + encodeURIComponent(room));
  if (ch) ch.send({ type: "broadcast", event: "msg", payload });
}
export function onRoomBroadcast(room, fn) {
  const ch = getBroadcastChannel("room-" + encodeURIComponent(room));
  if (ch) ch.on("broadcast", { event: "msg" }, (e) => fn(e.payload));
  else fn = fn;
}
export function broadcastDuel(duelId, event, payload) {
  const ch = getBroadcastChannel("duel-" + duelId);
  if (ch) ch.send({ type: "broadcast", event, payload });
}
export function onDuelBroadcast(duelId, fn) {
  const ch = getBroadcastChannel("duel-" + duelId);
  if (ch) ch.on("broadcast", {}, (e) => fn(e.event, e.payload));
}
export function closeDuelChannel(duelId) {
  try { if (liveChannels["duel-" + duelId] && sb) sb.removeChannel(liveChannels["duel-" + duelId]); } catch (e) {}
  delete liveChannels["duel-" + duelId];
}
export function broadcastDM(targetUserId, payload) {
  const ch = getBroadcastChannel("dm-" + targetUserId);
  if (ch) ch.send({ type: "broadcast", event: "dm", payload });
}
export function listenDM(myUserId, fn) {
  const ch = getBroadcastChannel("dm-" + myUserId);
  if (ch) ch.on("broadcast", { event: "dm" }, (e) => fn(e.payload));
}
export function broadcastVoice(room, payload) {
  const ch = getBroadcastChannel("voice-" + encodeURIComponent(room));
  if (ch) ch.send({ type: "broadcast", event: "voice", payload });
}
export function onVoiceBroadcast(room, fn) {
  const ch = getBroadcastChannel("voice-" + encodeURIComponent(room));
  if (ch) ch.on("broadcast", { event: "voice" }, (e) => fn(e.payload));
}
export function broadcastMatch(payload) {
  const ch = getBroadcastChannel("matchmaking");
  if (ch) ch.send({ type: "broadcast", event: "match", payload });
}
export function onMatchBroadcast(fn) {
  const ch = getBroadcastChannel("matchmaking");
  if (ch) ch.on("broadcast", { event: "match" }, (e) => fn(e.payload));
}

/* ---------- حضور آنلاین ---------- */
let presenceChannel = null;
export function joinPresence(info) {
  if (!sb) return;
  if (!presenceChannel) {
    presenceChannel = sb.channel("online-presence", { config: { presence: { key: info.username } } });
    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const users = {};
      Object.values(state).forEach((arr) => {
        arr.forEach((p) => {
          if (p.user_id && p.user_id !== info.userId) users[p.user_id] = p;
        });
      });
      emit("online", Object.values(users));
    });
    presenceChannel.subscribe();
  }
  presenceChannel.track({
    user_id: info.userId, username: info.username, level: info.level,
    power: info.power, hunter_class: info.hunterClass, at: nowMs()
  });
}
export function leavePresence() {
  try { if (presenceChannel && sb) sb.removeChannel(presenceChannel); } catch (e) {}
  presenceChannel = null;
}
export function presenceList() {
  if (!presenceChannel) return [];
  const state = presenceChannel.presenceState();
  const out = [];
  Object.values(state).forEach((arr) => arr.forEach((p) => { if (p.user_id) out.push(p); }));
  return out;
}

/* ---------- دوئل (رکورد ابری) ---------- */
export async function createDuel(p1, p1name, mode) {
  try {
    const { data, error } = await withTimeout(
      sb.from("duels").insert({ p1, p1name, mode, status: "open" }).select().single()
    );
    if (error) return { error };
    return { duel: data };
  } catch (e) { return { error: e }; }
}
export async function updateDuel(id, patch) {
  try {
    const { error } = await withTimeout(sb.from("duels").update(patch).eq("id", id));
    if (error) return { error };
    return { ok: true };
  } catch (e) { return { error: e }; }
}
export async function openDuels() {
  try {
    const { data, error } = await withTimeout(
      sb.from("duels").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(30)
    );
    if (error) return { error };
    return { list: data };
  } catch (e) { return { error: e }; }
}
export function subscribeDuels(fn) {
  if (!sb) return;
  sb.channel("duels-feed")
    .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, (payload) => fn(payload))
    .subscribe();
}

/* ---------- ضربان قلب ---------- */
let heartbeatTimer = null;
export function startHeartbeat(userId) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => { touchSeen(userId); }, 45000);
}
export function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}
