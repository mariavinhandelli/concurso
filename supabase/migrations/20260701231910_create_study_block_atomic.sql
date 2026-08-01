CREATE OR REPLACE FUNCTION create_study_block(
  p_block_date date,
  p_subject_id uuid,
  p_topic_id uuid,
  p_planned_minutes int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next_pos int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Advisory lock serializa inserts concorrentes do mesmo usuário na mesma data.
  -- hashtext é estável e barato; abs() evita overflow de bigint negativo.
  PERFORM pg_advisory_xact_lock(abs(hashtext(v_uid::text || p_block_date::text)));

  SELECT COALESCE(MAX(position) + 1, 0)
  INTO v_next_pos
  FROM study_blocks
  WHERE user_id = v_uid AND block_date = p_block_date;

  INSERT INTO study_blocks (user_id, block_date, subject_id, topic_id, planned_minutes, position)
  VALUES (v_uid, p_block_date, p_subject_id, p_topic_id, p_planned_minutes, v_next_pos);
END;
$$;
