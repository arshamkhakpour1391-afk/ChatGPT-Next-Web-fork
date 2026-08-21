-- ============================================================
--  سیستم سولو لولینگ — Schema (idempotent, safe to re-run)
--  ساخته‌شده برای: https://baooyxmxzkzwimitjfjk.supabase.co
--  ترتیب مهم است: اول جدول‌ها، بعد توابع، بعد RLS
-- ============================================================

-- اجازهٔ ارجاع توابع به جدول‌ها (محافظ اضافه)
set check_function_bodies = off;
create extension if not exists pgcrypto;

-- ============================================================
--  جدول‌ها
-- ============================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  passhash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  token text primary key,
  user_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on public.sessions(user_id);
create index if not exists sessions_exp_idx  on public.sessions(expires_at);

create table if not exists public.players (
  user_id      uuid primary key references public.accounts(id) on delete cascade,
  username     text not null,
  level        int    not null default 1,
  xp           bigint not null default 0,
  gold         bigint not null default 150,
  gems         int    not null default 3,
  power        bigint not null default 10,
  wins         int    not null default 0,
  losses       int    not null default 0,
  kills        bigint not null default 0,
  rank_pts     bigint not null default 1000,
  hunter_class text   not null default 'E',
  data         jsonb  not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null default 'عمومی',
  user_id uuid,
  username text not null,
  kind text not null default 'text',
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists chat_room_time_idx on public.chat_messages(room, id desc);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid references public.accounts(id) on delete set null,
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  p1 uuid not null,
  p1name text not null,
  p2 uuid,
  p2name text,
  mode text not null default 'click',
  status text not null default 'open',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists duels_status_idx on public.duels(status);
create index if not exists players_last_seen_idx on public.players(last_seen desc);
create index if not exists players_power_idx on public.players(power desc);
create index if not exists players_level_idx on public.players(level desc);

-- ============================================================
--  ممنوعیت تغییر نام کاربری (نام برای همیشه ثابت است)
-- ============================================================
create or replace function public.block_username_change()
returns trigger language plpgsql as $$
begin
  if new.username is distinct from old.username then
    raise exception 'نام کاربری قابل تغییر نیست';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_no_rename on public.accounts;
create trigger accounts_no_rename
before update of username on public.accounts
for each row execute function public.block_username_change();

drop trigger if exists players_no_rename on public.players;
create trigger players_no_rename
before update of username on public.players
for each row execute function public.block_username_change();

-- ============================================================
--  توابع
-- ============================================================

-- کاربر جاری از روی توکن هدر x-session-token
-- SECURITY DEFINER الزامی است وگرنه RLS روی sessions دوباره همین تابع را صدا می‌زند (خطای 54001)
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.sessions
  where token = coalesce(current_setting('request.headers', true)::json ->> 'x-session-token', '')
    and expires_at > now()
  limit 1;
$$;

create or replace function public.register(p_username text, p_pass text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_token text;
begin
  p_username := trim(lower(p_username));
  if p_username is null or length(p_username) < 3 or length(p_username) > 20 then
    return json_build_object('error', 'نام کاربری باید بین ۳ تا ۲۰ حرف باشد');
  end if;
  if p_username !~ '^[a-z0-9_]+$' then
    return json_build_object('error', 'نام کاربری فقط حروف انگلیسی، عدد و _');
  end if;
  if p_pass is null or length(p_pass) < 4 or length(p_pass) > 64 then
    return json_build_object('error', 'رمز عبور باید بین ۴ تا ۶۴ کاراکتر باشد');
  end if;
  if exists (select 1 from public.accounts where username = p_username) then
    return json_build_object('error', 'این نام کاربری از قبل ثبت شده است');
  end if;

  insert into public.accounts (username, passhash)
  values (p_username, crypt(p_pass, gen_salt('bf', 10)))
  returning id into v_id;

  insert into public.players (user_id, username) values (v_id, p_username);

  v_token := replace(gen_random_uuid()::text, '-', '') || md5(random()::text);
  insert into public.sessions (token, user_id, expires_at)
  values (v_token, v_id, now() + interval '365 days');

  delete from public.sessions
  where user_id = v_id and expires_at <= now();

  return json_build_object(
    'token', v_token,
    'user_id', v_id,
    'username', p_username,
    'player', row_to_json(p)::jsonb
  ) from public.players p where p.user_id = v_id;
end;
$$;

create or replace function public.login(p_username text, p_pass text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_token text;
  v_hash text;
  v_legacy text;
begin
  p_username := trim(lower(p_username));
  if p_username is null or p_pass is null then
    return json_build_object('error', 'نام کاربری یا رمز عبور اشتباه است');
  end if;
  select id, passhash into v_id, v_hash from public.accounts where username = p_username;
  if v_id is null then
    return json_build_object('error', 'نام کاربری یا رمز عبور اشتباه است');
  end if;
  v_legacy := encode(sha256(convert_to(p_pass || '::' || p_username, 'UTF8')), 'hex');
  if v_hash like '$2%' then
    if crypt(p_pass, v_hash) is distinct from v_hash then
      return json_build_object('error', 'نام کاربری یا رمز عبور اشتباه است');
    end if;
  elsif v_hash is distinct from v_legacy then
    return json_build_object('error', 'نام کاربری یا رمز عبور اشتباه است');
  else
    update public.accounts set passhash = crypt(p_pass, gen_salt('bf', 10)) where id = v_id;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || md5(random()::text);
  insert into public.sessions (token, user_id, expires_at)
  values (v_token, v_id, now() + interval '365 days');

  delete from public.sessions
  where user_id = v_id and expires_at <= now();

  return json_build_object(
    'token', v_token,
    'user_id', v_id,
    'username', p_username,
    'player', row_to_json(p)::jsonb
  ) from public.players p where p.user_id = v_id;
end;
$$;

create or replace function public.logout()
returns void language sql security definer set search_path = public as $$
  delete from public.sessions
  where token = coalesce(current_setting('request.headers', true)::json ->> 'x-session-token', '');
$$;

create or replace function public.leaderboard(p_kind text default 'power', p_lim int default 100)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', username,
    'level', level,
    'xp', xp,
    'gold', gold,
    'power', power,
    'wins', wins,
    'losses', losses,
    'rank_pts', rank_pts,
    'hunter_class', hunter_class,
    'last_seen', last_seen
  )
  from public.players
  where last_seen > now() - interval '90 days'
  order by
    case p_kind
      when 'power'  then power
      when 'level'  then level
      when 'xp'     then xp
      when 'wins'   then wins
      when 'rank'   then rank_pts
      else power
    end desc,
    username asc
  limit greatest(least(p_lim, 500), 1);
$$;

create or replace function public.my_rank(p_kind text default 'power')
returns int language sql stable security definer set search_path = public as $$
  select cnt::int from (
    select count(*) + 1 as cnt
    from public.players q
    where case p_kind
        when 'power' then q.power
        when 'level' then q.level
        when 'xp'    then q.xp
        when 'wins'  then q.wins
        when 'rank'  then q.rank_pts
        else q.power
      end >
      case p_kind
        when 'power' then (select power from public.players where user_id = public.current_user_id())
        when 'level' then (select level from public.players where user_id = public.current_user_id())
        when 'xp'    then (select xp    from public.players where user_id = public.current_user_id())
        when 'wins'  then (select wins  from public.players where user_id = public.current_user_id())
        when 'rank'  then (select rank_pts from public.players where user_id = public.current_user_id())
        else (select power from public.players where user_id = public.current_user_id())
      end
  ) s;
$$;

create or replace function public.online_players()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', user_id,
    'username', username,
    'level', level,
    'power', power,
    'hunter_class', hunter_class,
    'last_seen', last_seen
  )
  from public.players
  where last_seen > now() - interval '2 minutes'
    and user_id <> public.current_user_id()
  order by power desc
  limit 200;
$$;

create or replace function public.list_rooms()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'name', name, 'owner', owner, 'members', members, 'created_at', created_at
  ) from public.chat_rooms order by created_at desc limit 100;
