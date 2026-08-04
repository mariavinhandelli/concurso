-- TJ-GO — Analista Judiciário — Área Judiciária (mesmo Edital 02/2021).
-- Programa muito mais abrangente que o de Apoio Administrativo: Direito
-- Civil, Processual Civil, Processual Penal e Administrativo cobrem quase
-- integralmente o catálogo. Só Direito Penal e Direito Constitucional têm
-- exclusões pontuais (temas não citados no Anexo IV).
do $$
declare
  v_edital uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-analista-judiciario';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id
    and ecs.edital_catalog_id = v_edital
    and s.name in (
      'Língua Portuguesa', 'Conhecimentos Regionais', 'Legislação Complementar (TJ-GO)',
      'Direito Civil', 'Direito Processual Civil', 'Direito Processual Penal', 'Direito Administrativo'
    );

  -- Direito Penal: programa não cita crimes contra a família, fé pública
  -- nem crimes contra a paz/incolumidade pública.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Direito Penal'
    and tc.name in (
      'Crimes contra a Família (arts. 235–249)',
      'Crimes contra a Fé Pública',
      'Falsidade documental',
      'Moeda falsa',
      'Crimes contra a Paz e a Incolumidade Pública'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Penal';

  -- Direito Constitucional: exclui Anistia/graça/indulto, Ordem
  -- Constitucional (econômica/social/tributária, não citada) e Funções
  -- essenciais à Justiça (MP/AGU/Defensoria, não citadas neste bloco).
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Direito Constitucional'
    and tc.name in (
      'Anistia, graça e indulto',
      'Ordem Constitucional',
      'Ordem Econômica e Financeira',
      'Ordem Social (seguridade, educação, meio ambiente)',
      'Sistema Tributário Nacional (na CF)',
      'Funções essenciais à Justiça (MP, AGU, Defensoria)'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Constitucional';
end $$;

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Direito Penal'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-judiciario';
  if v <> 44 then raise exception 'Direito Penal: esperado 44 restantes (49-5), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Direito Constitucional'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-judiciario';
  if v <> 28 then raise exception 'Direito Constitucional: esperado 28 restantes (34-6), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'tj-go-analista-judiciario'
  where not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
