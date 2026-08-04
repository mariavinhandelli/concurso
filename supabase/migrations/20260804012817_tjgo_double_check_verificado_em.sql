update public.editais_catalog
set verificado_em = '2026-08-03'
where slug in ('tj-go-analista-apoio-administrativo','tj-go-analista-judiciario','tj-go-analista-sistemas','tj-go-contador','tj-go-oficial-de-justica','tj-go-juiz-substituto');

do $$
declare v int;
begin
  select count(*) into v from public.editais_catalog
  where slug ilike 'tj-go%' and verificado_em <> '2026-08-03';
  if v <> 0 then raise exception 'algum cargo TJ-GO não teve verificado_em atualizado: %', v; end if;
end $$;
