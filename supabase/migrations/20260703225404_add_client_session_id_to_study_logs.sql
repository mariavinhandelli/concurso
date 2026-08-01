ALTER TABLE public.study_logs
  ADD COLUMN IF NOT EXISTS client_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS study_logs_user_client_session_uniq
  ON public.study_logs (user_id, client_session_id)
  WHERE client_session_id IS NOT NULL;
