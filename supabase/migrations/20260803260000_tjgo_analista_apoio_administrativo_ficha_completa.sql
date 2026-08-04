-- TJ-GO — Analista Judiciário — Área de Apoio Judiciário e Administrativo
-- Edital 02/2021 (Centro de Seleção/UFG), Anexo IV consolidado pelo Edital
-- Complementar nº 1. Curadoria das 6 matérias vinculadas.
--
-- Achados:
-- - Língua Portuguesa, Conhecimentos Regionais e Legislação Complementar
--   (TJ-GO): cobertura 1:1 com o catálogo atual — sem exclusão.
-- - Direito Administrativo: programa é "NOÇÕES" (7 questões), bem mais
--   enxuto que a versão completa de outros cargos do mesmo órgão. Exclui
--   Bens Públicos, Improbidade (Lei 8.429/92), Intervenção do Estado na
--   Propriedade, LAI/Transparência, Poder de Polícia, Poderes
--   Administrativos, Responsabilidade Civil do Estado, Serviços Públicos.
-- - Direito Constitucional: programa também restrito (5 questões), foca em
--   direitos/garantias fundamentais + poder constituinte + normas sobre
--   Administração Pública/servidores + Poder Judiciário. Exclui Anistia/
--   graça/indulto, Controle de Constitucionalidade, Defesa do Estado,
--   Eficácia das Normas, Ordem Constitucional inteira, e dentro de
--   Organização do Estado/dos Poderes/Teoria da Constituição só ficam os
--   filhos explicitamente citados.
do $$
declare
  v_edital uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-analista-apoio-administrativo';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  -- Confirma cobertura plena (sem exclusão) nas 3 matérias já 1:1
  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id
    and ecs.edital_catalog_id = v_edital
    and s.name in ('Língua Portuguesa', 'Conhecimentos Regionais', 'Legislação Complementar (TJ-GO)');

  -- Direito Administrativo: exclui o que não cai no programa "noções"
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Direito Administrativo'
    and tc.name in (
      'Bens Públicos',
      'Improbidade Administrativa (Lei 8.429/92)',
      'Intervenção do Estado na Propriedade',
      'Desapropriação',
      'Servidão, requisição, tombamento e limitações',
      'Lei de Acesso à Informação e Transparência',
      'Poder de Polícia',
      'Poderes Administrativos',
      'Responsabilidade Civil do Estado',
      'Serviços Públicos',
      'Conceito, princípios e classificação',
      'Concessão, permissão e autorização'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Administrativo';

  -- Direito Constitucional: só o que o programa de 5 questões cita
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Direito Constitucional'
    and tc.name in (
      'Anistia, graça e indulto',
      'Controle de Constitucionalidade',
      'Controle concentrado (ADI, ADC, ADPF)',
      'Controle difuso',
      'Defesa do Estado e das Instituições',
      'Eficácia das Normas Constitucionais',
      'Ordem Constitucional',
      'Ordem Econômica e Financeira',
      'Ordem Social (seguridade, educação, meio ambiente)',
      'Sistema Tributário Nacional (na CF)',
      'Organização político-administrativa',
      'Repartição de competências',
      'União, Estados, Municípios e DF',
      'Funções essenciais à Justiça (MP, AGU, Defensoria)',
      'Poder Executivo (atribuições e responsabilidade)',
      'Poder Legislativo (estrutura e imunidades)',
      'Processo legislativo',
      'Tribunais de Contas (fiscalização)',
      'Conceito e classificação das constituições',
      'Constitucionalismo'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Constitucional';

  -- Administração Pública (18 questões): programa é focado em políticas
  -- públicas, governança, ferramentas orçamentárias (PPA/LDO/LOA),
  -- transparência e inovação — não cita gestão de pessoas, estrutura
  -- organizacional, qualidade nem ética/integridade como temas próprios.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Administração Pública'
    and tc.name in (
      'Estrutura e Cultura Organizacional',
      'Cultura e clima organizacional',
      'Departamentalização',
      'Tipos de estrutura organizacional',
      'Ética e Integridade na Gestão Pública',
      'Ética no serviço público e código de conduta',
      'Integridade, compliance e prevenção à corrupção',
      'Gestão da Qualidade',
      'Melhoria contínua e excelência na gestão pública',
      'Princípios e ferramentas da qualidade',
      'Gestão de Pessoas no Setor Público',
      'Avaliação e gestão de desempenho',
      'Gestão por competências',
      'Liderança, motivação e comunicação',
      'Processo Organizacional (funções)',
      'Controle',
      'Direção',
      'Organização',
      'Planejamento',
      'Abordagem comportamental e de sistemas',
      'Abordagem contingencial',
      'Governo aberto e dados abertos',
      'Governo digital e transformação digital'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Administração Pública';
end $$;

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Direito Administrativo'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-apoio-administrativo';
  if v <> 27 then raise exception 'Direito Administrativo: esperado 27 restantes (39-12), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Direito Constitucional'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-apoio-administrativo';
  if v <> 14 then raise exception 'Direito Constitucional: esperado 14 restantes (34-20), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Administração Pública'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-apoio-administrativo';
  if v <> 27 then raise exception 'Administração Pública: esperado 27 restantes (50-23), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'tj-go-analista-apoio-administrativo'
  where not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
