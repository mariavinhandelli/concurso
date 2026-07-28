-- percentile_cont sobre uma coluna int devolve double precision, mas o tipo de
-- retorno declarado em get_peer_comparison é numeric — "structure of query does
-- not match function result type".
--
-- O detalhe perigoso: a função só chega nessa linha depois de passar pela guarda
-- de grupo mínimo (5 pessoas no mesmo edital). Com menos que isso ela retorna
-- cedo e o erro fica invisível. Ou seja, quebraria em produção exatamente no dia
-- em que o 5º usuário entrasse num edital — e não antes.
--
-- Aplicado como migration própria para o histórico remoto bater com os arquivos;
-- 20260728120000 já carrega a versão corrigida, então um replay do zero aplica a
-- função certa duas vezes (create or replace, inofensivo).
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
