-- Remove índices duplicados: mesma definição criada duas vezes.
-- Mantém o nome mais descritivo em cada par.

-- study_blocks: par (user_id, block_date) — mantém idx_study_blocks_user_date
DROP INDEX IF EXISTS public.idx_study_blocks_date;

-- recurrence_rules: par (user_id, is_active) — mantém idx_recurrence_rules_active
DROP INDEX IF EXISTS public.idx_rec_rules_user;
