-- Cobertura do programa oficial da PM-GO (03/08): a curadoria de 31/07
-- (20260731230000) só olhou numa direção — REMOVEU do edital os tópicos que o
-- Anexo II não cobra. Ninguém conferiu a direção inversa: itens do programa
-- oficial SEM tópico correspondente. Auditoria de 03/08 (Anexos II retificados
-- de 12/05/2022, mesmos PDFs da curadoria) encontrou:
--
--   (a) ERRO de curadoria: o Soldado cobra "Processo e julgamento dos crimes
--       de responsabilidade dos funcionários públicos" (CPP arts. 513–518,
--       procedimento especial), mas a curadoria excluiu "Procedimentos
--       especiais" — contra o próprio princípio "na dúvida, mantém". Religa.
--   (b) 26 itens do programa sem tópico no catálogo (incidentes do CPP, leis
--       da Legislação Extravagante, Lei estadual 13.800, Constituição de GO,
--       tempo de guerra no CPM/CPPM, atualidades, leis penais do Cadete…).
--
-- REGRA ESTRUTURAL respeitada aqui: tópico novo NUNCA vira filho de tópico que
-- hoje é folha (ex.: "Processo Administrativo (Lei 9.784/99)", "Aspectos
-- Políticos"). O vínculo ao alvo é só de folhas (`not exists children`);
-- transformar folha em pai desvincularia o tópico dos alvos de OUTROS editais
-- que o listam. Nesses casos o tópico novo nasce na raiz da matéria.
--
-- Nota: 'Processo administrativo estadual (Lei 13.800/2001)' já existe no
-- catálogo, mas dentro de legislacao-estadual-go (grade da PC-GO). A PM-GO não
-- tem essa matéria — o Anexo II põe a 13.800 DENTRO de Direito Administrativo,
-- então o tópico nasce lá (o edital manda na organização, mesmo custo do
-- precedente da PC-GO na direção oposta).
--
-- BACKFILL: 8 alvos ativos de PM-GO (7 usuários). Para cada um: insere os
-- tópicos novos do SEU edital no acervo (mesma semântica do
-- activate_catalog_subject: adoção por nome via immutable_unaccent, filho só
-- se o pai existir no acervo) e religa topic_target_exams (folhas, idempotente).

-- ── 1. Tópicos novos no catálogo ─────────────────────────────────────────────
create temp table _novos (
  materia text, parent text, name text, slug text, pos int, editais text[]
) on commit drop;

insert into _novos values
  -- Direito Penal
  ('Direito Penal', 'Aplicação da Lei Penal', 'Disposições constitucionais aplicáveis ao direito penal', 'dp-disposicoes-constitucionais', 4, array['pm-go-soldado']),
  ('Direito Penal', null, 'Crimes contra a Família (arts. 235–249)', 'dp-crimes-familia', 12, array['pm-go-oficial']),
  -- Legislação Penal Especial (o Cadete cobra várias leis penais dentro de
  -- "Direito Penal" no Anexo II; no catálogo elas vivem na LPE — o vínculo ao
  -- alvo não depende da matéria, só do tópico)
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes de racismo (Lei 7.716/89)', 'lpe-racismo', 5, array['pm-go-soldado','pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Juizados Especiais Criminais (Leis 9.099/95 e 10.259/01)', 'lpe-juizados', 6, array['pm-go-soldado','pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Interceptação telefônica (Lei 9.296/96)', 'lpe-interceptacao', 7, array['pm-go-soldado','pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Pacote Anticrime (Lei 13.964/19)', 'lpe-anticrime', 8, array['pm-go-soldado']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Lei das Contravenções Penais (DL 3.688/41)', 'lpe-contravencoes', 9, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Estatuto do Idoso — crimes (Lei 10.741/03)', 'lpe-idoso', 10, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes contra a ordem tributária (Lei 8.137/90)', 'lpe-ordem-tributaria', 11, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes de responsabilidade de prefeitos e vereadores (DL 201/67)', 'lpe-dl201', 12, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes falimentares (Lei 11.101/05)', 'lpe-falimentares', 13, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes no parcelamento do solo urbano (Lei 6.766/79)', 'lpe-parcelamento-solo', 14, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Crimes de imprensa (Lei 5.250/67)', 'lpe-imprensa', 15, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Uso de documento de identificação (Lei 5.553/68)', 'lpe-doc-identificacao', 16, array['pm-go-oficial']),
  ('Legislação Penal Especial', 'Outras Leis Penais Relevantes', 'Estatuto dos Policiais Militares de GO (Lei 8.033/75)', 'lpe-estatuto-pm-go', 17, array['pm-go-oficial']),
  -- Direito Constitucional
  ('Direito Constitucional', 'Organização do Estado', 'Constituição do Estado de Goiás', 'dc-constituicao-go', 5, array['pm-go-oficial']),
  ('Direito Constitucional', null, 'Anistia, graça e indulto', 'dc-anistia-indulto', 10, array['pm-go-soldado-musico']),
  -- Direito Administrativo
  ('Direito Administrativo', null, 'Processo administrativo de Goiás (Lei estadual 13.800/01)', 'da-processo-adm-go', 16, array['pm-go-soldado','pm-go-soldado-musico','pm-go-oficial']),
  ('Direito Administrativo', 'Organização Administrativa', 'Agências reguladoras, privatização e desestatização', 'da-agencias-privatizacao', 5, array['pm-go-oficial']),
  -- Conhecimentos Regionais (raiz: "Aspectos Políticos" é folha vinculada)
  ('Conhecimentos Regionais', null, 'Atualidades do Brasil e de Goiás', 'cr-atualidades', 7, array['pm-go-soldado','pm-go-soldado-musico','pm-go-oficial']),
  -- Direito Penal Militar
  ('Direito Penal Militar', 'Crimes Militares em Espécie', 'Crimes militares em tempo de guerra (arts. 355–408)', 'dpm-tempo-guerra', 4, array['pm-go-soldado','pm-go-soldado-musico','pm-go-oficial']),
  -- Direito Processual Penal Militar
  ('Direito Processual Penal Militar', 'Ação Penal e Processo Militar', 'Comunicações processuais (citação, intimação, notificação)', 'dppm-comunicacoes', 3, array['pm-go-soldado','pm-go-oficial']),
  ('Direito Processual Penal Militar', 'Ação Penal e Processo Militar', 'Questões prejudiciais e incidentes no CPPM', 'dppm-incidentes', 4, array['pm-go-soldado','pm-go-oficial']),
  ('Direito Processual Penal Militar', 'Ação Penal e Processo Militar', 'Provas no processo penal militar (atos probatórios)', 'dppm-provas', 5, array['pm-go-soldado','pm-go-oficial']),
  ('Direito Processual Penal Militar', 'Justiça Militar e Recursos', 'Execução e justiça militar em tempo de guerra', 'dppm-execucao-guerra', 3, array['pm-go-soldado','pm-go-oficial']),
  -- Direito Processual Penal (raiz: capítulo próprio do CPP, arts. 92–154)
  ('Direito Processual Penal', null, 'Questões e processos incidentes', 'dpp-incidentes', 10, array['pm-go-soldado','pm-go-oficial']);

-- Pais precisam existir E já ser pais (nunca converter folha em pai).
do $$
declare v int;
begin
  select count(*) into v from _novos n
  where n.parent is not null and not exists (
    select 1 from public.topics_catalog p
    join public.subjects_catalog s on s.id = p.subject_catalog_id
    join public.topics_catalog filho on filho.parent_id = p.id
    where s.name = n.materia and p.name = n.parent
  );
  if v > 0 then
    raise exception 'Pai inexistente ou folha (converteria folha em pai): % linhas', v;
  end if;
end $$;

insert into public.topics_catalog (subject_catalog_id, parent_id, name, slug, position)
select s.id, p.id, n.name, n.slug, n.pos
from _novos n
join public.subjects_catalog s on s.name = n.materia
left join public.topics_catalog p on n.parent is not null
  and p.subject_catalog_id = s.id and p.name = n.parent and p.parent_id is null
where not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = n.name
);

