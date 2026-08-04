-- PP-GO Policial Penal — matéria "Legislação Específica": as 2 leis mais
-- centrais do cargo. A Lei de Execução Penal (7.210/1984) é também o tema
-- da prova discursiva (assistências ao preso) — por isso ganha árvore
-- própria com os capítulos principais, em vez de um tópico único.
do $$
declare
  v_edital uuid;
  v_subject uuid;
  v_lep uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'policia-penal-go-policial';
  select id into v_subject from public.subjects_catalog where name = 'Legislação Específica';
  if v_edital is null or v_subject is null then raise exception 'edital ou matéria não encontrados'; end if;

  insert into public.topics_catalog (subject_catalog_id, name)
  select v_subject, v.name
  from (values
    ('Faltas disciplinares do Sistema Penitenciário de Goiás (Lei Estadual 12.786/1995)'),
    ('Lei de Execução Penal (Lei 7.210/1984)')
  ) as v(name)
  where not exists (select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = v_subject and tc2.name = v.name);

  select id into v_lep from public.topics_catalog where subject_catalog_id = v_subject and name = 'Lei de Execução Penal (Lei 7.210/1984)';

  insert into public.topics_catalog (subject_catalog_id, parent_id, name)
  select v_subject, v_lep, v.name
  from (values
    ('Direitos e deveres do preso e do internado'),
    ('Assistência ao preso e ao internado (material, saúde, jurídica, educacional, social e religiosa)'),
    ('Disciplina: faltas, sanções e recompensas'),
    ('Trabalho do preso'),
    ('Órgãos da execução penal (CNPCP, Juízo da Execução, MP, Conselho Penitenciário, Departamentos Penitenciários, Patronato, Conselho da Comunidade, Defensoria Pública)'),
    ('Estabelecimentos penais'),
    ('Execução das penas privativas de liberdade, restritivas de direitos e de multa'),
    ('Incidentes de execução (conversão, excesso ou desvio, anistia e indulto)'),
    ('Procedimento judicial da execução penal')
  ) as v(name)
  where not exists (select 1 from public.topics_catalog tc2 where tc2.parent_id = v_lep and tc2.name = v.name);

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc
  where tc.subject_catalog_id = v_subject
  on conflict do nothing;

  update public.edital_catalog_subjects set topicos_curados = true
  where edital_catalog_id = v_edital and subject_catalog_id = v_subject;
end $$;

do $$
declare v int;
begin
  select count(*) into v from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Legislação Específica'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'policia-penal-go-policial';
  if v <> 11 then raise exception 'Legislação Específica: esperado 11 (2 leis + 9 capítulos da LEP), achei %', v; end if;

  select count(*) into v from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'policia-penal-go-policial'
  join public.subjects_catalog s on s.id = ecs.subject_catalog_id and s.name = 'Legislação Específica'
  where not ecs.topicos_curados;
  if v <> 0 then raise exception 'Legislação Específica ainda não marcada como curada'; end if;
end $$;