$$;

create or replace function public.create_room(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_user uuid := public.current_user_id();
begin
  if v_user is null then
    return json_build_object('error', 'ابتدا وارد شوید');
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 40 then
    return json_build_object('error', 'نام گروه باید بین ۲ تا ۴۰ حرف باشد');
  end if;
  if exists (select 1 from public.chat_rooms where name = trim(p_name)) then
    return json_build_object('error', 'گروهی با این نام وجود دارد');
  end if;
  insert into public.chat_rooms (id, name, owner, members)
  values (v_id, trim(p_name), v_user, jsonb_build_array(v_user));
  return json_build_object('id', v_id, 'name', trim(p_name), 'owner', v_user, 'members', jsonb_build_array(v_user));
end;
$$;

create or replace function public.join_room(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.current_user_id();
begin
  if v_user is null then
    return json_build_object('error', 'ابتدا وارد شوید');
  end if;
  update public.chat_rooms
  set members = members || jsonb_build_array(v_user)
  where id = p_id
    and not members @> jsonb_build_array(v_user);
  return json_build_object('ok', true);
end;
$$;

-- ============================================================
--  RLS (امنیت)
-- ============================================================
alter table public.players enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.duels enable row level security;
alter table public.sessions enable row level security;
alter table public.accounts enable row level security;

drop policy if exists players_sel on public.players;
create policy players_sel on public.players
  for select to anon, authenticated
  using (user_id = public.current_user_id());

drop policy if exists players_ins on public.players;
create policy players_ins on public.players
  for insert to anon, authenticated
  with check (user_id = public.current_user_id());

drop policy if exists players_upd on public.players;
create policy players_upd on public.players
  for update to anon, authenticated
  using (user_id = public.current_user_id());

drop policy if exists accounts_sel on public.accounts;
create policy accounts_sel on public.accounts
  for select to anon, authenticated
  using (id = public.current_user_id());

drop policy if exists sessions_sel on public.sessions;
create policy sessions_sel on public.sessions
  for select to anon, authenticated
  using (user_id = public.current_user_id());

-- چت: خواندن عمومی، نوشتن فقط برای خود کاربر
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages
  for select to anon, authenticated using (true);

drop policy if exists chat_write on public.chat_messages;
create policy chat_write on public.chat_messages
  for insert to anon, authenticated
  with check (user_id = public.current_user_id());

drop policy if exists rooms_read on public.chat_rooms;
create policy rooms_read on public.chat_rooms
  for select to anon, authenticated using (true);

drop policy if exists rooms_write on public.chat_rooms;
create policy rooms_write on public.chat_rooms
  for insert to anon, authenticated
  with check (owner = public.current_user_id());

drop policy if exists rooms_upd on public.chat_rooms;
create policy rooms_upd on public.chat_rooms
  for update to anon, authenticated
  using (owner = public.current_user_id() or members @> jsonb_build_array(public.current_user_id()));

-- دوئل‌ها: خواندن عمومی، نوشتن برای خود کاربر
drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels
  for select to anon, authenticated using (true);

drop policy if exists duels_write on public.duels;
create policy duels_write on public.duels
  for insert to anon, authenticated
  with check (p1 = public.current_user_id());

drop policy if exists duels_upd on public.duels;
create policy duels_upd on public.duels
  for update to anon, authenticated
  using (p1 = public.current_user_id() or p2 = public.current_user_id());

-- ============================================================
--  Realtime
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.duels;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_rooms;
exception when duplicate_object then null;
end $$;

-- ============================================================
--  Storage: پیام‌های صوتی
-- ============================================================
insert into storage.buckets (id, name, public)
values ('voice', 'voice', true)
on conflict (id) do nothing;

drop policy if exists voice_insert on storage.objects;
create policy voice_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'voice');

drop policy if exists voice_select on storage.objects;
create policy voice_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'voice');

