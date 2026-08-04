-- TJ-GO — Analista Judiciário — Área Especializada — Analista de Sistemas
-- Edital 01/2024 (Instituto Verbena/UFG), Anexo IV embutido no PDF
-- compilado. Achado: os tópicos de Atualidades/Legislação/Raciocínio
-- Lógico/Tecnologia da Informação já foram cadastrados como paráfrase 1:1
-- deste programa — cobertura plena. Só Língua Portuguesa exclui Redação
-- Oficial: este edital não cita gêneros textuais oficiais (ofício,
-- memorando etc.), diferente do edital 2021 do mesmo órgão.
do $$
declare
  v_edital uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-analista-sistemas';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id
    and ecs.edital_catalog_id = v_edital
    and s.name in ('Atualidades e Conhecimentos Gerais', 'Legislação (Ética, Improbidade e Licitações)', 'Raciocínio Lógico-Matemático', 'Tecnologia da Informação');

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Língua Portuguesa'
    and tc.name in (
      'Redação Oficial',
      'Princípios e características (Manual da Presidência)',
      'Pronomes de tratamento',
      'Tipos de documentos (ofício, memorando...)'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Língua Portuguesa';
end $$;

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Língua Portuguesa'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-analista-sistemas';
  if v <> 30 then raise exception 'Língua Portuguesa: esperado 30 restantes (34-4), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'tj-go-analista-sistemas'
  where not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
