-- TCE-GO Técnico de Controle Externo: grade PROVISÓRIA + a distinção que
-- faltava no catálogo entre grade curada de edital publicado e projeção.
--
-- Contexto (2ª auditoria, 28/07): o TCE-GO é o concurso que a usuária estuda e
-- era o único do catálogo sem nenhuma matéria — o hub abria vazio, a Central de
-- preparação não tinha destino e /editais mostrava "grade em preparação".
-- O edital ainda não saiu (FCC contratada em 09/06/2026, Contrato nº 14/2026),
-- então não existe conteúdo programático oficial para curar.
--
-- A grade abaixo é uma PREVISÃO, derivada do que já é público: formato fixado
-- em contrato (25 questões de Conhecimentos Gerais + 45 de Conhecimentos
-- Específicos + redação), cargo de nível médio na área de controle externo, e
-- o padrão FCC para Técnico de Tribunal de Contas. NÃO é o edital.
--
-- Por isso ela NÃO usa num_questions_expected: o total por bloco é conhecido,
-- mas a divisão por disciplina não — inventar "10 questões de Português"
-- seria fabricar precisão que ninguém tem. Os pesos 1–5 expressam a
-- importância relativa esperada, que é o que a previsão de fato sustenta.

-- ── 1. Marcador de origem da grade ──────────────────────────────────────────
-- Sem isto, a projeção do TCE-GO ficaria visualmente idêntica às grades de
-- PC-GO/PM-GO, que vêm de editais de 2022 realmente publicados. São coisas
-- epistemicamente diferentes e a UI precisa poder dizer qual é qual.
alter table public.editais_catalog
  add column if not exists grade_provisoria boolean not null default false;

comment on column public.editais_catalog.grade_provisoria is
  'true = conteúdo programático é previsão (edital ainda não publicado); false = curado de edital oficial.';

-- ── 2. Grade prevista ───────────────────────────────────────────────────────
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, null, v.position
from (values
  -- Conhecimentos Gerais (25 questões no total, divisão não publicada)
  ('Língua Portuguesa', 5, 1),
  ('Raciocínio Lógico-Matemático', 4, 2),
  ('Informática', 3, 3),
  -- Conhecimentos Específicos (45 questões no total, divisão não publicada)
  ('Controle Externo', 5, 4),
  ('Direito Administrativo', 5, 5),
  ('Direito Constitucional', 4, 6),
  ('Contabilidade Pública', 4, 7),
  ('Administração Financeira e Orçamentária', 4, 8),
  ('Direito Financeiro', 3, 9),
  ('Administração Pública', 3, 10),
  ('Legislação Estadual — Goiás', 3, 11)
) as v(subject_name, weight, position)
join public.subjects_catalog s on s.name = v.subject_name
cross join (select id from public.editais_catalog where slug = 'tce-go-tecnico-controle-externo') e
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- Tópicos: todos os da matéria (mesmo padrão das grades de PC-GO e TJ-GO).
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select ecs.edital_catalog_id, tc.id, null
from public.edital_catalog_subjects ecs
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
join public.editais_catalog e on e.id = ecs.edital_catalog_id
where e.slug = 'tce-go-tecnico-controle-externo'
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = ecs.edital_catalog_id and x.topic_catalog_id = tc.id
);

-- ── 3. Marca a grade como provisória e explica no aviso ─────────────────────
update public.editais_catalog
set grade_provisoria = true,
    verificado_em = '2026-07-29'
where slug = 'tce-go-tecnico-controle-externo';