-- ── 2. Vínculos edital → tópico ──────────────────────────────────────────────
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from _novos n
join public.subjects_catalog s on s.name = n.materia
join public.topics_catalog tc on tc.subject_catalog_id = s.id and tc.name = n.name
join public.editais_catalog e on e.slug = any (n.editais)
on conflict do nothing;

-- (a) Religa "Procedimentos especiais" ao Soldado (removido por engano em 31/07).
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from public.editais_catalog e, public.topics_catalog tc
join public.subjects_catalog s on s.id = tc.subject_catalog_id
where e.slug = 'pm-go-soldado'
  and s.name = 'Direito Processual Penal' and tc.name = 'Procedimentos especiais'
on conflict do nothing;

-- ── 3. Backfill dos alvos ativos ─────────────────────────────────────────────
-- Mesma semântica do activate_catalog_subject/activate_catalog_edital, restrita
-- aos alvos de PM-GO não arquivados.
create temp table _alvos on commit drop as
select distinct te.id as target_id, te.user_id, e.id as edital_id
from public.target_exams te
join public.editais_catalog e on e.id = te.catalog_edital_id or e.slug = te.slug
where e.slug in ('pm-go-soldado', 'pm-go-soldado-musico', 'pm-go-oficial')
  and te.archived_at is null;

