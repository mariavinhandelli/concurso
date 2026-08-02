-- Auditoria de performance (02/08) — advisor `multiple_permissive_policies`:
-- social_profiles tinha DUAS policies permissivas de SELECT
-- (social_profiles_select_own + social_profiles_select_friends), avaliadas
-- as DUAS em toda leitura da tabela (custo dobrado de RLS por linha).
-- Mescladas numa só via OR — semanticamente idêntico: dono sempre vê o
-- próprio perfil (mesmo desativado); resto do mundo só vê perfis com
-- enabled=true de quem tem amizade aceita.
drop policy social_profiles_select_friends on public.social_profiles;

alter policy social_profiles_select_own on public.social_profiles
  using (
    (select auth.uid()) = user_id
    or (
      enabled = true
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = social_profiles.user_id)
            or (f.addressee_id = (select auth.uid()) and f.requester_id = social_profiles.user_id)
          )
      )
    )
  );
