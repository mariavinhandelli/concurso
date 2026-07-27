-- M4 — raridade de conquistas ("12% dos usuários têm esta").
-- SECURITY DEFINER porque a RLS de user_badges só deixa cada um ver as
-- próprias linhas; aqui devolvemos APENAS agregados anônimos (badge_id + %).
-- Badges de edital ficam de fora: os ids embutem o target_exam_id, que é
-- por usuário — raridade não faz sentido (seria sempre "1 usuário").
create or replace function public.get_badge_rarity()
returns table (badge_id text, pct integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    ub.badge_id,
    least(100, round(
      100.0 * count(distinct ub.user_id)
      / greatest((select count(*) from public.profiles), 1)
    ))::integer as pct
  from public.user_badges ub
  where ub.badge_id not like 'edital-%'
  group by ub.badge_id;
$$;

grant execute on function public.get_badge_rarity() to authenticated;
revoke execute on function public.get_badge_rarity() from anon;
