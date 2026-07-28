-- Auditoria de Amigos & Turmas (27/07/2026) — correção dos 3 P0.
-- Causa raiz comum: RPCs SECURITY DEFINER que desfazem as policies de RLS
-- escritas para proteger o usuário. Ver docs/amigos-auditoria-jul2026.md.

-- ── P0-1: ninguém conseguia entrar em turma nenhuma ─────────────────────────
-- A função é plpgsql e declara o OUT param `turma_id`, que colide com a coluna
-- `turma_id` na cláusula de inferência do ON CONFLICT — plpgsql não sabe qual
-- dos dois é, e aborta com "column reference turma_id is ambiguous". Valia para
-- todo usuário e todo código, sempre: Turmas era create-only desde 09/07.
-- Apontar o ON CONFLICT direto para a constraint elimina a inferência (e com
-- ela a ambiguidade) sem renomear os OUT params, que são as chaves do JSON.
create or replace function public.join_turma_by_code(p_code text)
returns table (turma_id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select t.id, t.name into v_id, v_name from public.turmas t where t.join_code = upper(p_code) limit 1;
  if v_id is null then return; end if;
  insert into public.turma_members (turma_id, user_id, role)
  values (v_id, auth.uid(), 'member')
  on conflict on constraint turma_members_turma_id_user_id_key do nothing;
  return query select v_id, v_name;
end;
$$;

-- ── P0-2 e P0-3: os agregados vazavam por cima da RLS ──────────────────────
-- A policy social_profiles_select_friends está correta (exige `enabled = true`
-- E amizade 'accepted'), mas a tela lê por esta RPC, que é SECURITY DEFINER e
-- fazia o join sem nenhuma das duas condições. Duas consequências:
--   P0-2  "Desativar perfil social" não escondia nada de quem já era amigo —
--         quebrando a revogação de consentimento prometida na tela e na
--         Política de Privacidade.
--   P0-3  bastava mandar um pedido para qualquer código de convite para já ler
--         sequência, minutos e % do edital do alvo, sem aceite e sem que ele
--         soubesse.
-- Regra única daqui em diante:
--   nome/avatar  → sempre resolvidos. São necessários para a tela de pedidos
--                  (a RLS ainda não deixaria lê-los) e para o usuário conseguir
--                  gerenciar/desfazer a amizade. Não é exposição nova: quem já
--                  é amigo já viu o nome, e find_social_profile_by_code recusa
--                  perfis desativados, então ninguém novo descobre por aí.
--   agregados    → só com status = 'accepted' E enabled = true.
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
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.streak_current, 0) else 0 end as streak_current,
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.week_minutes, 0) else 0 end as week_minutes,
    case when f.status = 'accepted' and coalesce(sp.enabled, false)
         then coalesce(sp.coverage_pct, 0) else 0 end as coverage_pct,
    coalesce(sp.enabled, false) as enabled
  from public.friendships f
  left join public.social_profiles sp
    on sp.user_id = (case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end)
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid();
$$;

-- Mesmo P0-2 no ranking de turma: quem desativou o perfil continuava tendo os
-- números servidos a todos os colegas. Passa a devolver `enabled` para a tela
-- distinguir "0 minutos" de "perfil desativado" — sem isso, zerar os agregados
-- só trocaria um vazamento por uma comparação falsa no pódio.
-- O tipo de retorno muda, então precisa de DROP antes do CREATE.
drop function if exists public.get_turma_ranking(uuid);

create or replace function public.get_turma_ranking(p_turma_id uuid)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  streak_current int,
  week_minutes int,
  coverage_pct int,
  role text,
  enabled boolean
)
language sql security definer stable set search_path = public as $$
  select m.user_id, sp.display_name, sp.avatar_url,
    case when coalesce(sp.enabled, false) then coalesce(sp.streak_current, 0) else 0 end,
    case when coalesce(sp.enabled, false) then coalesce(sp.week_minutes, 0) else 0 end,
    case when coalesce(sp.enabled, false) then coalesce(sp.coverage_pct, 0) else 0 end,
    m.role,
    coalesce(sp.enabled, false)
  from public.turma_members m
  left join public.social_profiles sp on sp.user_id = m.user_id
  where m.turma_id = p_turma_id and public.is_turma_member(p_turma_id)
  order by case when coalesce(sp.enabled, false) then coalesce(sp.week_minutes, 0) else -1 end desc;
$$;

-- O DROP levou junto os grants da função antiga.
revoke all on function public.get_turma_ranking(uuid) from public, anon;
grant execute on function public.get_turma_ranking(uuid) to authenticated;
