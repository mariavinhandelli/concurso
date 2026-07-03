-- Desfaz o último registro de uma matéria no ciclo de forma atômica.
-- O SELECT e o DELETE ocorrem na mesma instrução SQL, eliminando a janela de race
-- condition (TOCTOU) que existia quando eram duas queries separadas no cliente.
create or replace function undo_last_cycle_completion(
  p_rule_id    uuid,
  p_subject_id uuid
) returns void
language sql
security definer
as $$
  delete from cycle_completions
  where id = (
    select id
    from   cycle_completions
    where  user_id    = auth.uid()
      and  rule_id    = p_rule_id
      and  subject_id = p_subject_id
    order by created_at desc
    limit 1
  );
$$;
