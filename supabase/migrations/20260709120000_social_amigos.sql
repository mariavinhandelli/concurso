-- N11 Fase 1 — Camada social (Amigos). Aditiva e opt-in. Nenhum conteúdo de
-- estudo é exposto: amigos leem só os agregados denormalizados em social_profiles.

-- ── Amizades (mútuas) ────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
alter table public.friendships enable row level security;

create policy "friendships_select_party" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_insert_requester" on public.friendships
  for insert with check (auth.uid() = requester_id);
create policy "friendships_update_addressee" on public.friendships
  for update using (auth.uid() = addressee_id and status = 'pending');
create policy "friendships_delete_party" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);

-- ── Perfil social (opt-in) + stats agregados para o ranking ─────────────────
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  invite_code text unique,
  display_name text,
  avatar_url text,
  streak_current int not null default 0,
  week_minutes int not null default 0,
  coverage_pct int not null default 0,
  stats_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_profiles enable row level security;

-- Vejo sempre a minha; a de outra pessoa só se ela ativou E somos amigos aceitos.
create policy "social_profiles_select_own" on public.social_profiles
  for select using (auth.uid() = user_id);
create policy "social_profiles_select_friends" on public.social_profiles
  for select using (
    enabled = true and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ( (f.requester_id = auth.uid() and f.addressee_id = social_profiles.user_id)
           or (f.addressee_id = auth.uid() and f.requester_id = social_profiles.user_id) )
    )
  );
create policy "social_profiles_insert_own" on public.social_profiles
  for insert with check (auth.uid() = user_id);
create policy "social_profiles_update_own" on public.social_profiles
  for update using (auth.uid() = user_id);
create policy "social_profiles_delete_own" on public.social_profiles
  for delete using (auth.uid() = user_id);

-- ── Lookup por código de convite (não abre a tabela inteira) ────────────────
-- Retorna só nome/avatar de um perfil ATIVO pelo invite_code, para a tela de
-- "adicionar amigo" resolver o link antes de a amizade existir.
create or replace function public.find_social_profile_by_code(p_code text)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select sp.user_id, sp.display_name, sp.avatar_url
  from public.social_profiles sp
  where sp.invite_code = p_code and sp.enabled = true
  limit 1;
$$;

revoke all on function public.find_social_profile_by_code(text) from public, anon;
grant execute on function public.find_social_profile_by_code(text) to authenticated;

-- ── Conexões do usuário (amigos + pendentes) com nomes/stats resolvidos ─────
-- SECURITY DEFINER porque, em pedidos pendentes, a RLS ainda não permite ler o
-- social_profile do solicitante. Escopo sempre auth.uid() — não vaza terceiros.
create or replace function public.get_social_connections()
returns table (
  friendship_id uuid,
  other_id uuid,
  status text,
  direction text,
  name text,
  avatar_url text,
  streak_current int,
  week_minutes int,
  coverage_pct int,
  enabled boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.id as friendship_id,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other_id,
    f.status,
    case
      when f.status = 'accepted' then 'friend'
      when f.requester_id = auth.uid() then 'outgoing'
      else 'incoming'
    end as direction,
    sp.display_name as name,
    sp.avatar_url,
    coalesce(sp.streak_current, 0) as streak_current,
    coalesce(sp.week_minutes, 0) as week_minutes,
    coalesce(sp.coverage_pct, 0) as coverage_pct,
    coalesce(sp.enabled, false) as enabled
  from public.friendships f
  left join public.social_profiles sp
    on sp.user_id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid();
$$;

revoke all on function public.get_social_connections() from public, anon;
grant execute on function public.get_social_connections() to authenticated;
