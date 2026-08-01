-- B-09: tabela para salvar resultados do simulado de jurisprudências
CREATE TABLE IF NOT EXISTS juris_simulado_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total         INT         NOT NULL CHECK (total > 0),
  certas        INT         NOT NULL CHECK (certas >= 0),
  elapsed_secs  INT         NOT NULL CHECK (elapsed_secs >= 0),
  respostas     JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juris_simulado_user_date
  ON juris_simulado_sessions(user_id, created_at DESC);

ALTER TABLE juris_simulado_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulado_sessions_owner" ON juris_simulado_sessions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
