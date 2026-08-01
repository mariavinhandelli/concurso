-- append_juris_destaque: add explicit auth check
CREATE OR REPLACE FUNCTION public.append_juris_destaque(p_juris_id uuid, p_destaque jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO juris_interacoes (user_id, jurisprudencia_id, destaques, updated_at)
  VALUES (v_uid, p_juris_id, jsonb_build_array(p_destaque), now())
  ON CONFLICT (user_id, jurisprudencia_id)
  DO UPDATE SET
    destaques  = juris_interacoes.destaques || jsonb_build_array(p_destaque),
    updated_at = now()
  RETURNING destaques INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- remove_juris_destaque: add explicit auth check
CREATE OR REPLACE FUNCTION public.remove_juris_destaque(p_juris_id uuid, p_destaque_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE juris_interacoes
  SET
    destaques  = (
      SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
      FROM jsonb_array_elements(destaques) AS d
      WHERE d->>'id' <> p_destaque_id
    ),
    updated_at = now()
  WHERE user_id = v_uid AND jurisprudencia_id = p_juris_id
  RETURNING destaques INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- edit_recurrence_rule_versioned: add explicit auth check
CREATE OR REPLACE FUNCTION public.edit_recurrence_rule_versioned(
  p_old_rule_id uuid, p_mode text, p_end_date date,
  p_cycle_per_day integer, p_cycle_weekdays integer[],
  p_cycle_daily_minutes integer, p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_new_id     UUID;
  v_yesterday  DATE := CURRENT_DATE - 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE recurrence_rules
  SET is_active = false, end_date = v_yesterday
  WHERE id = p_old_rule_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra de recorrência não encontrada.';
  END IF;

  INSERT INTO recurrence_rules (
    user_id, mode, start_date, end_date, is_active,
    cycle_per_day, cycle_weekdays, cycle_daily_minutes
  ) VALUES (
    v_uid, p_mode, CURRENT_DATE, p_end_date, true,
    p_cycle_per_day, p_cycle_weekdays, p_cycle_daily_minutes
  ) RETURNING id INTO v_new_id;

  INSERT INTO recurrence_items (
    rule_id, subject_id, topic_id, planned_minutes,
    weekday, cycle_order, position
  )
  SELECT
    v_new_id,
    (item->>'subject_id')::UUID,
    NULLIF(item->>'topic_id', '')::UUID,
    COALESCE((item->>'planned_minutes')::INT, 60),
    NULLIF(item->>'weekday', '')::INT,
    NULLIF(item->>'cycle_order', '')::INT,
    COALESCE((item->>'position')::INT, 0)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_new_id;
END;
$$;

-- set_primary_target_exam: add explicit auth check
CREATE OR REPLACE FUNCTION public.set_primary_target_exam(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE target_exams
  SET is_primary = (id = p_target_id)
  WHERE user_id = v_uid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Concurso-alvo não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM target_exams WHERE id = p_target_id AND user_id = v_uid
  ) THEN
    UPDATE target_exams SET is_primary = false WHERE user_id = v_uid;
    RAISE EXCEPTION 'ID de concurso-alvo inválido.';
  END IF;
END;
$$;