-- 3a. Adoção por nome: tópico manual homônimo vira o tópico de catálogo.
update public.topics t
set catalog_id = tc.id
from (
  select distinct a.user_id, ect.topic_catalog_id
  from _alvos a join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
) alvo
join public.topics_catalog tc on tc.id = alvo.topic_catalog_id
join public.subjects su on su.user_id = alvo.user_id and su.catalog_id = tc.subject_catalog_id
where t.user_id = alvo.user_id and t.subject_id = su.id and t.catalog_id is null
  and lower(trim(public.immutable_unaccent(t.name))) = lower(trim(public.immutable_unaccent(tc.name)));

-- 3b. Insere no acervo o que falta (filho só quando o pai existe no acervo —
-- se o usuário apagou a pasta, respeita).
insert into public.topics (user_id, subject_id, name, position, catalog_id, parent_id)
select alvo.user_id, su.id, tc.name, tc.position, tc.id, tp.id
from (
  select distinct a.user_id, ect.topic_catalog_id
  from _alvos a join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
) alvo
join public.topics_catalog tc on tc.id = alvo.topic_catalog_id
join public.subjects su on su.user_id = alvo.user_id and su.catalog_id = tc.subject_catalog_id
left join public.topics tp on tc.parent_id is not null
  and tp.user_id = alvo.user_id and tp.catalog_id = tc.parent_id
where (tc.parent_id is null or tp.id is not null)
  and not exists (
    select 1 from public.topics t2
    where t2.user_id = alvo.user_id and t2.subject_id = su.id and t2.catalog_id = tc.id
  )
  and not exists (
    select 1 from public.topics t3
    where t3.user_id = alvo.user_id and t3.subject_id = su.id
      and lower(trim(public.immutable_unaccent(t3.name))) = lower(trim(public.immutable_unaccent(tc.name)))
  );

-- 3c. Religa os vínculos do alvo (folhas, idempotente — pega os novos e o
-- "Procedimentos especiais" religado).
insert into public.topic_target_exams (topic_id, target_exam_id)
select t.id, a.target_id
from _alvos a
join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
join public.topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = a.user_id
where not exists (select 1 from public.topics c where c.parent_id = t.id)
on conflict do nothing;

-- ── 4. Verificação dura ──────────────────────────────────────────────────────
do $$
declare v int;
begin
  -- 26 tópicos novos existem no catálogo
  select count(*) into v from _novos n
  where not exists (
    select 1 from public.topics_catalog tc
    join public.subjects_catalog s on s.id = tc.subject_catalog_id
    where s.name = n.materia and tc.name = n.name
  );
  if v > 0 then raise exception 'Tópicos novos ausentes do catálogo: %', v; end if;

  -- Listas dos editais nos tamanhos esperados (188+14=202; 121+4=125; 240+23=263)
  select count(*) into v from public.edital_catalog_topics ect
  join public.editais_catalog e on e.id = ect.edital_catalog_id where e.slug = 'pm-go-soldado';
  if v <> 202 then raise exception 'pm-go-soldado: esperado 202 tópicos, achei %', v; end if;
  select count(*) into v from public.edital_catalog_topics ect
  join public.editais_catalog e on e.id = ect.edital_catalog_id where e.slug = 'pm-go-soldado-musico';
  if v <> 125 then raise exception 'pm-go-soldado-musico: esperado 125 tópicos, achei %', v; end if;
  select count(*) into v from public.edital_catalog_topics ect
  join public.editais_catalog e on e.id = ect.edital_catalog_id where e.slug = 'pm-go-oficial';
  if v <> 263 then raise exception 'pm-go-oficial: esperado 263 tópicos, achei %', v; end if;

  -- Nenhum alvo ativo de PM-GO ficou sem os vínculos novos do seu edital
  -- (todo tópico-folha do edital cujo usuário tem a matéria deve estar vinculado)
  select count(*) into v
  from _alvos a
  join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
  join public.topics_catalog tc on tc.id = ect.topic_catalog_id
  join public.subjects su on su.user_id = a.user_id and su.catalog_id = tc.subject_catalog_id
  join public.topics t on t.catalog_id = tc.id and t.user_id = a.user_id
  where not exists (select 1 from public.topics c where c.parent_id = t.id)
    and not exists (select 1 from public.topic_target_exams x where x.topic_id = t.id and x.target_exam_id = a.target_id);
  if v > 0 then raise exception 'Vínculos faltando após backfill: %', v; end if;
end $$;

-- Ficha conferida contra o Anexo II hoje.
update public.editais_catalog set verificado_em = '2026-08-03'
where slug in ('pm-go-soldado', 'pm-go-soldado-musico', 'pm-go-oficial');
