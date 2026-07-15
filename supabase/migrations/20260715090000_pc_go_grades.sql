-- Hub de Editais — curadoria das GRADES da PC-GO (última edição, 2022) +
-- provas anteriores + selo de verificação.
-- Fontes (14-15/07/2026): editais 006/2022 e 008/2022 (SEAD-GO), Nova
-- Concursos e Estratégia (distribuição de questões por disciplina — soma
-- exata: 80 questões Agente/Escrivão/Papiloscopista, 100 Delegado),
-- Qconcursos (provas/gabaritos AOCP 2022).
-- Regra: REUSA subjects_catalog/topics_catalog existentes; cria só as 7
-- disciplinas que não existiam. Disciplinas sem tópicos curados entram com
-- grade vazia (a usuária completa no Montar Edital) — nada é inventado.
-- Pesos 1–5 são curadoria derivada da distribuição REAL de questões.

-- 1) Selo de verificação: quando a ficha foi conferida contra as fontes
alter table public.editais_catalog
  add column if not exists verificado_em date;
update public.editais_catalog set verificado_em = '2026-07-14' where verificado_em is null;

-- 2) Disciplinas novas (sem tópicos, exceto Legislação Estadual — GO)
insert into public.subjects_catalog (slug, name, position, is_active)
select v.* from (values
  ('legislacao-estadual-go', 'Legislação Estadual — Goiás', 26, true),
  ('tecnicas-identificacao', 'Técnicas de Identificação (Papiloscopia)', 27, true),
  ('arquivologia', 'Arquivologia', 28, true),
  ('quimica-fisica-biologia', 'Química, Física e Biologia (Noções)', 29, true),
  ('direito-eleitoral', 'Direito Eleitoral', 30, true),
  ('direito-ambiental', 'Direito Ambiental', 31, true),
  ('direito-empresarial', 'Direito Empresarial', 32, true)
) as v(slug, name, position, is_active)
where not exists (select 1 from public.subjects_catalog s where s.slug = v.slug);

-- Tópicos da Legislação Estadual — GO (normas reais cobradas nos editais da PC-GO)
insert into public.topics_catalog (subject_catalog_id, name, position, slug)
select (select id from public.subjects_catalog where slug = 'legislacao-estadual-go'), v.name, v.position, v.slug
from (values
  ('Lei Orgânica da Polícia Civil do Estado de Goiás', 1, 'lei-organica-pc-go'),
  ('Estatuto dos Servidores Públicos do Estado de Goiás', 2, 'estatuto-servidores-go'),
  ('Processo administrativo estadual (Lei nº 13.800/2001)', 3, 'processo-administrativo-go')
) as v(name, position, slug)
where not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = (select id from public.subjects_catalog where slug = 'legislacao-estadual-go')
    and t.slug = v.slug
);

