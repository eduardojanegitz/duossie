-- Duossie · Fase 3 · Versões de casos, sessões de investigação e commit atômico de ações.
-- Separação:
--   * Definição (case_versions): conteúdo e soluções. SOMENTE servidor (service_role).
--   * Estado (case_sessions.state, session_events): SOMENTE servidor; o cliente recebe
--     a projeção por papel calculada pelo motor.
--   * Metadados de sessão (status, progresso, papéis): legíveis pela dupla via RLS.

-- ---------------------------------------------------------------------------
-- Versões publicadas dos casos
-- ---------------------------------------------------------------------------
create table public.case_versions (
  id           uuid primary key default gen_random_uuid(),
  case_id      text not null references public.cases (id) on delete restrict,
  version      integer not null check (version > 0),
  content_hash text not null,
  definition   jsonb not null,
  created_at   timestamptz not null default now(),
  unique (case_id, version)
);

alter table public.case_versions enable row level security;
-- Nenhuma policy: inacessível para anon/authenticated.
revoke all on public.case_versions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sessões de investigação
-- ---------------------------------------------------------------------------
create type public.session_status as enum ('active', 'completed');
create type public.player_role as enum ('A', 'B');

create table public.case_sessions (
  id              uuid primary key default gen_random_uuid(),
  duo_id          uuid not null references public.duos (id) on delete cascade,
  case_id         text not null references public.cases (id) on delete restrict,
  case_version_id uuid not null references public.case_versions (id) on delete restrict,
  status          public.session_status not null default 'active',
  progress        integer not null default 0 check (progress between 0 and 100),
  state           jsonb not null,
  state_version   integer not null default 0,
  started_by      uuid references public.profiles (id) on delete set null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  updated_at      timestamptz not null default now()
);
-- Uma única investigação por caso por dupla (reabrir reutiliza a mesma sessão).
create unique index case_sessions_one_per_case on public.case_sessions (duo_id, case_id);

create table public.session_players (
  session_id uuid not null references public.case_sessions (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.player_role not null,
  primary key (session_id, user_id),
  unique (session_id, role)
);

-- Idempotência: cada ação de cliente tem um id único por sessão.
create table public.session_actions (
  session_id uuid not null references public.case_sessions (id) on delete cascade,
  action_id  uuid not null,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  action     jsonb not null,
  outcome    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, action_id)
);

-- Log append-only de eventos (auditoria, telemetria de playtest, recuperação).
create table public.session_events (
  session_id    uuid not null references public.case_sessions (id) on delete cascade,
  state_version integer not null,
  actor_id      uuid references public.profiles (id) on delete set null,
  action_id     uuid,
  type          text not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  primary key (session_id, state_version)
);

create trigger case_sessions_touch before update on public.case_sessions
  for each row execute function private.touch_updated_at();

alter table public.case_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.session_actions enable row level security;
alter table public.session_events enable row level security;

create policy case_sessions_select_duo on public.case_sessions
  for select to authenticated
  using (duo_id = (select private.my_duo_id()));

create policy session_players_select_duo on public.session_players
  for select to authenticated
  using (session_id in (select s.id from public.case_sessions s where s.duo_id = (select private.my_duo_id())));

revoke all on public.case_sessions, public.session_players, public.session_actions, public.session_events from anon, authenticated;
-- Colunas legíveis: o snapshot `state` NÃO está na lista.
grant select (id, duo_id, case_id, status, progress, state_version, started_by, started_at, completed_at, updated_at)
  on public.case_sessions to authenticated;
grant select on public.session_players to authenticated;

-- ---------------------------------------------------------------------------
-- Commit atômico de uma transição (chamado SOMENTE pelo servidor, com service_role)
-- ---------------------------------------------------------------------------
-- Retorna 'committed' ou 'duplicate'. Em conflito de versão, levanta 'version_conflict'
-- (a transação inteira é desfeita e o servidor tenta de novo com o estado atual).
create or replace function public.commit_session_transition(
  p_session_id       uuid,
  p_expected_version integer,
  p_actor_id         uuid,
  p_action_id        uuid,
  p_action           jsonb,
  p_outcome          jsonb,
  p_state            jsonb,
  p_status           public.session_status,
  p_progress         integer,
  p_event_type       text,
  p_event_payload    jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duo uuid;
  v_new_version integer := p_expected_version + 1;
begin
  insert into public.session_actions (session_id, action_id, actor_id, action, outcome)
  values (p_session_id, p_action_id, p_actor_id, p_action, p_outcome)
  on conflict (session_id, action_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  update public.case_sessions s
     set state = p_state,
         state_version = v_new_version,
         status = p_status,
         progress = p_progress,
         completed_at = case
           when p_status = 'completed' then coalesce(s.completed_at, now())
           else s.completed_at
         end
   where s.id = p_session_id
     and s.state_version = p_expected_version
  returning s.duo_id into v_duo;

  if v_duo is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  insert into public.session_events (session_id, state_version, actor_id, action_id, type, payload)
  values (p_session_id, v_new_version, p_actor_id, p_action_id, p_event_type, p_event_payload);

  -- Sinal sem conteúdo para os dois jogadores: "a sessão mudou, busque sua visão".
  perform realtime.send(
    jsonb_build_object('sessionId', p_session_id, 'version', v_new_version),
    'session_updated',
    'duo:' || v_duo::text,
    true
  );

  return 'committed';
end;
$$;

revoke execute on function public.commit_session_transition(uuid, integer, uuid, uuid, jsonb, jsonb, jsonb, public.session_status, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_session_transition(uuid, integer, uuid, uuid, jsonb, jsonb, jsonb, public.session_status, integer, text, jsonb)
  to service_role;

-- Rate limit exposto só ao servidor (ex.: tentativas de enigma).
create or replace function public.consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit(p_key, p_max, make_interval(secs => p_window_seconds));
$$;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
