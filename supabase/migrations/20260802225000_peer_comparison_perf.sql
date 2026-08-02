-- Auditoria de performance (02/08) — get_peer_comparison() rodava o MESMO
-- exists() correlacionado (social_profiles x target_exams) duas vezes: uma
-- pro count de pares, outra pro percentil. Reescrita usa uma CTE `peers`
-- (materializada por ser referenciada 3x) pra rodar essa varredura uma vez
-- só. Contrato e regras de privacidade (grupo mínimo de 5) idênticos.
--
-- Índice parcial em social_profiles(enabled) acelera o scan externo da CTE —
-- hoje a tabela é pequena, mas o scan cresce com o nº de perfis sociais
-- ativos na plataforma inteira, não só os do usuário.
create index if not exists idx_social_profiles_enabled
  on public.social_profiles (user_id)
  where enabled;

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
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from public.social_profiles s where s.user_id = v_uid and s.enabled) then
    return;
  end if;

  select t.catalog_edital_id,
         coalesce(nullif(trim(concat_ws(' · ', t.orgao, t.cargo)), ''), 'seu edital')
    into v_edital, v_label
  from public.target_exams t
  where t.user_id = v_uid and t.archived_at is null and t.catalog_edital_id is not null
  order by t.is_primary desc, t.created_at asc
  limit 1;

  if v_edital is null then return; end if;

  return query
  with peers as (
    select sp.days_on_target
    from public.social_profiles sp
    where sp.enabled
      and exists (
        select 1 from public.target_exams t2
        where t2.user_id = sp.user_id
          and t2.archived_at is null
          and t2.catalog_edital_id = v_edital
      )
  )
  select
    v_label,
    (select count(*)::int from peers),
    (select sp.days_on_target from public.social_profiles sp where sp.user_id = v_uid),
    -- ::numeric obrigatório: percentile_cont sobre int devolve double precision.
    (select percentile_cont(0.5) within group (order by days_on_target)::numeric from peers)
  where (select count(*) from peers) >= 5;
end;
$$;

revoke all on function public.get_peer_comparison() from public, anon;
grant execute on function public.get_peer_comparison() to authenticated;
