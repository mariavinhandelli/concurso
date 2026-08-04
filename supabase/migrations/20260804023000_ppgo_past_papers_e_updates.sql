-- PP-GO Policial Penal — prova/gabarito e linha do tempo. Prova objetiva
-- oficial hospedada em goias.gov.br (mesmo domínio do edital, evita
-- depender de terceiros); gabarito via qconcursos (verificado HTTP 200 —
-- IBFC exige login pra baixar o gabarito no próprio portal).
insert into public.edital_past_papers (edital_catalog_id, ano, banca, prova_url, gabarito_url)
select e.id, 2024, 'IBFC',
  'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2024/09/CadernodeProvasPPB.pdf',
  'https://arquivos.qconcursos.com/prova/arquivo_gabarito/122624/ibfc-2024-policia-penal-go-policial-penal-gabarito.pdf'
from public.editais_catalog e
where e.slug = 'policia-penal-go-policial'
and not exists (
  select 1 from public.edital_past_papers p where p.edital_catalog_id = e.id and p.ano = 2024
);

insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select e.id, 'resultado', 'Retificação do Resultado Final (Ampla Concorrência)',
  'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2025/12/221225-RetResFinal-Ampla.pdf',
  '2025-12-22'
from public.editais_catalog e
where e.slug = 'policia-penal-go-policial'
and not exists (
  select 1 from public.edital_updates u where u.edital_catalog_id = e.id and u.tipo = 'resultado' and u.published_at = '2025-12-22'
);

do $$
declare v int;
begin
  select count(*) into v from public.edital_past_papers p
  join public.editais_catalog e on e.id = p.edital_catalog_id and e.slug = 'policia-penal-go-policial';
  if v <> 1 then raise exception 'esperado 1 prova cadastrada, achei %', v; end if;

  select count(*) into v from public.edital_updates u
  join public.editais_catalog e on e.id = u.edital_catalog_id and e.slug = 'policia-penal-go-policial';
  if v <> 1 then raise exception 'esperado 1 update na timeline, achei %', v; end if;
end $$;
