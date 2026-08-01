-- 1) Torna jurisprudencias um banco GLOBAL (todos leem), mas só o criador edita/apaga.
ALTER TABLE jurisprudencias RENAME COLUMN user_id TO created_by;

-- Campos para os modos de estudo flashcard e questão (opcionais).
ALTER TABLE jurisprudencias ADD COLUMN flashcard_frente TEXT;
ALTER TABLE jurisprudencias ADD COLUMN flashcard_verso TEXT;
ALTER TABLE jurisprudencias ADD COLUMN questao_enunciado TEXT;
ALTER TABLE jurisprudencias ADD COLUMN questao_gabarito BOOLEAN;
ALTER TABLE jurisprudencias ADD COLUMN questao_comentario TEXT;

DROP POLICY "owner_full_access" ON jurisprudencias;

CREATE POLICY "juris_read_all" ON jurisprudencias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "juris_insert_own" ON jurisprudencias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "juris_update_own" ON jurisprudencias
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "juris_delete_own" ON jurisprudencias
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 2) Tabela de interações PESSOAIS — isolada por usuário.
CREATE TABLE juris_interacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jurisprudencia_id UUID NOT NULL REFERENCES jurisprudencias(id) ON DELETE CASCADE,

  favorito BOOLEAN NOT NULL DEFAULT false,
  estrelas_pessoais SMALLINT CHECK (estrelas_pessoais BETWEEN 1 AND 5),
  anotacoes TEXT,
  tags_pessoais TEXT[] NOT NULL DEFAULT '{}',
  destaques JSONB NOT NULL DEFAULT '[]',

  is_review_active BOOLEAN NOT NULL DEFAULT false,
  next_review_date DATE,
  interval_days INT NOT NULL DEFAULT 0,
  repetitions INT NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, jurisprudencia_id)
);

ALTER TABLE juris_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juris_interacoes_owner" ON juris_interacoes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX juris_interacoes_user_idx ON juris_interacoes (user_id);
CREATE INDEX juris_interacoes_juris_idx ON juris_interacoes (jurisprudencia_id);
CREATE INDEX juris_interacoes_due_idx ON juris_interacoes (user_id, next_review_date) WHERE is_review_active = true;
CREATE INDEX juris_interacoes_fav_idx ON juris_interacoes (user_id, favorito) WHERE favorito = true;
