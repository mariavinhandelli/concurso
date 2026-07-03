-- Soft delete para jurisprudências.
-- A coluna deleted_at nula = ativo; preenchida = excluído logicamente.
-- O índice parcial cobre apenas linhas ativas (hot path de leitura).

ALTER TABLE public.jurisprudencias
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jurisprudencias_active
  ON public.jurisprudencias (created_at DESC)
  WHERE deleted_at IS NULL;
