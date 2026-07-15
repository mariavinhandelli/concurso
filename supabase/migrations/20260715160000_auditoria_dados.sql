-- Hub de Editais — auditoria de dados (15/07/2026): preenche lacunas com
-- fatos verificados em ≥1 fonte nomeada e corrige o aviso desatualizado do
-- TCE-GO. Nada de número inventado: nota de corte do TJ-GO Juiz e prova do
-- Escrivão PC-GO não foram publicadas de forma verificável → seguem vazias.

-- 1) TCE-GO: aviso estava pré-contrato ("banca definida, vagas não divulgadas");
-- desde 09/06/2026 o Contrato 14/2026 fixa 16 vagas. Remuneração diverge entre
-- fontes → vai como faixa no aviso, nunca no campo numérico.
update public.editais_catalog
set aviso = 'FCC contratada em 09/06/2026 (Contrato nº 14/2026): 16 vagas imediatas de nível médio, sem cadastro de reserva — Técnico Administrativo (6) e Tecnologia da Informação (10, sendo 1 PcD). Datas e remuneração oficiais só com o edital; as fontes divergem sobre o valor (vencimento inicial ~R$ 5,1 mil; R$ 11,4–12,4 mil somando gratificações do órgão).'
where slug = 'tce-go-tecnico-controle-externo';

-- 2) Histórico: inscritos verificados
update public.edital_concurso_stats set inscritos = 52746
where concurso_key = 'pm-go-soldado' and ano = 2022 and inscritos is null;   -- Direção Concursos
update public.edital_concurso_stats set inscritos = 9935
where concurso_key = 'pm-go-oficial' and ano = 2022 and inscritos is null;   -- Direção Concursos (Cadete)
update public.edital_concurso_stats set inscritos = 5111
where concurso_key = 'tj-go-juiz-substituto' and ano = 2025 and inscritos is null; -- Magistrar/TJGO

-- 3) Provas anteriores (URLs verificadas)
insert into public.edital_past_papers (concurso_key, ano, banca, prova_url, gabarito_url)
select v.* from (values
  ('pm-go-soldado', 2022, 'Instituto AOCP',
   'https://arquivos.qconcursos.com/prova/arquivo_prova/88310/instituto-aocp-2022-pm-go-soldado-de-2-classe-qppm-combatente-prova.pdf',
   'https://arquivos.qconcursos.com/prova/arquivo_gabarito/88310/instituto-aocp-2022-pm-go-soldado-de-2-classe-qppm-combatente-gabarito.pdf'),
  ('pm-go-oficial', 2022, 'Instituto AOCP',
   'https://www.qconcursos.com/questoes-militares/provas/instituto-aocp-2022-pm-go-aspirante-da-policia-militar', null),
  ('tj-go-juiz-substituto', 2026, 'FGV',
   'https://www.qconcursos.com/questoes-de-concursos/provas/fgv-2026-tj-go-juiz-substituto', null)
) as v(concurso_key, ano, banca, prova_url, gabarito_url)
where not exists (
  select 1 from public.edital_past_papers p
  where p.concurso_key = v.concurso_key and p.ano = v.ano
);

-- Gabarito do Agente PC-GO 2022 (PDF direto, verificado)
update public.edital_past_papers
set gabarito_url = 'https://arquivos.qconcursos.com/prova/arquivo_gabarito/89883/instituto-aocp-2022-pc-go-agente-de-policia-gabarito.pdf'
where concurso_key = 'pc-go-agente' and ano = 2022 and gabarito_url is null;

-- 4) Linha do tempo do TJ-GO Juiz: resultado definitivo da objetiva (PDF FGV)
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select e.id, 'resultado', 'Resultado definitivo da prova objetiva divulgado',
  'https://conhecimento.fgv.br/sites/default/files/concursos/476_tjgo-resultado-objetiva-definitivo-2026-05-11.pdf',
  '2026-05-11'::date
from public.editais_catalog e
where e.slug = 'tj-go-juiz-substituto'
  and not exists (
    select 1 from public.edital_updates u
    where u.edital_catalog_id = e.id and u.titulo = 'Resultado definitivo da prova objetiva divulgado'
  );

-- 5) Nova rodada de verificação
update public.editais_catalog set verificado_em = '2026-07-15'
where slug in ('pm-go-soldado', 'pm-go-oficial', 'tce-go-tecnico-controle-externo', 'tj-go-juiz-substituto');
