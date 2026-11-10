-- Duossie · Fase 2 · Catálogo público de temporadas/casos e canal Realtime privado da dupla.
-- O catálogo contém SOMENTE metadados sem spoiler. Definições completas dos casos
-- (evidências, soluções) ficam em outra tabela, inacessível ao cliente (Fase 3).

create type public.case_difficulty as enum ('easy', 'medium', 'hard');

create table public.seasons (
  id         text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  number     integer not null unique check (number > 0),
  title      text not null,
  tagline    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cases (
  id              text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  season_id       text not null references public.seasons (id) on delete restrict,
  code            text not null unique check (code ~ '^[0-9]{3}$'),
  title           text not null,
  synopsis        text not null,
  category        text not null,
  difficulty      public.case_difficulty not null,
  duration_min    integer check (duration_min > 0),
  duration_max    integer check (duration_max >= duration_min),
  -- Quantidade de enigmas: preenchida pelo importador a partir da definição do caso.
  puzzle_count    integer check (puzzle_count >= 0),
  cover           text not null,
  -- Casos exigidos (concluídos pela dupla) para desbloquear este.
  unlock_requires text[] not null default '{}',
  -- Só fica jogável quando existe uma definição publicada (importador da Fase 3).
  is_playable     boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cases_season_idx on public.cases (season_id, sort_order);

create trigger seasons_touch before update on public.seasons
  for each row execute function private.touch_updated_at();
create trigger cases_touch before update on public.cases
  for each row execute function private.touch_updated_at();

alter table public.seasons enable row level security;
alter table public.cases enable row level security;

create policy seasons_read on public.seasons for select to authenticated using (true);
create policy cases_read on public.cases for select to authenticated using (true);

revoke all on public.seasons, public.cases from anon;
revoke insert, update, delete on public.seasons, public.cases from authenticated;
grant select on public.seasons, public.cases to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: canal privado `duo:<duo_id>` (presença e sinais da dupla).
-- Só membros da dupla podem assinar ou enviar mensagens nesse tópico.
-- ---------------------------------------------------------------------------
create policy duo_channel_receive on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'duo:' || (select private.my_duo_id())::text);

create policy duo_channel_send on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'duo:' || (select private.my_duo_id())::text);
