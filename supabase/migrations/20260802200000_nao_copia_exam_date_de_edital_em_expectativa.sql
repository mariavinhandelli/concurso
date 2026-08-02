-- CORRIGE: novo usuário ativa um edital do catálogo em "em_expectativa"
-- (nenhum edital novo saiu ainda) e a Home mostra imediatamente
-- "PRÓXIMA PROVA: realizada" — antes de estudar 1 minuto.
--
-- CAUSA RAIZ
-- activate_catalog_edital copiava editais_catalog.exam_date literalmente pra
-- target_exams.exam_date em QUALQUER situação. Só que exam_date de um edital
-- 'em_expectativa' não é uma prova futura: é a data do último concurso
-- REALIZADO, mantida ali só como referência de origem da grade (matérias e
-- pesos foram extraídos daquele edital). Os 27 editais em_expectativa do
-- catálogo compartilham a MESMA data (2022-07-17) — prova de que é
-- placeholder, não previsão. Os 3 'vigente' têm datas reais e distintas
-- (2026-03-29) e devem continuar sendo copiadas: ali exam_date É a prova.
--
-- FIX: só copia exam_date quando situacao = 'vigente'. Em_expectativa entra
-- com exam_date NULL — ExamCountdown.tsx já trata isso (mostra "Sem data
-- definida — Definir →" em vez do contador), que é a leitura correta: "ainda
-- não sabemos quando será a próxima prova deste concurso".
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
  v_exam_date date;
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

  select id into v_target_id from target_exams
  where user_id = v_user_id
    and (slug = v_edital.slug or catalog_edital_id = p_edital_id)
  order by (slug = v_edital.slug) desc
  limit 1;
  if v_target_id is not null then
    update target_exams set catalog_edital_id = p_edital_id
    where id = v_target_id and catalog_edital_id is null;
    return v_target_id;
  end if;

  v_exam_date := null;
  if v_edital.situacao = 'vigente' and v_edital.banca is not null then
    select id into v_board_id from exam_boards
    where user_id = v_user_id and lower(name) = lower(v_edital.banca) limit 1;
    if v_board_id is null then
      insert into exam_boards (user_id, name)
      values (v_user_id, v_edital.banca)
      returning id into v_board_id;
    end if;
    v_phase := 'pos';
    v_exam_date := v_edital.exam_date;
  end if;

  insert into target_exams (user_id, orgao, cargo, ano_alvo, exam_date, slug, phase, board_id, catalog_edital_id)
  values (v_user_id, v_edital.orgao, v_edital.cargo, v_edital.ano, v_exam_date, v_edital.slug, v_phase, v_board_id, p_edital_id)
  returning id into v_target_id;

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

  insert into topic_target_exams (topic_id, target_exam_id, incidencia)
  select t.id, v_target_id, coalesce(ect.incidencia, 0)
  from edital_catalog_topics ect
  join topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = v_user_id
  where ect.edital_catalog_id = p_edital_id
  on conflict do nothing;

  return v_target_id;
end;
$function$;

-- Backfill: targets já criados a partir de edital em_expectativa que ainda
-- carregam a data-placeholder intocada (exam_date = exam_date do catálogo).
-- Não mexe em quem já editou a data manualmente (deixaria de bater com o
-- catálogo) nem em editais 'vigente' (data real, correta desde sempre).
update target_exams te
set exam_date = null
from editais_catalog ec
where ec.id = te.catalog_edital_id
  and ec.situacao = 'em_expectativa'
  and te.exam_date = ec.exam_date;
