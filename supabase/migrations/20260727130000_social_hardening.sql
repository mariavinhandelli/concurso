-- Auditoria de Amigos & Turmas (27/07/2026) — backlog P1/P2 do lado do banco.
-- Continuação de 20260727120000 (os 3 P0). Ver docs/amigos-auditoria-jul2026.md.

-- ── P1-7: corrida de pedidos criava estado fantasma permanente ──────────────
-- A unique era só (requester_id, addressee_id), então A→B e B→A coexistiam. Se
-- duas pessoas se adicionavam no mesmo instante, o check-then-act do service não
-- pegava e as duas linhas entravam: a pessoa aparecia duas vezes em "Pedidos",
-- aceitar uma deixava a outra pendente para sempre, e aceitar as duas colocava
-- ela em dois lugares do pódio (com erro de key duplicada no React).
-- O índice sobre o par ORDENADO torna a amizade única independentemente de quem
-- pediu — o segundo insert simultâneo passa a falhar no banco, não na aplicação.
create unique index if not exists idx_friendships_unique_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ── P1-5: bloqueio ─────────────────────────────────────────────────────────
-- Recusar/remover apenas DELETAM a linha, sem deixar estado terminal: o mesmo
-- usuário reenviava pedido indefinidamente e a vítima só podia recusar de novo.
create table if not exists public.social_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.social_blocks enable row level security;

-- Só o autor do bloqueio enxerga/gerencia. Quem foi bloqueado NÃO tem select:
-- descobrir que foi bloqueado é informação que alimenta retaliação.
create policy "social_blocks_select_own" on public.social_blocks
  for select using ((select auth.uid()) = blocker_id);
create policy "social_blocks_insert_own" on public.social_blocks
  for insert with check ((select auth.uid()) = blocker_id);
create policy "social_blocks_delete_own" on public.social_blocks
  for delete using ((select auth.uid()) = blocker_id);

create index if not exists idx_social_blocks_blocked on public.social_blocks(blocked_id);

-- A barreira do bloqueio é um TRIGGER, não uma policy de RLS: uma policy teria
-- de consultar social_blocks como o próprio usuário, e quem está bloqueado não
-- pode ler a linha que o bloqueia (acima) — o `not exists` daria falso e a
-- proteção não valeria justamente contra quem ela existe. O trigger é
-- SECURITY DEFINER, então enxerga a tabela toda. A mensagem é genérica de
-- propósito: distinguir "bloqueado" de "outro erro" seria um oráculo.
create or replace function public.friendships_block_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.social_blocks b
    where (b.blocker_id = new.addressee_id and b.blocked_id = new.requester_id)
       or (b.blocker_id = new.requester_id and b.blocked_id = new.addressee_id)
  ) then
    raise exception 'friendship_blocked' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_friendships_block_guard on public.friendships;
create trigger trg_friendships_block_guard
  before insert on public.friendships
  for each row execute function public.friendships_block_guard();

-- Bloquear é atômico: registra o bloqueio E desfaz a amizade/pedido existente.
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  if p_user_id is null or p_user_id = v_uid then raise exception 'Alvo inválido'; end if;

  insert into public.social_blocks (blocker_id, blocked_id)
  values (v_uid, p_user_id)
  on conflict do nothing;

  delete from public.friendships
   where (requester_id = v_uid and addressee_id = p_user_id)
      or (requester_id = p_user_id and addressee_id = v_uid);
end;
$$;

-- Lista de bloqueados com nome, para a pessoa conseguir desbloquear depois.
-- SECURITY DEFINER porque, sem amizade, a RLS de social_profiles não deixaria
-- ler o nome de quem foi bloqueado. Escopo sempre auth.uid().
create or replace function public.get_my_blocks()
returns table (blocked_id uuid, name text, avatar_url text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select b.blocked_id, sp.display_name, sp.avatar_url, b.created_at
  from public.social_blocks b
  left join public.social_profiles sp on sp.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- ── P1-5: denúncia ─────────────────────────────────────────────────────────
-- Não existia canal nenhum. Só INSERT e leitura das próprias denúncias; a
-- moderação lê pelo service_role. Sem UPDATE/DELETE: denúncia não se reescreve.
create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 40),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
alter table public.social_reports enable row level security;

create policy "social_reports_insert_own" on public.social_reports
  for insert with check ((select auth.uid()) = reporter_id);
create policy "social_reports_select_own" on public.social_reports
  for select using ((select auth.uid()) = reporter_id);

create index if not exists idx_social_reports_reported on public.social_reports(reported_id);

-- ── P1-4: o ranking era forjável pelo cliente ──────────────────────────────
-- streak/minutos/cobertura eram calculados NO BROWSER e gravados pelo próprio
-- browser, e social_profiles_update_own não restringe coluna — qualquer um com
-- o DevTools aberto gravava week_minutes = 99999 e liderava todos os rankings.
-- Postgres não tem RLS por coluna, mas tem GRANT por coluna: o cliente perde o
-- direito de escrever os agregados e passa a pedir o recálculo por RPC.
revoke update on public.social_profiles from authenticated;
grant update (user_id, enabled, invite_code, display_name, avatar_url, updated_at)
  on public.social_profiles to authenticated;

