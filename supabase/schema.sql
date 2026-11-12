-- =====================================================================
-- Martiniloben Podersdorf 2026 – Geheime Missionen
-- Supabase-Schema + gesamte Spiellogik als RPC-Funktionen.
--
-- Sicherheitsmodell: Alle Tabellen haben RLS ohne Policies → der anon-Key
-- kann sie NICHT direkt lesen/schreiben. Zugriff nur über die
-- SECURITY-DEFINER-Funktionen unten (Login mit PIN → Session-Token).
-- Einzige Ausnahme: app_state (nur eine Versionsnummer) ist lesbar und
-- per Realtime abonnierbar, damit alle Geräte live neu laden.
--
-- Ausführen: Supabase Dashboard → SQL Editor → diese Datei, danach seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Tabellen
create table if not exists players (
  id              serial primary key,
  name            text not null unique,
  pin             text not null check (pin ~ '^[0-9]{4}$'),
  is_admin        boolean not null default false,
  draws_reset_at  timestamptz not null default '-infinity',
  failed_logins   int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists sessions (
  token       uuid primary key default gen_random_uuid(),
  player_id   int not null references players(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists missions (
  id           int primary key,
  level        smallint not null check (level between 1 and 3),
  title        text not null,
  description  text not null
);

create table if not exists assignments (
  id           bigserial primary key,
  player_id    int not null references players(id) on delete cascade,
  mission_id   int not null references missions(id),
  kind         text not null check (kind in ('regular', 'replacement')),
  replaces_id  bigint references assignments(id),
  status       text not null default 'active'
               check (status in ('active', 'pending', 'confirmed', 'failed')),
  witness_id   int references players(id),
  fail_reason  text check (fail_reason in ('gave_up', 'rejected')),
  drawn_at     timestamptz not null default now(),
  reported_at  timestamptz,
  resolved_at  timestamptz
);
create index if not exists assignments_player_idx  on assignments(player_id);
create index if not exists assignments_witness_idx on assignments(witness_id) where status = 'pending';
create unique index if not exists assignments_one_replacement on assignments(replaces_id) where replaces_id is not null;

create table if not exists app_state (
  id          int primary key default 1 check (id = 1),
  version     bigint not null default 0,
  updated_at  timestamptz not null default now()
);
insert into app_state (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------- Sicherheit
alter table players     enable row level security;
alter table sessions    enable row level security;
alter table missions    enable row level security;
alter table assignments enable row level security;
alter table app_state   enable row level security;

revoke all on players, sessions, missions, assignments from anon, authenticated;
revoke all on app_state from anon, authenticated;
grant select on app_state to anon, authenticated;

drop policy if exists app_state_read on app_state;
create policy app_state_read on app_state for select using (true);

-- Realtime: Änderungen an app_state an alle Clients pushen
do $$ begin
  alter publication supabase_realtime add table app_state;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Jede Änderung am Spiel erhöht die Version → Clients laden neu
create or replace function _bump_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update app_state set version = version + 1, updated_at = now() where id = 1;
  return null;
end $$;

drop trigger if exists bump_assignments on assignments;
create trigger bump_assignments after insert or update or delete on assignments
  for each statement execute function _bump_version();
drop trigger if exists bump_players on players;
create trigger bump_players after insert or update of name, draws_reset_at or delete on players
  for each statement execute function _bump_version();

-- ------------------------------------------------------------ Hilfsfunktionen
create or replace function _random_pin() returns text
language sql volatile as $$
  select lpad((floor(random() * 10000))::int::text, 4, '0')
$$;

-- Beginn des heutigen Kalendertags in Österreich
create or replace function _today_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna'
$$;

create or replace function _me(p_token uuid) returns players
language plpgsql stable security definer set search_path = public as $$
declare p players;
begin
  select pl.* into p from sessions s join players pl on pl.id = s.player_id where s.token = p_token;
  if not found then raise exception 'Nicht angemeldet' using errcode = 'P0001'; end if;
  return p;
end $$;

create or replace function _admin(p_token uuid) returns players
language plpgsql stable security definer set search_path = public as $$
declare p players;
begin
  p := _me(p_token);
  if not p.is_admin then raise exception 'Nur für Admins' using errcode = 'P0001'; end if;
  return p;
end $$;

create or replace function _draws(p players) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'regularLeft', greatest(0, 2 - (
      select count(*) from assignments a
      where a.player_id = p.id and a.kind = 'regular'
        and a.drawn_at >= greatest(_today_start(), p.draws_reset_at))),
    'bonusLeft', (
      select count(*) from assignments a
      where a.player_id = p.id and a.kind = 'regular' and a.status = 'failed'
        and not exists (select 1 from assignments r where r.replaces_id = a.id))
  )
$$;

-- --------------------------------------------------------- Öffentliche RPCs
create or replace function list_players() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'name', name) order by id), '[]'::json) from players
$$;

