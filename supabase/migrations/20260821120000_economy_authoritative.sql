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
