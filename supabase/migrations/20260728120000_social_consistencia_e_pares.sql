-- Oportunidades O2 e O3 de docs/amigos-oportunidades-mercado-jul2026.md.
--
-- O2 — o pódio ordenava por MINUTOS da semana. A literatura de gamificação
-- educacional é específica: leaderboard absoluto desengaja quem está embaixo
-- (fica menos propenso a fechar a distância), enquanto formato relativo motiva.
-- Para um público com ansiedade de desempenho, ranquear volume bruto é o pior
-- desenho possível — e ainda contradiz a tese que o /progresso já adotou.
--
-- A métrica passa a ser CONSTÂNCIA: em quantos dos últimos 7 dias a pessoa bateu
-- a PRÓPRIA meta diária. É auto-referente (não pune quem tem menos tempo),
-- limitada a 0..7 (não vira corrida de volume) e mede o que o app ensina.
alter table public.social_profiles
  add column if not exists days_on_target int not null default 0;

-- O2 — recálculo dos agregados, agora incluindo days_on_target.
-- A meta diária mora em profiles.settings->>'dailyTargetMinutes'. Quem não
-- definiu meta cai no piso de 30 min/dia, o MESMO limiar que já define "dia que
-- conta" para a sequência — assim ninguém fica travado em 0 por não ter mexido
-- nas configurações. Consequência assumida: quem definiu 240 min tem uma barra
-- mais alta que quem não definiu nada. É proposital — o número responde "você
-- cumpriu o que combinou consigo?", não "quem estudou mais". A tela diz isso
-- com todas as letras ("bateu a própria meta").
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
  v_meta_min  int;
  v_on_target int  := 0;
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

  -- ── constância: dias na própria meta, na mesma janela de 7 dias ──
  select greatest(coalesce(nullif(p.settings->>'dailyTargetMinutes', '')::int, 0), 30)
    into v_meta_min
  from public.profiles p where p.id = v_uid;
  v_meta_min := coalesce(v_meta_min, 30);

  select count(*)::int into v_on_target
  from (
    select (l.started_at at time zone p_tz)::date as day
    from public.study_logs l
    where l.user_id = v_uid
      and (l.started_at at time zone p_tz)::date >= v_today - 6
      and (l.started_at at time zone p_tz)::date <= v_today
    group by 1
    having round(sum(coalesce(l.duration_sec, 0)) / 60.0) >= v_meta_min
  ) d;

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
         days_on_target   = v_on_target,
         stats_updated_at = now(),
         updated_at       = now()
   where user_id = v_uid;
end;
$$;

-- Repassa days_on_target nas duas leituras de ranking, mantendo a regra de
-- exposição da migration 20260727120000 (agregados só com amizade aceita E
-- perfil ativo do outro lado).
drop function if exists public.get_social_connections();
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
  days_on_target int,
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
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.streak_current, 0) else 0 end as streak_current,
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.week_minutes, 0) else 0 end as week_minutes,
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.coverage_pct, 0) else 0 end as coverage_pct,
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.days_on_target, 0) else 0 end as days_on_target,
    coalesce(sp.enabled, false) as enabled
  from public.friendships f
  left join public.social_profiles sp
    on sp.user_id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid();
$$;

revoke all on function public.get_social_connections() from public, anon;
grant execute on function public.get_social_connections() to authenticated;

drop function if exists public.get_turma_ranking(uuid);
create or replace function public.get_turma_ranking(p_turma_id uuid)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  streak_current int,
  week_minutes int,
  coverage_pct int,
  days_on_target int,
  role text,
  enabled boolean
)
language sql security definer stable set search_path = public as $$
  select m.user_id, sp.display_name, sp.avatar_url,
    case when coalesce(sp.enabled, false) then coalesce(sp.streak_current, 0) else 0 end,
    case when coalesce(sp.enabled, false) then coalesce(sp.week_minutes, 0) else 0 end,
    case when coalesce(sp.enabled, false) then coalesce(sp.coverage_pct, 0) else 0 end,
    case when coalesce(sp.enabled, false) then coalesce(sp.days_on_target, 0) else 0 end,
    m.role,
    coalesce(sp.enabled, false)
  from public.turma_members m
  left join public.social_profiles sp on sp.user_id = m.user_id
  where m.turma_id = p_turma_id and public.is_turma_member(p_turma_id)
  order by case when coalesce(sp.enabled, false) then coalesce(sp.days_on_target, 0) else -1 end desc,
           coalesce(sp.streak_current, 0) desc;
$$;

revoke all on function public.get_turma_ranking(uuid) from public, anon;
grant execute on function public.get_turma_ranking(uuid) to authenticated;

-- ── O3: comparação com pares do MESMO edital ───────────────────────────────
-- Listar indivíduos num pódio é o formato que desmotiva; comparar com um grupo
-- parecido é o que motiva. E é um dado que só a Focali tem: nem Discord nem os
-- apps de timer sabem para qual concurso a pessoa estuda.
--
-- Três travas de privacidade, todas deliberadas:
--   1. só entram usuários que ATIVARAM o perfil social (consentimento) — usar
--      dado de quem não optou seria repetir o erro da auditoria;
--   2. nada de individual sai daqui: só contagem e mediana;
--   3. grupo mínimo de 5 pessoas (eu + 4). Abaixo disso não devolve nada, senão
--      "a mediana das outras 2 pessoas" é identificação disfarçada de agregado.
-- Com 3 perfis ativos hoje isso corretamente não aparece ainda.
create or replace function public.get_peer_comparison()
returns table (
  edital_label text,
  peers_total int,
  my_days_on_target int,
  median_days_on_target numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_edital uuid;
  v_label  text;
  v_total  int;
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from public.social_profiles s where s.user_id = v_uid and s.enabled) then
    return;
  end if;

  -- Meu edital do catálogo (mesma regra de alvo primário do resto do app).
  select t.catalog_edital_id,
         coalesce(nullif(trim(concat_ws(' · ', t.orgao, t.cargo)), ''), 'seu edital')
    into v_edital, v_label
  from public.target_exams t
  where t.user_id = v_uid and t.archived_at is null and t.catalog_edital_id is not null
  order by t.is_primary desc, t.created_at asc
  limit 1;

  if v_edital is null then return; end if;

  select count(*)::int into v_total
  from public.social_profiles sp
  where sp.enabled
    and exists (
      select 1 from public.target_exams t2
      where t2.user_id = sp.user_id
        and t2.archived_at is null
        and t2.catalog_edital_id = v_edital
    );

  if coalesce(v_total, 0) < 5 then return; end if;

  return query
  select v_label,
         v_total,
         (select sp.days_on_target from public.social_profiles sp where sp.user_id = v_uid),
         -- ::numeric é obrigatório: percentile_cont sobre int devolve
         -- double precision, e o tipo de retorno declarado é numeric. Sem o
         -- cast a função só quebraria no dia em que o 5º usuário entrasse no
         -- edital — até lá a guarda de grupo mínimo escondia o erro.
         (select percentile_cont(0.5) within group (order by sp.days_on_target)::numeric
            from public.social_profiles sp
           where sp.enabled
             and exists (
               select 1 from public.target_exams t3
               where t3.user_id = sp.user_id
                 and t3.archived_at is null
                 and t3.catalog_edital_id = v_edital
             ));
end;
$$;

revoke all on function public.get_peer_comparison() from public, anon;
grant execute on function public.get_peer_comparison() to authenticated;
