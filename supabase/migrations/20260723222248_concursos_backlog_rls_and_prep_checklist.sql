-- Backlog da auditoria de Concursos (23/07/2026):

-- 1) Hardening: a policy de topic_target_exams validava só a posse do TÓPICO,
--    permitindo referenciar target_exam de outro usuário (impacto baixo, mas
--    conceitualmente errado). Agora exige posse dos dois lados.
drop policy "own topic_targets" on topic_target_exams;
create policy "own topic_targets" on topic_target_exams
  for all
  using (
    (select auth.uid()) = (select t.user_id from topics t where t.id = topic_target_exams.topic_id)
    and (select auth.uid()) = (select te.user_id from target_exams te where te.id = topic_target_exams.target_exam_id)
  )
  with check (
    (select auth.uid()) = (select t.user_id from topics t where t.id = topic_target_exams.topic_id)
    and (select auth.uid()) = (select te.user_id from target_exams te where te.id = topic_target_exams.target_exam_id)
  );

-- 2) Checklist da Central de preparação sai do localStorage e vai para o banco
--    (sincroniza entre dispositivos e morre junto com o concurso).
--    Array JSON de chaves marcadas manualmente, ex.: ["prova-ultima","juris"].
alter table target_exams
  add column if not exists prep_checklist jsonb not null default '[]'::jsonb;
