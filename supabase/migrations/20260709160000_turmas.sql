-- N11 Fase 2 — Turmas (grupos com código + ranking). Aditiva. Reusa social_profiles
-- para os agregados. Entrar/criar vão por RPC SECURITY DEFINER que valida o código;
-- INSERT direto em turma_members é NEGADO pela RLS (senão qualquer um entraria em
-- qualquer turma sabendo o id, furando o código).

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.turma_members (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique (turma_id, user_id)
);

alter table public.turmas enable row level security;
alter table public.turma_members enable row level security;

create index if not exists idx_turma_members_turma on public.turma_members(turma_id);
create index if not exists idx_turma_members_user on public.turma_members(user_id);

-- ── Helpers SECURITY DEFINER — evitam recursão de RLS na tabela de associação ──
create or replace function public.is_turma_member(p_turma_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.turma_members m where m.turma_id = p_turma_id and m.user_id = auth.uid());
$$;
create or replace function public.is_turma_owner(p_turma_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.turmas t where t.id = p_turma_id and t.owner_id = auth.uid());
$$;
revoke all on function public.is_turma_member(uuid) from public, anon;
revoke all on function public.is_turma_owner(uuid) from public, anon;
grant execute on function public.is_turma_member(uuid) to authenticated;
grant execute on function public.is_turma_owner(uuid) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- turmas: só membros leem; criar é via RPC (sem policy de insert); dono edita/apaga.
create policy "turmas_select_member" on public.turmas for select using (public.is_turma_member(id));
create policy "turmas_update_owner" on public.turmas for update using (public.is_turma_owner(id));
create policy "turmas_delete_owner" on public.turmas for delete using (public.is_turma_owner(id));

-- turma_members: membros veem a lista; entrar é via RPC (sem policy de insert);
-- sair (a si mesmo) ou o dono remover.
create policy "turma_members_select_member" on public.turma_members for select using (public.is_turma_member(turma_id));
create policy "turma_members_delete_self_or_owner" on public.turma_members for delete
  using (user_id = auth.uid() or public.is_turma_owner(turma_id));

-- ── RPCs ─────────────────────────────────────────────────────────────────────
-- Criar turma: insere a turma + a associação do dono, atômico.
create or replace function public.create_turma(p_name text, p_code text)
returns table (id uuid, name text, join_code text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'Nome da turma vazio'; end if;
  insert into public.turmas (name, join_code, owner_id)
  values (trim(p_name), upper(p_code), auth.uid())
  returning turmas.id into v_id;
  insert into public.turma_members (turma_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return query select t.id, t.name, t.join_code from public.turmas t where t.id = v_id;
end;
$$;

-- Entrar por código: valida o código e insere a associação (idempotente).
create or replace function public.join_turma_by_code(p_code text)
returns table (turma_id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select t.id, t.name into v_id, v_name from public.turmas t where t.join_code = upper(p_code) limit 1;
  if v_id is null then return; end if;
  insert into public.turma_members (turma_id, user_id, role)
  values (v_id, auth.uid(), 'member')
  on conflict (turma_id, user_id) do nothing;
  return query select v_id, v_name;
end;
$$;

-- Preview de uma turma pelo código (antes de entrar).
create or replace function public.find_turma_by_code(p_code text)
returns table (turma_id uuid, name text, member_count bigint)
language sql security definer stable set search_path = public as $$
  select t.id, t.name, (select count(*) from public.turma_members m where m.turma_id = t.id)
  from public.turmas t where t.join_code = upper(p_code) limit 1;
$$;

-- Minhas turmas com contagem de membros.
create or replace function public.get_my_turmas()
returns table (id uuid, name text, join_code text, member_count bigint, is_owner boolean)
language sql security definer stable set search_path = public as $$
  select t.id, t.name, t.join_code,
    (select count(*) from public.turma_members m2 where m2.turma_id = t.id),
    (t.owner_id = auth.uid())
  from public.turmas t
  where exists (select 1 from public.turma_members m where m.turma_id = t.id and m.user_id = auth.uid());
$$;

-- Ranking da turma (só para membros) — agregados de social_profiles.
create or replace function public.get_turma_ranking(p_turma_id uuid)
returns table (user_id uuid, name text, avatar_url text, streak_current int, week_minutes int, coverage_pct int, role text)
language sql security definer stable set search_path = public as $$
  select m.user_id, sp.display_name, sp.avatar_url,
    coalesce(sp.streak_current, 0), coalesce(sp.week_minutes, 0), coalesce(sp.coverage_pct, 0), m.role
  from public.turma_members m
  left join public.social_profiles sp on sp.user_id = m.user_id
  where m.turma_id = p_turma_id and public.is_turma_member(p_turma_id)
  order by coalesce(sp.week_minutes, 0) desc;
$$;

revoke all on function public.create_turma(text, text) from public, anon;
revoke all on function public.join_turma_by_code(text) from public, anon;
revoke all on function public.find_turma_by_code(text) from public, anon;
revoke all on function public.get_my_turmas() from public, anon;
revoke all on function public.get_turma_ranking(uuid) from public, anon;
grant execute on function public.create_turma(text, text) to authenticated;
grant execute on function public.join_turma_by_code(text) to authenticated;
grant execute on function public.find_turma_by_code(text) to authenticated;
grant execute on function public.get_my_turmas() to authenticated;
grant execute on function public.get_turma_ranking(uuid) to authenticated;
