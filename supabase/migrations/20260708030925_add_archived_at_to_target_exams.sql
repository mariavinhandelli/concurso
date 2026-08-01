-- M11: arquivamento transversal de concurso.
-- Coluna aditiva e reversível: NULL = concurso ativo; timestamp = arquivado.
ALTER TABLE public.target_exams ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Índice parcial para as listagens de ativos (WHERE archived_at IS NULL), por usuário.
CREATE INDEX IF NOT EXISTS idx_target_exams_active
  ON public.target_exams (user_id)
  WHERE archived_at IS NULL;
