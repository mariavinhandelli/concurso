-- Índice para a query principal da página de matéria (topics por subject_id
-- ordenados por position) e para fetchMaxTopicPosition. Antes só havia índice
-- em parent_id e no parcial de revisões — filtro por subject_id era seq scan.
CREATE INDEX IF NOT EXISTS idx_topics_subject_position
  ON public.topics (subject_id, position);

-- Backfill: tópicos criados avulsos herdavam position=0 (default) e apareciam
-- no TOPO da lista em vez do fim. Move cada um para depois do maior position
-- de seus irmãos de nível raiz na mesma matéria.
UPDATE public.topics t
SET position = sub.max_pos + sub.rn
FROM (
  SELECT t2.id,
         row_number() OVER (PARTITION BY t2.subject_id ORDER BY t2.created_at) AS rn,
         (SELECT max(x.position) FROM public.topics x
           WHERE x.subject_id = t2.subject_id AND x.parent_id IS NULL) AS max_pos
  FROM public.topics t2
  WHERE t2.position = 0 AND t2.parent_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.topics y
      WHERE y.subject_id = t2.subject_id AND y.parent_id IS NULL
        AND y.position > 0 AND y.created_at < t2.created_at
    )
) sub
WHERE t.id = sub.id;
