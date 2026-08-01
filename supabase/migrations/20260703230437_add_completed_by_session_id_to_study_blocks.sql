ALTER TABLE public.study_blocks
  ADD COLUMN IF NOT EXISTS completed_by_session_id text;
