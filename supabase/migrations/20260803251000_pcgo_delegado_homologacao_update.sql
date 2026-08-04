-- Double-check final do órgão PC-GO: Delegado (Edital 008) tinha 0 registros
-- em edital_updates, diferente dos outros 3 cargos (Edital 006). Mesma
-- homologação existe pro 008, fonte e data verificadas (HTTP 200, 20/12/2023).
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select e.id, 'resultado', 'Homologação do Edital de Resultado Final e Classificação do Concurso',
  'https://goias.gov.br/escoladegoverno/wp-content/uploads/sites/28/files/Concursos/2022/PoliciaCivil/Ed008-2022/20-12Homolog-vagasecadastrodereserva.pdf',
  '2023-12-20'
from public.editais_catalog e
where e.slug = 'pc-go-delegado'
  and not exists (
    select 1 from public.edital_updates u
    where u.edital_catalog_id = e.id and u.tipo = 'resultado' and u.published_at = '2023-12-20'
  );

do $$
declare v int;
begin
  select count(*) into v from public.edital_updates u
  join public.editais_catalog e on e.id = u.edital_catalog_id and e.slug = 'pc-go-delegado';
  if v <> 1 then raise exception 'esperado 1 update pro Delegado, achei %', v; end if;
end $$;
