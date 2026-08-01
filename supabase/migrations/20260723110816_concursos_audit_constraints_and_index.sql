-- Auditoria do módulo Concursos (jul/2026):
-- 1) Regras de negócio no banco: peso 1 a 5 e questões esperadas não-negativas
--    (um -5 digitado na UI chegou a persistir antes desta correção).
alter table exam_blueprints
  add constraint exam_blueprints_weight_range check (weight >= 1 and weight <= 5),
  add constraint exam_blueprints_num_questions_nonneg check (num_questions_expected is null or num_questions_expected >= 0);

-- 2) Índice para as consultas do módulo (listLinkedTopicIds/pesos buscam por
--    target_exam_id; a PK começa por topic_id e não serve a esse acesso).
create index if not exists idx_topic_target_exams_target on topic_target_exams (target_exam_id);