-- 3) Grades por cargo (distribuição REAL de questões da prova AOCP 2022)
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, v.num_q, v.position
from (values
  -- ── Agente de Polícia (80 questões) ──
  ('pc-go-agente', 'lingua-portuguesa', 3, 10, 1),
  ('pc-go-agente', 'conhecimentos-regionais', 1, 4, 2),
  ('pc-go-agente', 'rlm', 2, 5, 3),
  ('pc-go-agente', 'direito-administrativo', 2, 6, 4),
  ('pc-go-agente', 'direito-constitucional', 3, 7, 5),
  ('pc-go-agente', 'direito-penal', 5, 11, 6),
  ('pc-go-agente', 'direito-processual-penal', 5, 11, 7),
  ('pc-go-agente', 'legislacao-penal-especial', 5, 11, 8),
  ('pc-go-agente', 'criminalistica', 2, 5, 9),
  ('pc-go-agente', 'medicina-legal', 2, 5, 10),
  ('pc-go-agente', 'legislacao-estadual-go', 2, 5, 11),
  -- ── Escrivão de Polícia (80 questões — conteúdo idêntico ao de Agente) ──
  ('pc-go-escrivao', 'lingua-portuguesa', 3, 10, 1),
  ('pc-go-escrivao', 'conhecimentos-regionais', 1, 4, 2),
  ('pc-go-escrivao', 'rlm', 2, 5, 3),
  ('pc-go-escrivao', 'direito-administrativo', 2, 6, 4),
  ('pc-go-escrivao', 'direito-constitucional', 3, 7, 5),
  ('pc-go-escrivao', 'direito-penal', 5, 11, 6),
  ('pc-go-escrivao', 'direito-processual-penal', 5, 11, 7),
  ('pc-go-escrivao', 'legislacao-penal-especial', 5, 11, 8),
  ('pc-go-escrivao', 'criminalistica', 2, 5, 9),
  ('pc-go-escrivao', 'medicina-legal', 2, 5, 10),
  ('pc-go-escrivao', 'legislacao-estadual-go', 2, 5, 11),
  -- ── Papiloscopista (80 questões — grade própria) ──
  ('pc-go-papiloscopista', 'lingua-portuguesa', 3, 9, 1),
  ('pc-go-papiloscopista', 'conhecimentos-regionais', 1, 4, 2),
  ('pc-go-papiloscopista', 'rlm', 2, 5, 3),
  ('pc-go-papiloscopista', 'direito-administrativo', 2, 6, 4),
  ('pc-go-papiloscopista', 'direito-constitucional', 3, 8, 5),
  ('pc-go-papiloscopista', 'direito-penal', 5, 11, 6),
  ('pc-go-papiloscopista', 'direito-processual-penal', 4, 10, 7),
  ('pc-go-papiloscopista', 'criminalistica', 2, 5, 8),
  ('pc-go-papiloscopista', 'medicina-legal', 2, 5, 9),
  ('pc-go-papiloscopista', 'legislacao-estadual-go', 2, 6, 10),
  ('pc-go-papiloscopista', 'tecnicas-identificacao', 2, 5, 11),
  ('pc-go-papiloscopista', 'arquivologia', 1, 3, 12),
  ('pc-go-papiloscopista', 'quimica-fisica-biologia', 1, 3, 13),
  -- ── Delegado (100 questões; Criminologia+Med.Legal e Civil+Empresarial
  --    dividem 5 questões cada no edital — sem nº fixo por disciplina) ──
  ('pc-go-delegado', 'direito-penal', 5, 12, 1),
  ('pc-go-delegado', 'direito-processual-penal', 5, 12, 2),
  ('pc-go-delegado', 'legislacao-penal-especial', 5, 12, 3),
  ('pc-go-delegado', 'direito-constitucional', 5, 12, 4),
  ('pc-go-delegado', 'direito-administrativo', 5, 12, 5),
  ('pc-go-delegado', 'criminologia', 2, null, 6),
  ('pc-go-delegado', 'medicina-legal', 1, null, 7),
  ('pc-go-delegado', 'direito-civil', 2, null, 8),
  ('pc-go-delegado', 'direito-empresarial', 1, null, 9),
  ('pc-go-delegado', 'direito-eleitoral', 2, 5, 10),
  ('pc-go-delegado', 'direito-tributario', 2, 5, 11),
  ('pc-go-delegado', 'direito-ambiental', 2, 5, 12),
  ('pc-go-delegado', 'direitos-humanos', 2, 5, 13),
  ('pc-go-delegado', 'conhecimentos-regionais', 1, 5, 14),
  ('pc-go-delegado', 'legislacao-estadual-go', 2, 5, 15)
) as v(edital_slug, subject_slug, weight, num_q, position)
join public.editais_catalog e on e.slug = v.edital_slug
join public.subjects_catalog s on s.slug = v.subject_slug
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- 4) Vincula TODOS os tópicos curados das disciplinas de cada grade PC-GO
-- (a usuária refina no Montar Edital; disciplinas novas sem tópicos ficam
-- com grade vazia até curadoria).
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select ecs.edital_catalog_id, t.id
from public.edital_catalog_subjects ecs
join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug like 'pc-go-%'
join public.topics_catalog t on t.subject_catalog_id = ecs.subject_catalog_id
on conflict do nothing;

-- 5) Editais oficiais (SEAD-GO) — habilita "Baixar edital" da última edição
update public.editais_catalog
set edital_url = coalesce(edital_url, 'https://goias.gov.br/administracao/edital-006-2022-concurso-pc-go-agente-escrivao-e-papiloscopista/')
where slug in ('pc-go-agente', 'pc-go-escrivao', 'pc-go-papiloscopista');
update public.editais_catalog
set edital_url = coalesce(edital_url, 'https://goias.gov.br/administracao/edital-008-2022-pc-go-delegado/')
where slug = 'pc-go-delegado';

-- 6) Provas anteriores (links verificados — Qconcursos/arquivos oficiais AOCP)
insert into public.edital_past_papers (concurso_key, ano, banca, prova_url, gabarito_url)
select v.* from (values
  ('pc-go-agente', 2022, 'Instituto AOCP',
   'https://www.qconcursos.com/questoes-de-concursos/provas/instituto-aocp-2022-pc-go-agente-de-policia', null),
  ('pc-go-papiloscopista', 2022, 'Instituto AOCP',
   'https://www.qconcursos.com/questoes-de-concursos/provas/instituto-aocp-2022-pc-go-papiloscopista-policial-da-3-classe', null),
  ('pc-go-delegado', 2022, 'Instituto AOCP',
   'https://arquivos.qconcursos.com/prova/arquivo_prova/89779/instituto-aocp-2022-pc-go-delegado-de-policia-substituto-prova.pdf',
   'https://arquivos.qconcursos.com/prova/arquivo_gabarito/89779/instituto-aocp-2022-pc-go-delegado-de-policia-substituto-gabarito.pdf')
) as v(concurso_key, ano, banca, prova_url, gabarito_url)
where not exists (
  select 1 from public.edital_past_papers p
  where p.concurso_key = v.concurso_key and p.ano = v.ano
);
