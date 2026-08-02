-- Backfill do fix em 20260802220000_activate_catalog_edital_nao_vincula_topico_pasta.sql
-- Remove vínculos-pasta criados por ativações anteriores (todos os usuários).
-- Medido antes: 331 vínculos-pasta de 2066 total, em 6 dos 11 concursos ativados.
-- Nenhum subtópico real (folha) é afetado — só tópicos que têm filhos.
delete from topic_target_exams tte
using topics t
where tte.topic_id = t.id
  and exists (select 1 from topics c where c.parent_id = t.id);