-- Recalcula os 3 agregados a partir da fonte da verdade (study_logs,
-- target_exams, topic_target_exams). p_tz = fuso do navegador, igual ao que
-- get_study_day_totals já recebe — sem ele o corte do dia local sairia errado.
--
-- ATENÇÃO: a regra de streak aqui espelha services/streak.service.ts
-- (limiar de 30 min/dia, 1 folga perdoada a cada 7 dias, nunca 2 faltas
-- seguidas). Se um dos dois mudar, o outro TEM de mudar junto: o número que o
-- amigo vê e o número que a pessoa vê na Home dela precisam ser o mesmo.
create or replace function public.refresh_my_social_stats(p_tz text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date;
  v_cursor    date;
  v_streak    int  := 0;
  v_week      int  := 0;
  v_cov       int  := 0;
  v_target    uuid;
  v_total     int;
  v_covered   int;
  v_perdoados date[] := '{}';
  v_dias      date[];
  v_guard     int  := 0;
  v_studied_today boolean;
begin
  if v_uid is null then return; end if;
  -- Perfil desativado não tem agregado para atualizar (mesma guarda do client).
  if not exists (select 1 from public.social_profiles s where s.user_id = v_uid and s.enabled) then
    return;
  end if;

  v_today := (now() at time zone p_tz)::date;

  -- Dias locais que CONTAM para a sequência (>= 30 min estudados no dia).
  -- Array em vez de temp table: `create temp table` dentro de uma função
  -- SECURITY DEFINER deixaria pg_temp na frente do search_path, que é o vetor
  -- clássico de sequestro de nome nesse tipo de função.
  select coalesce(array_agg(d.day), '{}')
    into v_dias
  from (
    select (l.started_at at time zone p_tz)::date as day
    from public.study_logs l
    where l.user_id = v_uid
      and l.started_at >= now() - interval '1100 days'
    group by 1
    having sum(coalesce(l.duration_sec, 0)) >= 1800
  ) d;

  -- ── sequência atual, com perdão ──
  v_studied_today := v_today = any (v_dias);
  v_cursor := case when v_studied_today then v_today else v_today - 1 end;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 1200;

    if v_cursor = any (v_dias) then
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    elsif (
      -- no máximo 1 perdão a cada 7 dias...
      not exists (select 1 from unnest(v_perdoados) p where abs(p - v_cursor) < 7)
      -- ...e nunca 2 faltas seguidas: o dia anterior precisa ter estudo.
      and (v_cursor - 1) = any (v_dias)
    ) then
      v_perdoados := v_perdoados || v_cursor;
      v_cursor := v_cursor - 1;
    else
      exit;
    end if;
  end loop;

  -- ── minutos da semana: janela móvel de 7 dias terminando hoje ──
  select coalesce(round(sum(coalesce(l.duration_sec, 0)) / 60.0), 0)::int
    into v_week
  from public.study_logs l
  where l.user_id = v_uid
    and (l.started_at at time zone p_tz)::date >= v_today - 6
    and (l.started_at at time zone p_tz)::date <= v_today;

  -- ── cobertura do edital: alvo primário, senão o mais antigo não arquivado ──
  select t.id into v_target
  from public.target_exams t
  where t.user_id = v_uid and t.archived_at is null
  order by t.is_primary desc, t.created_at asc
  limit 1;

  if v_target is not null then
    select count(*) into v_total
    from public.topic_target_exams tte where tte.target_exam_id = v_target;

    if coalesce(v_total, 0) > 0 then
      select count(distinct l.topic_id) into v_covered
      from public.study_logs l
      where l.user_id = v_uid
        and l.topic_id in (
          select tte.topic_id from public.topic_target_exams tte
          where tte.target_exam_id = v_target
        );
      v_cov := round(coalesce(v_covered, 0)::numeric / v_total * 100);
    end if;
  end if;

  update public.social_profiles
     set streak_current   = v_streak,
         week_minutes     = v_week,
         coverage_pct     = v_cov,
         stats_updated_at = now(),
         updated_at       = now()
   where user_id = v_uid;
end;
$$;

-- ── P2-12: apagar os dados sociais ─────────────────────────────────────────
-- "Desativar" esconde os números mas mantém amizades, turmas e os agregados
-- gravados. Faltava o caminho de exclusão de fato (direito do titular, LGPD).
-- Turmas de que a pessoa é dona são apagadas junto — a UI avisa antes.
create or replace function public.delete_my_social_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  delete from public.turmas       where owner_id = v_uid;           -- cascata nos membros
  delete from public.turma_members where user_id = v_uid;
  delete from public.friendships   where requester_id = v_uid or addressee_id = v_uid;
  delete from public.social_blocks where blocker_id = v_uid or blocked_id = v_uid;
  delete from public.social_profiles where user_id = v_uid;
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.get_my_blocks() from public, anon;
revoke all on function public.refresh_my_social_stats(text) from public, anon;
revoke all on function public.delete_my_social_data() from public, anon;
revoke all on function public.friendships_block_guard() from public, anon;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.get_my_blocks() to authenticated;
grant execute on function public.refresh_my_social_stats(text) to authenticated;
grant execute on function public.delete_my_social_data() to authenticated;