create or replace function login(p_player_id int, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare p players; t uuid;
begin
  select * into p from players where id = p_player_id for update;
  if not found then raise exception 'Unbekannter Spieler' using errcode = 'P0001'; end if;
  if p.locked_until is not null and p.locked_until > now() then
    raise exception 'Zu viele Fehlversuche – bitte in ein paar Minuten nochmal.' using errcode = 'P0001';
  end if;
  if p.pin <> p_pin then
    update players set
      failed_logins = case when failed_logins + 1 >= 5 then 0 else failed_logins + 1 end,
      locked_until  = case when failed_logins + 1 >= 5 then now() + interval '5 minutes' else locked_until end
    where id = p.id;
    return json_build_object('error', 'Falscher PIN');
  end if;
  update players set failed_logins = 0, locked_until = null where id = p.id;
  insert into sessions (player_id) values (p.id) returning token into t;
  return json_build_object('token', t, 'player',
    json_build_object('id', p.id, 'name', p.name, 'isAdmin', p.is_admin));
end $$;

create or replace function logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from sessions where token = p_token
$$;

create or replace function get_state(p_token uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p players;
begin
  p := _me(p_token);
  return json_build_object(
    'me', json_build_object('id', p.id, 'name', p.name, 'isAdmin', p.is_admin),
    'draws', _draws(p),
    'leaderboard', (
      select coalesce(json_agg(r order by r."points" desc, r."done" desc, r."name"), '[]'::json) from (
        select pl.id, pl.name,
          coalesce(sum(m.level) filter (where a.status = 'confirmed'), 0)::int as "points",
          count(*) filter (where a.status = 'confirmed')::int as "done",
          count(*) filter (where a.status = 'confirmed' and m.level = 1)::int as "done1",
          count(*) filter (where a.status = 'confirmed' and m.level = 2)::int as "done2",
          count(*) filter (where a.status = 'confirmed' and m.level = 3)::int as "done3",
          count(*) filter (where a.status = 'failed')::int as "failed"
        from players pl
        left join assignments a on a.player_id = pl.id
        left join missions m on m.id = a.mission_id
        group by pl.id, pl.name
      ) r),
    'myCards', (
      select coalesce(json_agg(json_build_object(
        'id', a.id, 'missionNo', m.id, 'level', m.level, 'title', m.title,
        'description', m.description, 'kind', a.kind, 'status', a.status,
        'witnessId', a.witness_id, 'witnessName', w.name, 'failReason', a.fail_reason,
        'drawnAt', a.drawn_at, 'resolvedAt', a.resolved_at
      ) order by a.drawn_at desc), '[]'::json)
      from assignments a join missions m on m.id = a.mission_id
      left join players w on w.id = a.witness_id
      where a.player_id = p.id),
    'confirmations', (
      select coalesce(json_agg(json_build_object(
        'id', a.id, 'playerName', pl.name, 'level', m.level, 'title', m.title,
        'description', m.description, 'reportedAt', a.reported_at
      ) order by a.reported_at), '[]'::json)
      from assignments a join missions m on m.id = a.mission_id
      join players pl on pl.id = a.player_id
      where a.witness_id = p.id and a.status = 'pending')
  );
end $$;

create or replace function draw_card(p_token uuid, p_level int) returns json
language plpgsql security definer set search_path = public as $$
declare
  p players; d json; v_kind text; v_replaces bigint; v_mission int; v_id bigint;
begin
  p := _me(p_token);
  perform 1 from players where id = p.id for update;  -- serialisiert Ziehungen pro Spieler
  if p_level not in (1, 2, 3) then raise exception 'Ungültige Stufe' using errcode = 'P0001'; end if;
  d := _draws(p);

  if (d->>'regularLeft')::int > 0 then
    v_kind := 'regular';
  elsif (d->>'bonusLeft')::int > 0 then
    v_kind := 'replacement';
    select a.id into v_replaces from assignments a
    where a.player_id = p.id and a.kind = 'regular' and a.status = 'failed'
      and not exists (select 1 from assignments r where r.replaces_id = a.id)
    order by a.resolved_at limit 1;
  else
    raise exception 'Heute keine Ziehungen mehr übrig.' using errcode = 'P0001';
  end if;

  -- 1. Wahl: Karte, die noch niemand gezogen hat
  select m.id into v_mission from missions m
  where m.level = p_level and not exists (select 1 from assignments a where a.mission_id = m.id)
  order by random() limit 1;
  -- 2. Wahl (Pool erschöpft): Karte, die dieser Spieler noch nie hatte
  if v_mission is null then
    select m.id into v_mission from missions m
    where m.level = p_level
      and not exists (select 1 from assignments a where a.mission_id = m.id and a.player_id = p.id)
    order by random() limit 1;
  end if;
  if v_mission is null then
    raise exception 'In dieser Stufe sind keine Karten mehr übrig.' using errcode = 'P0001';
  end if;

  insert into assignments (player_id, mission_id, kind, replaces_id)
  values (p.id, v_mission, v_kind, v_replaces) returning id into v_id;
  return json_build_object('id', v_id, 'kind', v_kind);
end $$;

create or replace function report_done(p_token uuid, p_assignment_id bigint, p_witness_id int) returns void
language plpgsql security definer set search_path = public as $$
declare p players;
begin
  p := _me(p_token);
  if p_witness_id = p.id or not exists (select 1 from players where id = p_witness_id) then
    raise exception 'Ungültiger Zeuge' using errcode = 'P0001';
  end if;
  update assignments set status = 'pending', witness_id = p_witness_id, reported_at = now()
  where id = p_assignment_id and player_id = p.id and status = 'active';
  if not found then raise exception 'Karte ist nicht mehr aktiv' using errcode = 'P0001'; end if;
end $$;

create or replace function give_up(p_token uuid, p_assignment_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare p players;
begin
  p := _me(p_token);
  update assignments set status = 'failed', fail_reason = 'gave_up', resolved_at = now()
  where id = p_assignment_id and player_id = p.id and status in ('active', 'pending');
  if not found then raise exception 'Karte ist nicht mehr aktiv' using errcode = 'P0001'; end if;
end $$;

create or replace function resolve_confirmation(p_token uuid, p_assignment_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p players;
begin
  p := _me(p_token);
  update assignments set
    status      = case when p_approve then 'confirmed' else 'failed' end,
    fail_reason = case when p_approve then null else 'rejected' end,
    resolved_at = now()
  where id = p_assignment_id and witness_id = p.id and status = 'pending';
  if not found then raise exception 'Anfrage existiert nicht mehr' using errcode = 'P0001'; end if;
end $$;

-- ------------------------------------------------------------ Admin-RPCs
create or replace function admin_overview(p_token uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _admin(p_token);
  return json_build_object(
    'players', (select coalesce(json_agg(json_build_object(
        'id', pl.id, 'name', pl.name, 'pin', pl.pin, 'isAdmin', pl.is_admin,
        'draws', _draws(pl)) order by pl.id), '[]'::json) from players pl),
    'assignments', (select coalesce(json_agg(json_build_object(
        'id', a.id, 'playerName', pl.name, 'title', m.title, 'level', m.level,
        'kind', a.kind, 'status', a.status, 'witnessName', w.name,
        'failReason', a.fail_reason, 'drawnAt', a.drawn_at, 'resolvedAt', a.resolved_at
      ) order by a.drawn_at desc), '[]'::json)
      from assignments a join players pl on pl.id = a.player_id
      join missions m on m.id = a.mission_id left join players w on w.id = a.witness_id),
    'poolLeft', (select json_object_agg(lvl, n) from (
        select m.level as lvl, count(*) filter (
          where not exists (select 1 from assignments a where a.mission_id = m.id)) as n
        from missions m group by m.level) x)
  );
end $$;

create or replace function admin_add_player(p_token uuid, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare v_pin text := _random_pin(); v_id int;
begin
  perform _admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Name fehlt' using errcode = 'P0001'; end if;
  insert into players (name, pin) values (trim(p_name), v_pin) returning id into v_id;
  return json_build_object('id', v_id, 'pin', v_pin);
exception when unique_violation then
  raise exception 'Name existiert bereits' using errcode = 'P0001';
end $$;

create or replace function admin_reset_pin(p_token uuid, p_player_id int) returns text
language plpgsql security definer set search_path = public as $$
declare v_pin text := _random_pin();
begin
  perform _admin(p_token);
  update players set pin = v_pin, failed_logins = 0, locked_until = null where id = p_player_id;
  delete from sessions where player_id = p_player_id;  -- alte Logins ungültig
  return v_pin;
end $$;

-- p_player_id = null → alle Spieler
create or replace function admin_reset_draws(p_token uuid, p_player_id int default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  update players set draws_reset_at = now() where p_player_id is null or id = p_player_id;
end $$;

-- ----------------------------------------------------------- Berechtigungen
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  list_players(), login(int, text), logout(uuid), get_state(uuid),
  draw_card(uuid, int), report_done(uuid, bigint, int), give_up(uuid, bigint),
  resolve_confirmation(uuid, bigint, boolean), admin_overview(uuid),
  admin_add_player(uuid, text), admin_reset_pin(uuid, int), admin_reset_draws(uuid, int)
to anon, authenticated;
