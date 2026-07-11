-- Restaurar concurso deve poder reativar o ciclo que foi arquivado JUNTO no
-- gesto de arquivar (M11). Antes não havia como saber qual ciclo "pertencia"
-- ao concurso — agora o gesto registra o vínculo no próprio alvo.
alter table public.target_exams
  add column if not exists archived_cycle_rule_id uuid
    references public.recurrence_rules(id) on delete set null;
