-- Tópicos-pai com filhos são pastas (mesma convenção de lib/topic-tree.ts e
-- useTargetDetail.ts: "pais com filhos não entram na contagem/árvore de
-- checklist"). A v2 vinculava TODO tópico presente em edital_catalog_topics,
-- inclusive pastas — inflando topic_target_exams além do denominador de
-- totalTopics (só folhas) e produzindo cobertura >100% em Montar Edital.
create or replace function public.activate_catalog_edital(p_edital_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_edital  record;
  v_target_id uuid;
  v_board_id uuid;
  v_phase exam_phase := 'pre';
  r_subj record;
  v_subject_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_edital from editais_catalog where id = p_edital_id and is_active;
  if v_edital is null then
    raise exception 'Edital não encontrado: %', p_edital_id;
  end if;

  -- idempotência: já ativou este edital? retorna o alvo existente (unique user_id, slug)
  select id into v_target_id from target_exams
  where user_id = v_user_id and slug = v_edital.slug limit 1;
  if v_target_id is not null then
    -- garante o vínculo com o catálogo em alvos criados antes da v2
    update target_exams set catalog_edital_id = p_edital_id
    where id = v_target_id and catalog_edital_id is null;
    return v_target_id;
  end if;

  -- edital vigente: a banca do catálogo vira exam_board do usuário (find-or-create)
  if v_edital.situacao = 'vigente' and v_edital.banca is not null then
    select id into v_board_id from exam_boards
    where user_id = v_user_id and lower(name) = lower(v_edital.banca) limit 1;
    if v_board_id is null then
      insert into exam_boards (user_id, name)
      values (v_user_id, v_edital.banca)
      returning id into v_board_id;
    end if;
    v_phase := 'pos';
  end if;

  insert into target_exams (user_id, orgao, cargo, ano_alvo, exam_date, slug, phase, board_id, catalog_edital_id)
  values (v_user_id, v_edital.orgao, v_edital.cargo, v_edital.ano, v_edital.exam_date, v_edital.slug, v_phase, v_board_id, p_edital_id)
  returning id into v_target_id;

  -- ativa cada matéria do edital e grava o peso da disciplina
  for r_subj in
    select subject_catalog_id, weight, num_questions_expected
    from edital_catalog_subjects
    where edital_catalog_id = p_edital_id
    order by position
  loop
    v_subject_id := activate_catalog_subject(r_subj.subject_catalog_id);

    insert into exam_blueprints (user_id, target_exam_id, subject_id, weight, num_questions_expected)
    values (v_user_id, v_target_id, v_subject_id, r_subj.weight, r_subj.num_questions_expected)
    on conflict (target_exam_id, subject_id)
    do update set weight = excluded.weight, num_questions_expected = excluded.num_questions_expected;
  end loop;

  -- vincula ao alvo somente os tópicos fiéis do edital (subconjunto oficial),
  -- excluindo pastas (tópicos-pai que têm filhos — não são folhas estudáveis)
  insert into topic_target_exams (topic_id, target_exam_id)
  select t.id, v_target_id
  from edital_catalog_topics ect
  join topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = v_user_id
  where ect.edital_catalog_id = p_edital_id
    and not exists (select 1 from topics c where c.parent_id = t.id)
  on conflict do nothing;

  return v_target_id;
end;
$function$;
