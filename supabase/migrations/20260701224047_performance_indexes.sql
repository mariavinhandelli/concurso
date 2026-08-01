-- B-12: índice composto para listRevisoesHoje (filtro por data já está no banco agora)
CREATE INDEX IF NOT EXISTS idx_juris_interacoes_review
  ON juris_interacoes(user_id, is_review_active, next_review_date);

-- índice para listBlocks semanal
CREATE INDEX IF NOT EXISTS idx_study_blocks_date
  ON study_blocks(user_id, block_date);

-- índice para listRules ativo
CREATE INDEX IF NOT EXISTS idx_recurrence_rules_active
  ON recurrence_rules(user_id, is_active);
