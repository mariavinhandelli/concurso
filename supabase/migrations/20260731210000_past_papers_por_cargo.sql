-- Provas anteriores passam a ser por CARGO, não por concurso.
--
-- Bug encontrado pela Maria em 31/07: as fichas de 2021 (Área Judiciária e
-- Apoio Judiciário e Administrativo) exibiam a prova de 2024 na seção
-- "Provas anteriores". São cargos sem nenhuma interseção — o Concurso
-- Unificado de 2021 ofertou dois cargos e o de 2024 ofertou outros três, e
-- nenhum se repete entre as edições. Resolver a prova de Contador não ajuda
-- em nada quem estuda para Área Judiciária.
--
-- Causa: `edital_past_papers` só tinha `concurso_key`. Isso funcionava
-- enquanto cada concurso_key correspondia a um cargo só (PC-GO e PM-GO são
-- assim); quebrou quando os cinco cargos de servidor do TJ-GO passaram a
-- compartilhar a chave 'tj-go' para agrupar edições e histórico.
--
-- A correção não é separar as chaves de novo (aí perderíamos "Outras edições
-- e cargos deste concurso", que está certo): é dar à prova a dimensão que
-- lhe faltava. `edital_catalog_id` NOT NULL torna a regra estrutural — não dá
-- para cadastrar prova sem dizer de que cargo ela é.

-- ── 1. Coluna nova, ainda anulável para permitir o backfill ────────────────
alter table public.edital_past_papers
  add column if not exists edital_catalog_id uuid references public.editais_catalog(id) on delete cascade;

-- Nas linhas antigas concurso_key já era, na prática, o slug do cargo
-- (pc-go-agente, pm-go-soldado, tj-go-juiz-substituto...).
update public.edital_past_papers p
set edital_catalog_id = e.id
from public.editais_catalog e
where e.slug = p.concurso_key
and p.edital_catalog_id is null;

-- ── 2. As duas linhas genéricas do TJ-GO saem ──────────────────────────────
-- Eram 'tj-go' (concurso inteiro) e apontavam para o índice de provas da
-- banca. Viram cinco linhas, uma por cargo, com o caderno e o gabarito
-- daquele cargo.
delete from public.edital_past_papers
where concurso_key = 'tj-go' and edital_catalog_id is null;

insert into public.edital_past_papers (concurso_key, edital_catalog_id, ano, banca, prova_url, gabarito_url)
select e.slug, e.id, v.ano, v.banca, v.prova_url, v.gabarito_url
from (values
  -- Edital 02/2021 · Centro de Seleção/UFG · provas 19/12/2021, gabarito final 17/01/2022.
  -- A banca aplicou 4 tipos de caderno com as mesmas questões embaralhadas;
  -- linkamos o Tipo 1 e o gabarito final, que cobre os 4 tipos.
  ('tj-go-analista-judiciario', 2021, 'Centro de Seleção/UFG',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/provas/ANALISTA%20AREA%20JUDICIARIA%20TIPO%201.pdf',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/gabarito_final/GABARITO%20FINAL_04%20TIPOS_AREA%20JUDICIARIA.pdf'),
  ('tj-go-analista-apoio-administrativo', 2021, 'Centro de Seleção/UFG',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/provas/CADERNO-APOIO%20ADMINISTRATIVO%20TIPO%201.pdf',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/gabarito_final/GABARITO%20FINAL_04%20TIPOS_AREA%20APOIO%20ADMINISTRATIVO.pdf'),
  -- Edital 01/2024 · Instituto Verbena/UFG · provas 13/10/2024 (Oficial de
  -- Justiça e Analista de Sistemas) e 24/11/2024 (Contador).
  ('tj-go-oficial-de-justica', 2024, 'Instituto Verbena/UFG',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/prova/analista%20judiciario%20oficial%20de%20justica.pdf',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/gabarito_final/analista%20judiciario%20%20oficial%20de%20justica%20final.pdf'),
  ('tj-go-analista-sistemas', 2024, 'Instituto Verbena/UFG',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/prova/analista%20judiciario%20area%20especializada%20analista%20de%20sistemas.pdf',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/gabarito_final/analista%20judiciario%20%20area%20especializada%20analista%20de%20sistemas%20final.pdf'),
  -- Contador ficou fora do índice consolidado da banca porque a prova dele foi
  -- remarcada; caderno e gabarito final (reprocessado) moram em outra pasta.
  ('tj-go-contador', 2024, 'Instituto Verbena/UFG',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/prova/TJGO%20UNIFICADO%20Analista%20Judiciario%20%20area%20especializada%20contador.pdf',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/arquivos/GABARITO_FINAL_analista_judiciario_area_especializada_contador_repro.pdf')
) as v(edital_slug, ano, banca, prova_url, gabarito_url)
join public.editais_catalog e on e.slug = v.edital_slug
where not exists (
  select 1 from public.edital_past_papers p
  where p.edital_catalog_id = e.id and p.ano = v.ano
);

-- ── 3. A regra vira estrutura ──────────────────────────────────────────────
-- Qualquer linha órfã (concurso_key sem ficha correspondente) seria invisível
-- na UI de qualquer jeito; sai antes do NOT NULL.
delete from public.edital_past_papers where edital_catalog_id is null;

alter table public.edital_past_papers
  alter column edital_catalog_id set not null;

-- concurso_key deixa de decidir o que aparece na ficha. Fica só como rótulo
-- de origem, redundante com o slug — e coluna redundante que já foi chave de
-- filtro é armadilha. Sai.
alter table public.edital_past_papers drop column if exists concurso_key;

create unique index if not exists edital_past_papers_edital_ano_key
  on public.edital_past_papers (edital_catalog_id, ano);

create index if not exists edital_past_papers_edital_idx
  on public.edital_past_papers (edital_catalog_id);
