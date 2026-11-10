-- Duossie · Fase 4 · Quadro de evidências, chat da investigação e sinais para a dupla.
-- Tudo aqui é acessado SOMENTE pelo servidor: um item do quadro pode apontar para uma
-- evidência exclusiva de um papel, e o servidor decide o que cada jogador pode ver.

create type public.board_item_kind as enum ('evidence', 'note');
create type public.board_status as enum ('hypothesis', 'confirmed', 'contradiction');
create type public.board_visibility as enum ('private', 'shared');

create table public.board_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.case_sessions (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        public.board_item_kind not null,
  evidence_id text,
  body        text check (body is null or char_length(body) between 1 and 500),
  visibility  public.board_visibility not null default 'shared',
  group_label text check (group_label is null or char_length(group_label) between 1 and 40),
  status      public.board_status not null default 'hypothesis',
  highlight   boolean not null default false,
  x           real not null default 0,
  y           real not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint board_items_kind_shape check (
    (kind = 'evidence' and evidence_id is not null) or (kind = 'note' and evidence_id is null and body is not null)
  )
);
create unique index board_items_one_pin on public.board_items (session_id, author_id, evidence_id) where evidence_id is not null;
create index board_items_session_idx on public.board_items (session_id);

create table public.board_links (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.case_sessions (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  from_item  uuid not null references public.board_items (id) on delete cascade,
  to_item    uuid not null references public.board_items (id) on delete cascade,
  label      text check (label is null or char_length(label) between 1 and 80),
  status     public.board_status not null default 'hypothesis',
  created_at timestamptz not null default now(),
  constraint board_links_distinct check (from_item <> to_item)
);
create unique index board_links_pair on public.board_links (session_id, least(from_item, to_item), greatest(from_item, to_item));

create table public.session_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.case_sessions (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('text', 'help')),
  body        text check (body is null or char_length(body) between 1 and 1000),
  evidence_id text,
  puzzle_id   text,
  created_at  timestamptz not null default now()
);
create index session_messages_session_idx on public.session_messages (session_id, created_at);

create table public.session_reads (
  session_id   uuid not null references public.case_sessions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create trigger board_items_touch before update on public.board_items
  for each row execute function private.touch_updated_at();

alter table public.board_items enable row level security;
alter table public.board_links enable row level security;
alter table public.session_messages enable row level security;
alter table public.session_reads enable row level security;
revoke all on public.board_items, public.board_links, public.session_messages, public.session_reads from anon, authenticated;

-- Sinal sem conteúdo para a dupla (ex.: "quadro mudou", "nova mensagem").
create or replace function public.notify_duo(p_duo_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event not in ('board_updated', 'message_created', 'session_updated') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  perform realtime.send(p_payload, p_event, 'duo:' || p_duo_id::text, true);
end;
$$;
revoke execute on function public.notify_duo(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.notify_duo(uuid, text, jsonb) to service_role;
