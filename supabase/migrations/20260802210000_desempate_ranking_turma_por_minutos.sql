-- CORRIGE: ranking da turma mostrava "Você · 1min" acima de "Maria · 2min"
-- quando os dois estavam empatados em days_on_target (0) e streak (0).
--
-- CAUSA RAIZ
-- get_turma_ranking só desempatava por days_on_target e streak_current — sem
-- um 3º critério, o ORDER BY do Postgres não garante nenhuma ordem estável
-- entre linhas empatadas nesses dois campos (poderia até mudar entre
-- execuções). O ranking de Amigos (getSocialOverview, social.service.ts) já
-- resolve isso no cliente com
--   daysOnTarget desc || streak desc || weekMinutes desc
-- — a mesma auditoria de 31/07 (nota project_amigos_ranking_audit_jul2026)
-- já tinha apontado "desempates divergentes" entre os dois rankings; esta é
-- a causa raiz confirmada.
--
-- FIX: mesma cadeia de critérios na RPC da turma, + user_id como última
-- instância para 100% de determinismo mesmo em triplo empate exato.
create or replace function public.get_turma_ranking(p_turma_id uuid)
returns table(user_id uuid, name text, avatar_url text, streak_current integer, week_minutes integer, coverage_pct integer, days_on_target integer, role text, enabled boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
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
           coalesce(sp.streak_current, 0) desc,
           coalesce(sp.week_minutes, 0) desc,
           m.user_id;
$function$;
