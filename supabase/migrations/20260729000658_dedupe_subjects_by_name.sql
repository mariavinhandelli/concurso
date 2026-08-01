-- Unifica matérias duplicadas (mesmo user_id + nome normalizado) que hoje coexistem
-- por causa de activate_catalog_subject não checar nome antes de criar. Sobrevivente é
-- escolhida pelo maior sinal de uso real (ciclo/logs/erros/notas/blocos), empatando pela
-- mais antiga. A perdedora tem seus filhos remapeados para a sobrevivente e é apagada.
do $$
declare
  r record;
  ids_arr uuid[];
  survivor_id uuid;
  loser_id uuid;
begin
  for r in
    select user_id, lower(trim(name)) as norm_name, array_agg(id) as ids
    from subjects
    group by user_id, lower(trim(name))
    having count(*) > 1
  loop
    ids_arr := r.ids;

    select s.id into survivor_id
    from subjects s
    where s.id = any(ids_arr)
    order by (
      (select count(*) from recurrence_items ri where ri.subject_id = s.id) * 1000
      + (select count(*) from cycle_completions cc where cc.subject_id = s.id) * 500
      + (select count(*) from study_logs sl where sl.subject_id = s.id) * 100
      + (select count(*) from error_notebooks en where en.subject_id = s.id) * 50
      + (select count(*) from study_notes sn where sn.subject_id = s.id) * 50
      + (select count(*) from study_blocks sb where sb.subject_id = s.id) * 50
    ) desc, s.created_at asc
    limit 1;

    for loser_id in select unnest(ids_arr) except select survivor_id
    loop
      update topics set subject_id = survivor_id where subject_id = loser_id;
      update study_logs set subject_id = survivor_id where subject_id = loser_id;
      update flashcards set subject_id = survivor_id where subject_id = loser_id;
      update error_notebooks set subject_id = survivor_id where subject_id = loser_id;
      update question_bank set subject_id = survivor_id where subject_id = loser_id;
      update study_notes set subject_id = survivor_id where subject_id = loser_id;
      update recurrence_overrides set override_subject_id = survivor_id where override_subject_id = loser_id;
      update recurrence_items set subject_id = survivor_id where subject_id = loser_id;
      update study_blocks set subject_id = survivor_id where subject_id = loser_id;
      update cycle_completions set subject_id = survivor_id where subject_id = loser_id;

      insert into exam_blueprints (user_id, target_exam_id, subject_id, weight, num_questions_expected)
      select user_id, target_exam_id, survivor_id, weight, num_questions_expected
      from exam_blueprints where subject_id = loser_id
      on conflict (target_exam_id, subject_id) do update
        set weight = excluded.weight, num_questions_expected = excluded.num_questions_expected;
      delete from exam_blueprints where subject_id = loser_id;

      update subjects s2 set catalog_id = l.catalog_id
      from subjects l where l.id = loser_id and s2.id = survivor_id and s2.catalog_id is null;

      update subjects set status = 'ativo' where id = survivor_id and status = 'arquivado';

      delete from subjects where id = loser_id;
    end loop;
  end loop;
end $$;
