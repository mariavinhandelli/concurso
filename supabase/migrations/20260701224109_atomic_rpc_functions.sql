-- B-04: append atômico de destaque (sem race condition de read-modify-write)
CREATE OR REPLACE FUNCTION append_juris_destaque(
  p_juris_id  UUID,
  p_destaque  JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
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

-- B-04: remoção atômica de destaque por id
CREATE OR REPLACE FUNCTION remove_juris_destaque(
  p_juris_id    UUID,
  p_destaque_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
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

-- B-06: troca de concurso primário em uma única instrução (atômico)
CREATE OR REPLACE FUNCTION set_primary_target_exam(p_target_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
BEGIN
  UPDATE target_exams
  SET is_primary = (id = p_target_id)
  WHERE user_id = v_uid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Concurso-alvo não encontrado.';
  END IF;

  -- Garante que o id pedido realmente existe para esse usuário
  IF NOT EXISTS (
    SELECT 1 FROM target_exams WHERE id = p_target_id AND user_id = v_uid
  ) THEN
    -- Desfaz: marca todos como false e relança o erro
    UPDATE target_exams SET is_primary = false WHERE user_id = v_uid;
    RAISE EXCEPTION 'ID de concurso-alvo inválido.';
  END IF;
END;
$$;

-- B-07: edição de regra de recorrência dentro de uma transação real
CREATE OR REPLACE FUNCTION edit_recurrence_rule_versioned(
  p_old_rule_id        UUID,
  p_mode               TEXT,
  p_end_date           DATE,
  p_cycle_per_day      INT,
  p_cycle_weekdays     INT[],
  p_cycle_daily_minutes INT,
  p_items              JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_new_id     UUID;
  v_yesterday  DATE := CURRENT_DATE - 1;
BEGIN
  -- Arquiva a regra antiga
  UPDATE recurrence_rules
  SET is_active = false, end_date = v_yesterday
  WHERE id = p_old_rule_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra de recorrência não encontrada.';
  END IF;

  -- Cria nova regra
  INSERT INTO recurrence_rules (
    user_id, mode, start_date, end_date, is_active,
    cycle_per_day, cycle_weekdays, cycle_daily_minutes
  ) VALUES (
    v_uid, p_mode, CURRENT_DATE, p_end_date, true,
    p_cycle_per_day, p_cycle_weekdays, p_cycle_daily_minutes
  ) RETURNING id INTO v_new_id;

  -- Insere os itens da nova regra
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
