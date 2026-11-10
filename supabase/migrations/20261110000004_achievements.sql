-- Duossie · Fase 6 · Conquistas da dupla.
create table public.duo_achievements (
  duo_id         uuid not null references public.duos (id) on delete cascade,
  achievement_id text not null check (achievement_id ~ '^[a-z0-9-]{2,40}$'),
  session_id     uuid references public.case_sessions (id) on delete set null,
  unlocked_at    timestamptz not null default now(),
  primary key (duo_id, achievement_id)
);

alter table public.duo_achievements enable row level security;
create policy duo_achievements_select on public.duo_achievements
  for select to authenticated
  using (duo_id = (select private.my_duo_id()));

revoke all on public.duo_achievements from anon, authenticated;
grant select on public.duo_achievements to authenticated;
