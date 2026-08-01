CREATE TABLE jurisprudencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação
  tribunal TEXT NOT NULL,
  orgao_julgador TEXT,
  tipo TEXT NOT NULL DEFAULT 'acordao',
  informativo TEXT,
  processo TEXT,
  relator TEXT,
  data_julgamento DATE,
  data_publicacao DATE,
  status TEXT NOT NULL DEFAULT 'vigente',

  -- Classificação
  disciplina TEXT NOT NULL,
  materia TEXT,
  assunto TEXT,
  subassunto TEXT,

  -- Conteúdo
  dispositivos_relacionados TEXT,
  tese TEXT NOT NULL,
  resumo TEXT,
  explicacao_comparativa TEXT,
  por_que_aplica TEXT,
  esquema_visual TEXT,
  exemplo_pratico TEXT,
  pegadinhas TEXT,
  tese_banca TEXT,
  como_banca_cobra TEXT,
  palavras_chave TEXT[] DEFAULT '{}',

  -- Importância
  estrelas SMALLINT DEFAULT 3 CHECK (estrelas BETWEEN 1 AND 5),
  incidencia_concursos TEXT DEFAULT 'media',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jurisprudencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_full_access" ON jurisprudencias
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX jurisprudencias_user_idx ON jurisprudencias (user_id);
CREATE INDEX jurisprudencias_tribunal_idx ON jurisprudencias (tribunal);
CREATE INDEX jurisprudencias_disciplina_idx ON jurisprudencias (disciplina);
