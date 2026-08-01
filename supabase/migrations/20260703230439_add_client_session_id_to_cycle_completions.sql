ALTER TABLE public.cycle_completions
  ADD COLUMN IF NOT EXISTS client_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS cycle_completions_user_client_session_uniq
  ON public.cycle_completions (user_id, client_session_id)
  WHERE client_session_id IS NOT NULL;