-- ============================================================
--  سلامت دیتابیس (برای دکمهٔ بررسی)
-- ============================================================
create or replace function public.schema_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'accounts');
$$;

-- ذخیرهٔ کامل وضعیت (مهارت، سایه، آیتم، آمار، ماموریت — بدون سقف ستون)
create or replace function public.save_full_state(p_data jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.current_user_id();
  v_lvl int;
  v_xp bigint;
  v_gold bigint;
  v_gems int;
  v_power bigint;
  v_wins int;
  v_losses int;
  v_kills bigint;
  v_rank bigint;
  v_class text;
  v_name text;
  v_prev_lvl int;
  v_prev_gold bigint;
  v_prev_gems int;
  v_prev_wins int;
  v_prev_power bigint;
  v_last timestamptz;
begin
  if v_user is null then
    return json_build_object('error', 'ابتدا وارد شوید');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return json_build_object('error', 'داده نامعتبر است');
  end if;
  v_lvl := least(10000, greatest(1, coalesce(nullif(p_data->>'level','')::int, 1)));
  v_xp := least(1000000000000::bigint, greatest(0, coalesce(nullif(p_data->>'xp','')::bigint, 0)));
  v_gold := least(1000000000000::bigint, greatest(0, coalesce(nullif(p_data->>'gold','')::bigint, 0)));
  v_gems := least(1000000, greatest(0, coalesce(nullif(p_data->>'gems','')::int, 0)));
  v_power := least(500000000000::bigint, greatest(0, coalesce(nullif(p_data->>'power','')::bigint, 0)));
  v_wins := least(1000000, greatest(0, coalesce(nullif((p_data->'stats'->>'wins'),'')::int, 0)));
  v_losses := least(1000000, greatest(0, coalesce(nullif((p_data->'stats'->>'losses'),'')::int, 0)));
  v_kills := least(1000000000::bigint, greatest(0, coalesce(nullif((p_data->'stats'->>'kills'),'')::bigint, 0)));
  v_rank := least(1000000000::bigint, greatest(0, coalesce(nullif(p_data->>'rank_pts','')::bigint, 1000)));
  v_class := left(coalesce(p_data->>'hunterClass', 'E'), 40);
  select username, level, gold, gems, wins, power, last_seen
    into v_name, v_prev_lvl, v_prev_gold, v_prev_gems, v_prev_wins, v_prev_power, v_last
    from public.players where user_id = v_user;
  if v_last is not null and now() - v_last < interval '700 milliseconds' then
    update public.players set last_seen = now() where user_id = v_user;
    return json_build_object('ok', true, 'throttled', true, 'server_ms', (extract(epoch from now())*1000)::bigint);
  end if;
  if v_prev_lvl is not null then
    if v_lvl > v_prev_lvl + 80 then v_lvl := v_prev_lvl + 80; end if;
    if v_gold > v_prev_gold + 50000000 then v_gold := v_prev_gold + 50000000; end if;
    if v_gems > v_prev_gems + 80 then v_gems := v_prev_gems + 80; end if;
    if v_wins > v_prev_wins + 25 then v_wins := v_prev_wins + 25; end if;
  end if;
  if v_power > (v_lvl::bigint * 200000 + 50000000) then
    v_power := v_lvl::bigint * 200000 + 50000000;
  end if;
  update public.players set
    data = p_data,
    level = v_lvl,
    xp = v_xp,
    gold = v_gold,
    gems = v_gems,
    power = case when v_power > 0 then v_power else power end,
    wins = v_wins,
    losses = v_losses,
    kills = v_kills,
    rank_pts = v_rank,
    hunter_class = v_class,
    updated_at = now(),
    last_seen = now()
  where user_id = v_user;
  if not found then
    insert into public.players (user_id, username, level, xp, gold, gems, power, wins, losses, kills, rank_pts, hunter_class, data)
    values (v_user, coalesce(v_name, p_data->>'username', 'hunter'), v_lvl, v_xp, v_gold, v_gems, v_power, v_wins, v_losses, v_kills, v_rank, v_class, p_data);
  end if;
  return json_build_object('ok', true, 'updated_at', now(), 'server_ms', (extract(epoch from now())*1000)::bigint);
end;
$$;

create or replace function public.load_full_state()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.current_user_id();
  v_row public.players%rowtype;
begin
  if v_user is null then
    return json_build_object('error', 'ابتدا وارد شوید');
  end if;
  select * into v_row from public.players where user_id = v_user;
  if not found then
    return json_build_object('player', null);
  end if;
  return json_build_object('player', row_to_json(v_row));
end;
$$;

-- ============================================================
--  دوستی، اعلان، لابی FFA (تا ۱۰۰ نفر)
-- ============================================================
create table if not exists public.friends (
  user_id uuid not null references public.accounts(id) on delete cascade,
  friend_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create index if not exists friends_friend_idx on public.friends(friend_id);

create table if not exists public.notifs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifs_user_idx on public.notifs(user_id, id desc);

create table if not exists public.ffa_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'open',
  max_players int not null default 100,
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ffa_status_idx on public.ffa_rooms(status);

alter table public.friends enable row level security;
alter table public.notifs enable row level security;
alter table public.ffa_rooms enable row level security;

drop policy if exists friends_sel on public.friends;
create policy friends_sel on public.friends for select to anon, authenticated
  using (user_id = public.current_user_id() or friend_id = public.current_user_id());
drop policy if exists friends_ins on public.friends;
create policy friends_ins on public.friends for insert to anon, authenticated
  with check (user_id = public.current_user_id());
drop policy if exists friends_upd on public.friends;
create policy friends_upd on public.friends for update to anon, authenticated
  using (user_id = public.current_user_id() or friend_id = public.current_user_id());

drop policy if exists notifs_sel on public.notifs;
create policy notifs_sel on public.notifs for select to anon, authenticated
  using (user_id = public.current_user_id());
drop policy if exists notifs_upd on public.notifs;
create policy notifs_upd on public.notifs for update to anon, authenticated
  using (user_id = public.current_user_id());

drop policy if exists ffa_sel on public.ffa_rooms;
create policy ffa_sel on public.ffa_rooms for select to anon, authenticated using (true);
drop policy if exists ffa_ins on public.ffa_rooms;
create policy ffa_ins on public.ffa_rooms for insert to anon, authenticated
  with check (owner = public.current_user_id());
drop policy if exists ffa_upd on public.ffa_rooms;
create policy ffa_upd on public.ffa_rooms for update to anon, authenticated
  using (owner = public.current_user_id() or members @> jsonb_build_array(public.current_user_id()));

create or replace function public.push_notif(p_user uuid, p_kind text, p_title text, p_body text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifs (user_id, kind, title, body, payload) values (p_user, coalesce(p_kind,'info'), coalesce(p_title,''), coalesce(p_body,''), coalesce(p_payload,'{}'::jsonb));
end;
$$;

create or replace function public.friend_request(p_username text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_other uuid;
  v_myname text;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  p_username := trim(lower(p_username));
  select id into v_other from public.accounts where username = p_username;
  if v_other is null then return json_build_object('error', 'این نام کاربری پیدا نشد'); end if;
  if v_other = v_me then return json_build_object('error', 'نمی‌توانی خودت را اضافه کنی'); end if;
  insert into public.friends (user_id, friend_id, status) values (v_me, v_other, 'pending')
  on conflict (user_id, friend_id) do nothing;
  select username into v_myname from public.players where user_id = v_me;
  perform public.push_notif(v_other, 'friend', 'درخواست دوستی', coalesce(v_myname,'شکارچی') || ' می‌خواهد دوستت شود', jsonb_build_object('from', v_me));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.friend_accept(p_user uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  update public.friends set status = 'accepted' where user_id = p_user and friend_id = v_me;
  insert into public.friends (user_id, friend_id, status) values (v_me, p_user, 'accepted')
  on conflict (user_id, friend_id) do update set status = 'accepted';
  perform public.push_notif(p_user, 'friend', 'دوستی قبول شد', 'حالا می‌توانید با هم نبرد آزاد بازی کنید', '{}'::jsonb);
  return json_build_object('ok', true);
end;
$$;

create or replace function public.friend_list()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'username', p.username, 'level', p.level, 'power', p.power,
    'status', f.status, 'last_seen', p.last_seen
  )
  from public.friends f
  join public.players p on p.user_id = f.friend_id
  where f.user_id = public.current_user_id()
  order by f.status desc, p.last_seen desc
  limit 200;
$$;

create or replace function public.notif_list()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'kind', kind, 'title', title, 'body', body, 'payload', payload, 'read', read, 'created_at', created_at)
  from public.notifs where user_id = public.current_user_id()
  order by id desc limit 80;
$$;

create or replace function public.notif_read_all()
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.notifs set read = true where user_id = public.current_user_id() and read = false;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.ffa_create(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_code text;
  v_id uuid := gen_random_uuid();
  v_name text;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  v_name := coalesce(nullif(trim(p_name), ''), 'نبرد آزاد');
  v_code := upper(substr(replace(v_id::text, '-', ''), 1, 6));
  insert into public.ffa_rooms (id, code, name, owner, members)
  values (v_id, v_code, v_name, v_me, jsonb_build_array(v_me));
  return json_build_object('ok', true, 'id', v_id, 'code', v_code, 'name', v_name);
end;
$$;

create or replace function public.ffa_join(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_row public.ffa_rooms%rowtype;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  select * into v_row from public.ffa_rooms where code = upper(trim(p_code)) and status = 'open';
  if not found then return json_build_object('error', 'لابی پیدا نشد یا بسته است'); end if;
  if jsonb_array_length(v_row.members) >= v_row.max_players then
    return json_build_object('error', 'لابی پر است (۱۰۰ نفر)');
  end if;
  update public.ffa_rooms set members = members || jsonb_build_array(v_me)
  where id = v_row.id and not members @> jsonb_build_array(v_me);
  return json_build_object('ok', true, 'id', v_row.id, 'code', v_row.code, 'name', v_row.name);
end;
$$;

create or replace function public.ffa_invite(p_code text, p_username text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_other uuid;
  v_myname text;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  select id into v_other from public.accounts where username = trim(lower(p_username));
  if v_other is null then return json_build_object('error', 'بازیکن پیدا نشد'); end if;
  select username into v_myname from public.players where user_id = v_me;
  perform public.push_notif(v_other, 'ffa', 'دعوت نبرد آزاد', coalesce(v_myname,'شکارچی') || ' تو را به لابی ' || upper(trim(p_code)) || ' دعوت کرد', jsonb_build_object('code', upper(trim(p_code))));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.ffa_list()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'code', code, 'name', name, 'owner', owner, 'status', status,
    'count', jsonb_array_length(members), 'max_players', max_players, 'created_at', created_at
  )
  from public.ffa_rooms where status = 'open' and created_at > now() - interval '6 hours'
  order by created_at desc limit 40;
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.ffa_rooms;
exception when duplicate_object then null;
end $$;


create or replace function public.finish_duel(p_id uuid, p_winner uuid, p_scores jsonb default '{}'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_row public.duels%rowtype;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_id is null then return json_build_object('error', 'شناسه نامعتبر'); end if;
  select * into v_row from public.duels where id = p_id;
  if not found then return json_build_object('error', 'مبارزه پیدا نشد'); end if;
  if v_row.p1 is distinct from v_me and v_row.p2 is distinct from v_me then
    return json_build_object('error', 'این مبارزه مال تو نیست');
  end if;
  if v_row.status = 'done' then
    return json_build_object('ok', true, 'already', true, 'result', v_row.result);
  end if;
  if v_row.status not in ('starting', 'challenged', 'open') then
    return json_build_object('error', 'وضعیت مبارزه قابل پایان نیست');
  end if;
  if p_winner is not null and p_winner is distinct from v_row.p1 and p_winner is distinct from v_row.p2 then
    return json_build_object('error', 'برنده نامعتبر است');
  end if;
  perform set_config('app.finish_duel', '1', true);
  update public.duels set
    status = 'done',
    result = jsonb_build_object('winner', p_winner, 'scores', coalesce(p_scores, '{}'::jsonb), 'srv', 'ok', 'finishedAt', now())
  where id = p_id and status is distinct from 'done';
  if p_winner is not null then
    update public.players set wins = wins + 1, last_seen = now() where user_id = p_winner;
    update public.players set losses = losses + 1, last_seen = now()
      where user_id in (v_row.p1, v_row.p2) and user_id is distinct from p_winner;
  end if;
  return json_build_object('ok', true, 'winner', p_winner, 'result', jsonb_build_object('winner', p_winner, 'scores', coalesce(p_scores, '{}'::jsonb), 'srv', 'ok'));
end;
$$;

create or replace function public.duel_no_fake_finish()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    if current_setting('app.finish_duel', true) is distinct from '1' then
      raise exception 'نتیجه دوئل فقط از سرور ثبت می‌شود';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists duels_no_fake on public.duels;
create trigger duels_no_fake
before update of status, result on public.duels
for each row execute function public.duel_no_fake_finish();


create or replace function public.update_duel(p_id uuid, p_status text default null, p_p2 uuid default null, p_p2name text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_row public.duels%rowtype;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  select * into v_row from public.duels where id = p_id;
  if not found then return json_build_object('error', 'مبارزه پیدا نشد'); end if;
  if v_row.p1 is distinct from v_me and v_row.p2 is distinct from v_me and v_row.p2 is not null then
    return json_build_object('error', 'این مبارزه مال تو نیست');
  end if;
  if v_row.status = 'done' then return json_build_object('error', 'مبارزه تمام شده'); end if;
  if p_status = 'done' then return json_build_object('error', 'پایان فقط از finish_duel'); end if;
  if p_status is not null and p_status not in ('open','challenged','starting','declined') then
    return json_build_object('error', 'وضعیت نامعتبر');
  end if;
  if v_row.p1 = v_me then
    update public.duels set
      p2 = coalesce(p_p2, p2),
      p2name = coalesce(p_p2name, p2name),
      status = coalesce(p_status, status)
    where id = p_id and status is distinct from 'done';
  elsif v_row.p2 = v_me then
    if p_status not in ('starting','declined') then
      return json_build_object('error', 'فقط قبول یا رد');
    end if;
    update public.duels set status = p_status where id = p_id and status is distinct from 'done';
  else
    return json_build_object('error', 'اجازه نداری');
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.chat_set_username()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if new.user_id is null then raise exception 'شناسه کاربر لازم است'; end if;
  select username into v_name from public.players where user_id = new.user_id;
  if v_name is null then raise exception 'حساب پیدا نشد'; end if;
  new.username := v_name;
  return new;
end;
$$;
drop trigger if exists chat_username_fill on public.chat_messages;
create trigger chat_username_fill
before insert on public.chat_messages
for each row execute function public.chat_set_username();

-- ============================================================
--  Grants
-- ============================================================
grant usage on schema public to anon, authenticated;
grant execute on function public.schema_ok() to anon, authenticated;
grant execute on function public.register(text, text) to anon, authenticated;
grant execute on function public.login(text, text) to anon, authenticated;
grant execute on function public.logout() to anon, authenticated;
grant execute on function public.leaderboard(text, int) to anon, authenticated;
grant execute on function public.my_rank(text) to anon, authenticated;
grant execute on function public.online_players() to anon, authenticated;
grant execute on function public.list_rooms() to anon, authenticated;
grant execute on function public.create_room(text) to anon, authenticated;
grant execute on function public.join_room(uuid) to anon, authenticated;
grant execute on function public.current_user_id() to anon, authenticated;
grant execute on function public.save_full_state(jsonb) to anon, authenticated;
grant execute on function public.load_full_state() to anon, authenticated;
grant execute on function public.push_notif(uuid, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.friend_request(text) to anon, authenticated;
grant execute on function public.friend_accept(uuid) to anon, authenticated;
grant execute on function public.friend_list() to anon, authenticated;
grant execute on function public.notif_list() to anon, authenticated;
grant execute on function public.notif_read_all() to anon, authenticated;
grant execute on function public.ffa_create(text) to anon, authenticated;
grant execute on function public.ffa_join(text) to anon, authenticated;
grant execute on function public.ffa_invite(text, text) to anon, authenticated;
grant execute on function public.ffa_list() to anon, authenticated;
create or replace function public.touch_seen()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.current_user_id();
begin
  if v_user is null then
    return json_build_object('error', 'ابتدا وارد شوید');
  end if;
  update public.players set last_seen = now() where user_id = v_user;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.finish_duel(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.update_duel(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.touch_seen() to anon, authenticated;
grant select, insert on public.players to anon, authenticated;
revoke update on public.players from anon, authenticated;
revoke select on public.accounts from anon, authenticated;
revoke select on public.sessions from anon, authenticated;
grant select, insert on public.chat_messages to anon, authenticated;
grant select, insert on public.chat_rooms to anon, authenticated;
revoke update on public.chat_rooms from anon, authenticated;
grant select, insert on public.duels to anon, authenticated;
revoke update on public.duels from anon, authenticated;
grant select, insert on public.friends to anon, authenticated;
revoke update on public.friends from anon, authenticated;
grant select, insert on public.notifs to anon, authenticated;
revoke update on public.notifs from anon, authenticated;
grant select, insert on public.ffa_rooms to anon, authenticated;
revoke update on public.ffa_rooms from anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- تازه‌سازی کش PostgREST
notify pgrst, 'reload schema';
-- اقتصاد سروری: طلا از Save نمی‌آید. claim_id + سقف ساعتی + rate limit
set check_function_bodies = off;

create table if not exists public.reward_claims (
  user_id uuid not null references public.accounts(id) on delete cascade,
  claim_id text not null,
  kind text not null,
  gold bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_id)
);
create index if not exists reward_claims_user_time on public.reward_claims(user_id, created_at desc);
alter table public.reward_claims enable row level security;

create table if not exists public.rate_buckets (
  user_id uuid not null references public.accounts(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  n bigint not null default 0,
  gold bigint not null default 0,
  primary key (user_id, bucket)
);
alter table public.rate_buckets enable row level security;

create or replace function public._xp_need(p_level int)
returns bigint language sql immutable as $$
  select greatest(1, floor(30 * power(greatest(1, least(10000, p_level))::numeric, 2.35))::bigint);
$$;

create or replace function public._hourly_gold_cap(p_level int)
returns bigint language plpgsql immutable as $$
declare lv int := greatest(1, least(10000, coalesce(p_level, 1)));
begin
  return (4800 / 4) * greatest(1, floor(1 + lv * 0.2))::bigint + 500 + lv * 40 + 2000000;
end;
$$;

create or replace function public._rate_ok(p_user uuid, p_bucket text, p_add bigint, p_gold bigint, p_window interval, p_ncap bigint, p_gcap bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.rate_buckets%rowtype;
begin
  insert into public.rate_buckets(user_id, bucket, window_start, n, gold)
  values (p_user, p_bucket, now(), 0, 0)
  on conflict (user_id, bucket) do nothing;
  select * into r from public.rate_buckets where user_id = p_user and bucket = p_bucket for update;
  if now() - r.window_start > p_window then
    update public.rate_buckets set window_start = now(), n = p_add, gold = p_gold
      where user_id = p_user and bucket = p_bucket;
    return true;
  end if;
  if r.n + p_add > p_ncap or r.gold + p_gold > p_gcap then
    return false;
  end if;
  update public.rate_buckets set n = n + p_add, gold = gold + p_gold
    where user_id = p_user and bucket = p_bucket;
  return true;
end;
$$;

create or replace function public._add_xp_level(p_user uuid, p_xp bigint)
returns void language plpgsql security definer set search_path = public as $$
declare lv int; xp bigint; need bigint; guard int := 0;
begin
  select level, players.xp into lv, xp from public.players where user_id = p_user;
  xp := least(1000000000000::bigint, greatest(0, xp + greatest(0, p_xp)));
  while lv < 10000 and xp >= public._xp_need(lv) and guard < 200 loop
    xp := xp - public._xp_need(lv);
    lv := lv + 1;
    guard := guard + 1;
    if lv % 10 = 0 then
      update public.players set gems = least(1000000, gems + 2) where user_id = p_user;
    end if;
  end loop;
  update public.players set level = lv, xp = xp where user_id = p_user;
end;
$$;

create or replace function public.apply_play(p_kind text, p_claim_id text, p_n int default 0, p_index int default 0)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_lv int;
  v_gold bigint := 0;
  v_xp bigint := 0;
  v_per int;
  v_dlev int;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_claim_id is null or length(p_claim_id) < 8 or length(p_claim_id) > 80 or p_claim_id !~ '^[a-zA-Z0-9:_-]+$' then
    return json_build_object('error', 'claim_id نامعتبر');
  end if;
  if exists (select 1 from public.reward_claims where user_id = v_me and claim_id = p_claim_id) then
    return json_build_object('ok', true, 'already', true);
  end if;
  select level into v_lv from public.players where user_id = v_me;
  v_lv := greatest(1, least(10000, coalesce(v_lv, 1)));
  if p_kind = 'train' then
    p_n := greatest(0, least(120, coalesce(p_n, 0)));
    if p_n < 1 then return json_build_object('error', 'کلیک نامعتبر'); end if;
    if not public._rate_ok(v_me, 'train_h', p_n, 0, interval '1 hour', 4800, 100000000) then
      return json_build_object('error', 'سقف کلیک ساعتی');
    end if;
    if not public._rate_ok(v_me, 'train_burst', 1, 0, interval '400 milliseconds', 1, 1) then
      return json_build_object('error', 'خیلی سریع');
    end if;
    v_per := greatest(1, floor(1 + v_lv * 0.2)::int);
    v_gold := (p_n / 4) * v_per;
    v_xp := p_n;
  elsif p_kind in ('dungeon', 'sweep') then
    p_index := greatest(0, least(9999, coalesce(p_index, 0)));
    v_dlev := least(10000, p_index + 1);
    if v_lv < v_dlev then return json_build_object('error', 'سطح کافی نیست'); end if;
    if not public._rate_ok(v_me, 'dungeon_h', 1, 0, interval '1 hour', 24, 100000000) then
      return json_build_object('error', 'سقف دانجن ساعتی');
    end if;
    v_gold := least(800000, floor(28 * power(v_dlev::numeric, 1.8) * 2)::bigint);
    v_xp := floor(v_gold * 1.4);
    if p_kind = 'sweep' then v_gold := floor(v_gold * 0.72); v_xp := floor(v_xp * 0.72); end if;
  elsif p_kind = 'boss' then
    p_index := greatest(0, least(9999, coalesce(p_index, 0)));
    v_dlev := least(10000, p_index + 1);
    if v_lv + 15 < v_dlev then return json_build_object('error', 'سطح کافی نیست'); end if;
    if not public._rate_ok(v_me, 'boss_h', 1, 0, interval '1 hour', 40, 100000000) then
      return json_build_object('error', 'سقف باس ساعتی');
    end if;
    v_gold := least(1200000, floor(60 * power(v_dlev::numeric, 1.85) * 2)::bigint);
    v_xp := floor(v_gold * 1.3);
  else
    return json_build_object('error', 'نوع نامعتبر');
  end if;
  if v_gold < 0 or v_xp < 0 then return json_build_object('error', 'مقدار نامعتبر'); end if;
  if not public._rate_ok(v_me, 'gold_h', 0, v_gold, interval '1 hour', 100000000, public._hourly_gold_cap(v_lv)) then
    return json_build_object('error', 'سقف ساعتی طلا');
  end if;
  insert into public.reward_claims(user_id, claim_id, kind, gold) values (v_me, p_claim_id, p_kind, v_gold);
  update public.players set gold = least(1000000000000::bigint, gold + v_gold), last_seen = now() where user_id = v_me;
  perform public._add_xp_level(v_me, v_xp);
  return json_build_object('ok', true, 'gold', v_gold, 'xp', v_xp, 'player', row_to_json(p))
    from public.players p where p.user_id = v_me;
end;
$$;

create or replace function public.claim_reward(p_kind text, p_claim_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_lv int;
  v_gold bigint := 0;
  v_xp bigint := 0;
  v_gems int := 0;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_claim_id is null or length(p_claim_id) < 8 or length(p_claim_id) > 80 or p_claim_id !~ '^[a-zA-Z0-9:_-]+$' then
    return json_build_object('error', 'claim_id نامعتبر');
  end if;
  if exists (select 1 from public.reward_claims where user_id = v_me and claim_id = p_claim_id) then
    return json_build_object('ok', true, 'already', true);
  end if;
  select level into v_lv from public.players where user_id = v_me;
  v_lv := greatest(1, least(10000, coalesce(v_lv, 1)));
  if p_kind = 'mission' then
    v_gold := (120 + 300) * (1 + (v_lv / 80)) * 2;
    v_xp := 200 + v_lv * 8;
  elsif p_kind = 'daily' then
    v_gold := 200 + v_lv * 40; v_gems := 1; v_xp := 300 + v_lv * 60;
  elsif p_kind = 'year' then
    v_gold := 300 + v_lv * 25; v_gems := 1; v_xp := 500 + v_lv * 40;
  elsif p_kind = 'login' then
    v_gold := 80 + 25 + v_lv * 10; v_xp := 120 + 20 + v_lv * 8;
  elsif p_kind = 'duel' then
    v_gold := 100 + v_lv * 35;
  else
    return json_build_object('error', 'نوع نامعتبر');
  end if;
  if not public._rate_ok(v_me, 'claim_h', 1, v_gold, interval '1 hour', 80, public._hourly_gold_cap(v_lv) * 2) then
    return json_build_object('error', 'سقف ساعتی جایزه');
  end if;
  insert into public.reward_claims(user_id, claim_id, kind, gold) values (v_me, p_claim_id, p_kind, v_gold);
  update public.players set
    gold = least(1000000000000::bigint, gold + v_gold),
    gems = least(1000000, gems + v_gems),
    last_seen = now()
  where user_id = v_me;
  perform public._add_xp_level(v_me, v_xp);
  return json_build_object('ok', true, 'gold', v_gold, 'gems', v_gems, 'xp', v_xp, 'player', row_to_json(p))
    from public.players p where p.user_id = v_me;
end;
$$;

create or replace function public.purchase_item(p_item_id bigint, p_gold int, p_gems int, p_claim_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_g bigint;
  v_ge int;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_claim_id is null or length(p_claim_id) < 8 or p_claim_id !~ '^[a-zA-Z0-9:_-]+$' then
    return json_build_object('error', 'claim_id نامعتبر');
  end if;
  if exists (select 1 from public.reward_claims where user_id = v_me and claim_id = p_claim_id) then
    return json_build_object('ok', true, 'already', true);
  end if;
  p_gold := greatest(0, coalesce(p_gold, 0));
  p_gems := greatest(0, coalesce(p_gems, 0));
  if p_gold <= 0 and p_gems <= 0 then return json_build_object('error', 'قیمت نامعتبر'); end if;
  if p_gold > 50000000 or p_gems > 500 then return json_build_object('error', 'قیمت خارج از محدوده'); end if;
  if not public._rate_ok(v_me, 'buy_h', 1, 0, interval '1 hour', 120, 1) then
    return json_build_object('error', 'سقف خرید ساعتی');
  end if;
  select gold, gems into v_g, v_ge from public.players where user_id = v_me;
  if v_g < p_gold or v_ge < p_gems then return json_build_object('error', 'موجودی کافی نیست'); end if;
  insert into public.reward_claims(user_id, claim_id, kind, gold) values (v_me, p_claim_id, 'buy', -p_gold);
  update public.players set gold = gold - p_gold, gems = gems - p_gems, last_seen = now() where user_id = v_me;
  return json_build_object('ok', true, 'player', row_to_json(p)) from public.players p where p.user_id = v_me;
end;
$$;

-- Save دیگر اقتصاد را از کلاینت نمی‌گیرد
create or replace function public.save_full_state(p_data jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := public.current_user_id();
  v_name text;
  v_last timestamptz;
  v_clean jsonb;
  v_row public.players%rowtype;
  v_power bigint;
begin
  if v_user is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return json_build_object('error', 'داده نامعتبر است');
  end if;
  select username, last_seen into v_name, v_last from public.players where user_id = v_user;
  if v_last is not null and now() - v_last < interval '1500 milliseconds' then
    select * into v_row from public.players where user_id = v_user;
    return json_build_object('ok', true, 'throttled', true, 'server_ms', (extract(epoch from now())*1000)::bigint, 'player', row_to_json(v_row));
  end if;
  v_clean := p_data - 'gold' - 'xp' - 'level' - 'gems' - 'power' - 'rank_pts';
  if v_clean ? 'stats' then
    v_clean := jsonb_set(v_clean, '{stats}', (v_clean->'stats') - 'wins' - 'losses' - 'kills' - 'goldEarned', true);
  end if;
  select * into v_row from public.players where user_id = v_user;
  -- خرج طلا/جواهر از کلاینت قبول است؛ افزایش هرگز از Save نیست
  if p_data ? 'gold' then
    begin
      if (p_data->>'gold')::bigint >= 0 and (p_data->>'gold')::bigint < v_row.gold then
        v_row.gold := (p_data->>'gold')::bigint;
      end if;
    exception when others then null;
    end;
  end if;
  if p_data ? 'gems' then
    begin
      if (p_data->>'gems')::int >= 0 and (p_data->>'gems')::int < v_row.gems then
        v_row.gems := (p_data->>'gems')::int;
      end if;
    exception when others then null;
    end;
  end if;
  v_power := least(v_row.level::bigint * 200000 + 50000000, greatest(v_row.power, 1));
  v_clean := v_clean || jsonb_build_object(
    'gold', v_row.gold, 'xp', v_row.xp, 'level', v_row.level, 'gems', v_row.gems,
    'rank_pts', v_row.rank_pts, 'power', v_power
  );
  update public.players set
    data = v_clean,
    gold = v_row.gold,
    gems = v_row.gems,
    power = v_power,
    hunter_class = left(coalesce(p_data->>'hunterClass', hunter_class, 'E'), 40),
    updated_at = now(),
    last_seen = now()
  where user_id = v_user;
  select * into v_row from public.players where user_id = v_user;
  return json_build_object('ok', true, 'updated_at', now(), 'server_ms', (extract(epoch from now())*1000)::bigint, 'player', row_to_json(v_row));
end;
$$;

-- جایزه دوئل روی سرور
create or replace function public.finish_duel(p_id uuid, p_winner uuid, p_scores jsonb default '{}'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_row public.duels%rowtype;
  v_lv int;
  v_gold bigint;
  v_claim text;
begin
  if v_me is null then return json_build_object('error', 'ابتدا وارد شوید'); end if;
  if p_id is null then return json_build_object('error', 'شناسه نامعتبر'); end if;
  select * into v_row from public.duels where id = p_id;
  if not found then return json_build_object('error', 'مبارزه پیدا نشد'); end if;
  if v_row.p1 is distinct from v_me and v_row.p2 is distinct from v_me then
    return json_build_object('error', 'این مبارزه مال تو نیست');
  end if;
  if v_row.status = 'done' then
    return json_build_object('ok', true, 'already', true, 'result', v_row.result, 'winner', v_row.result->>'winner');
  end if;
  if v_row.status not in ('starting', 'challenged', 'open') then
    return json_build_object('error', 'وضعیت مبارزه قابل پایان نیست');
  end if;
  if p_winner is not null and p_winner is distinct from v_row.p1 and p_winner is distinct from v_row.p2 then
    return json_build_object('error', 'برنده نامعتبر است');
  end if;
  perform set_config('app.finish_duel', '1', true);
  update public.duels set
    status = 'done',
    result = jsonb_build_object('winner', p_winner, 'scores', coalesce(p_scores, '{}'::jsonb), 'srv', 'ok', 'finishedAt', now())
  where id = p_id and status is distinct from 'done';
  if p_winner is not null then
    select level into v_lv from public.players where user_id = p_winner;
    v_gold := 100 + coalesce(v_lv, 1) * 35;
    v_claim := 'duel:' || p_id::text;
    if not exists (select 1 from public.reward_claims where user_id = p_winner and claim_id = v_claim) then
      insert into public.reward_claims(user_id, claim_id, kind, gold) values (p_winner, v_claim, 'duel', v_gold);
      update public.players set wins = wins + 1, gold = least(1000000000000::bigint, gold + v_gold), last_seen = now() where user_id = p_winner;
    else
      update public.players set wins = wins + 1, last_seen = now() where user_id = p_winner;
    end if;
    update public.players set losses = losses + 1, last_seen = now()
      where user_id in (v_row.p1, v_row.p2) and user_id is distinct from p_winner;
  end if;
  return json_build_object('ok', true, 'winner', p_winner, 'gold', v_gold, 'result', jsonb_build_object('winner', p_winner, 'srv', 'ok'));
end;
$$;

grant execute on function public.apply_play(text, text, int, int) to anon, authenticated;
grant execute on function public.claim_reward(text, text) to anon, authenticated;
grant execute on function public.purchase_item(bigint, int, int, text) to anon, authenticated;
notify pgrst, 'reload schema';
