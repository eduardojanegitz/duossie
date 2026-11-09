-- Duossie · Fase 1 · Identidade, allowlist, duplas e convites.
-- Princípios:
--   * RLS habilitado em todas as tabelas expostas.
--   * Mutações sensíveis passam por funções SECURITY DEFINER que validam auth.uid().
--   * Tabelas internas ficam no schema `private`, que não é exposto pela API.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Allowlist de cadastro (app privado)
-- ---------------------------------------------------------------------------
create table private.auth_allowlist (
  email      text primary key check (email = lower(email)),
  note       text,
  created_at timestamptz not null default now()
);

-- Hook "before user created" do Supabase Auth: rejeita e-mails fora da allowlist.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if not exists (select 1 from private.auth_allowlist a where a.email = v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Este endereço não tem acesso ao Duossie.',
        'http_code', 403
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Rate limiting genérico (janela fixa) — usado por convites e, depois, enigmas.
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

create or replace function private.hit_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  delete from private.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end;
$$;
revoke execute on function private.hit_rate_limit(text, integer, interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  codename   text check (codename is null or char_length(btrim(codename)) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Duplas
-- ---------------------------------------------------------------------------
create table public.duos (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.duo_members (
  duo_id    uuid not null references public.duos (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (duo_id, user_id),
  -- MVP: cada investigador pertence a uma única dupla.
  constraint duo_members_one_duo_per_user unique (user_id)
);

-- Garante no máximo dois membros, serializando inserções concorrentes na mesma dupla.
create or replace function private.enforce_duo_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.duos d where d.id = new.duo_id for update;
  if (select count(*) from public.duo_members m where m.duo_id = new.duo_id) >= 2 then
    raise exception 'duo_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger duo_members_capacity before insert on public.duo_members
  for each row execute function private.enforce_duo_capacity();

create table public.duo_invites (
  id         uuid primary key default gen_random_uuid(),
  duo_id     uuid not null references public.duos (id) on delete cascade,
  code_hash  text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_by    uuid references public.profiles (id) on delete set null,
  used_at    timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index duo_invites_duo_idx on public.duo_invites (duo_id);

-- Helpers usados nas policies (SECURITY DEFINER evita recursão de RLS).
create or replace function private.my_duo_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.duo_id from public.duo_members m where m.user_id = auth.uid();
$$;
revoke execute on function private.my_duo_id() from public, anon;
grant execute on function private.my_duo_id() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.duos        enable row level security;
alter table public.duo_members enable row level security;
alter table public.duo_invites enable row level security;

create policy profiles_select_self_or_partner on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select m.user_id from public.duo_members m where m.duo_id = (select private.my_duo_id()))
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy duos_select_member on public.duos
  for select to authenticated
  using (id = (select private.my_duo_id()));

create policy duo_members_select_same_duo on public.duo_members
  for select to authenticated
  using (duo_id = (select private.my_duo_id()));

-- duo_invites: nenhuma policy → inacessível pela API; só via funções abaixo.

-- Privilégios de coluna: o cliente só pode alterar o próprio codinome.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (codename) on public.profiles to authenticated;
revoke all on public.duos, public.duo_members, public.duo_invites from anon;
revoke insert, update, delete on public.duos, public.duo_members from authenticated;
revoke all on public.duo_invites from authenticated;
grant select on public.duos, public.duo_members to authenticated;

-- ---------------------------------------------------------------------------
-- Funções de dupla (API pública, validam auth.uid())
-- ---------------------------------------------------------------------------
create or replace function private.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function private.hash_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(private.normalize_invite_code(p_code), 'sha256'), 'hex');
$$;

create or replace function public.create_duo(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_duo uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.duo_members m where m.user_id = v_uid) then
    raise exception 'already_in_duo' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'invalid_duo_name' using errcode = '22023';
  end if;

  insert into public.duos (name, created_by) values (btrim(p_name), v_uid) returning id into v_duo;
  insert into public.duo_members (duo_id, user_id) values (v_duo, v_uid);
  return v_duo;
end;
$$;

-- Gera um novo convite (revoga os anteriores) e devolve o código em texto puro uma única vez.
create or replace function public.create_duo_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_duo uuid;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_raw text := '';
  v_expires timestamptz := now() + interval '24 hours';
  i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select m.duo_id into v_duo from public.duo_members m where m.user_id = v_uid;
  if v_duo is null then
    raise exception 'not_in_duo' using errcode = 'P0001';
  end if;
  if (select count(*) from public.duo_members m where m.duo_id = v_duo) >= 2 then
    raise exception 'duo_full' using errcode = 'P0001';
  end if;
  if not private.hit_rate_limit('invite_create:' || v_uid, 10, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  for i in 0..7 loop
    v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % char_length(v_alphabet)) + 1, 1);
  end loop;

  update public.duo_invites d set revoked_at = now()
   where d.duo_id = v_duo and d.used_at is null and d.revoked_at is null;

  insert into public.duo_invites (duo_id, code_hash, created_by, expires_at)
  values (v_duo, private.hash_invite_code(v_raw), v_uid, v_expires);

  code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
  expires_at := v_expires;
  return next;
end;
$$;

-- Retorna o id da dupla, ou NULL se o código for inválido. Não usamos `raise` para código
-- inválido porque o rollback desfaria o contador de tentativas (rate limit).
create or replace function public.join_duo(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.duo_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.hit_rate_limit('invite_join:' || v_uid, 10, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.duo_members m where m.user_id = v_uid) then
    raise exception 'already_in_duo' using errcode = 'P0001';
  end if;

  select * into v_invite from public.duo_invites d
   where d.code_hash = private.hash_invite_code(p_code)
   for update;

  if v_invite.id is null
     or v_invite.used_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at < now() then
    return null;
  end if;

  insert into public.duo_members (duo_id, user_id) values (v_invite.duo_id, v_uid);
  update public.duo_invites set used_by = v_uid, used_at = now() where id = v_invite.id;
  return v_invite.duo_id;
end;
$$;

revoke execute on function public.create_duo(text) from public, anon;
revoke execute on function public.create_duo_invite() from public, anon;
revoke execute on function public.join_duo(text) from public, anon;
grant execute on function public.create_duo(text) to authenticated;
grant execute on function public.create_duo_invite() to authenticated;
grant execute on function public.join_duo(text) to authenticated;
