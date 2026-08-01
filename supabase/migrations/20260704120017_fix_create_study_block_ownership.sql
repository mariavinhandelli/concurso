CREATE OR REPLACE FUNCTION public.create_study_block(
  p_block_date date,
  p_subject_id uuid,
  p_topic_id uuid,
  p_planned_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next_pos int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Valida que subject_id pertence ao usuário autenticado.
  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE id = p_subject_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'subject_id não pertence ao usuário autenticado';
  END IF;

  -- Valida que topic_id pertence ao usuário autenticado.
  IF p_topic_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.topics WHERE id = p_topic_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'topic_id não pertence ao usuário autenticado';
  END IF;

  -- Advisory lock serializa inserts concorrentes do mesmo usuário na mesma data.
  PERFORM pg_advisory_xact_lock(abs(hashtext(v_uid::text || p_block_date::text)));

  SELECT COALESCE(MAX(position) + 1, 0)
  INTO v_next_pos
  FROM public.study_blocks
  WHERE user_id = v_uid AND block_date = p_block_date;

  INSERT INTO public.study_blocks (user_id, block_date, subject_id, topic_id, planned_minutes, position)
  VALUES (v_uid, p_block_date, p_subject_id, p_topic_id, p_planned_minutes, v_next_pos);
END;
$$;
