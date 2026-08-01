-- Fila de revisão: topics e flashcards não tinham índice para a query de vencidas
-- (user_id + is_review_active + next_review_date), enquanto lei_interacoes e
-- juris_interacoes já seguem este padrão parcial. Iguala os quatro.
create index if not exists topics_due_idx
  on public.topics (user_id, next_review_date)
  where is_review_active;

create index if not exists flashcards_due_idx
  on public.flashcards (user_id, next_review_date)
  where is_review_active;
