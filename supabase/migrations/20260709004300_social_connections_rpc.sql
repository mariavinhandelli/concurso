-- Retorna todas as conexões do CHAMADOR (amigos aceitos + pedidos pendentes) com
-- nome/avatar/stats do outro lado resolvidos. SECURITY DEFINER porque, em pedidos
-- pendentes, a RLS ainda não permite ler o social_profile do solicitante. Escopo
-- é sempre auth.uid() (o próprio usuário) — não vaza conexões de terceiros.
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
