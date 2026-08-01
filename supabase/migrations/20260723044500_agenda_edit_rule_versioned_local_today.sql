-- Auditoria da Agenda (backlog U4): edição versionada usava CURRENT_DATE (UTC).
-- Entre ~21h e 00h BRT, "as mudanças valem a partir de hoje" viravam "a partir
-- de amanhã". O client agora envia a data local em p_today (default preserva
-- compatibilidade). DROP antes do CREATE: assinatura nova não pode coexistir
-- com a antiga (overload quebraria a chamada via PostgREST).
DROP FUNCTION IF EXISTS public.edit_recurrence_rule_versioned(uuid, text, date, integer, integer[], integer, jsonb);

CREATE FUNCTION public.edit_recurrence_rule_versioned(
  p_old_rule_id uuid, p_mode text, p_end_date date, p_cycle_per_day integer,
  p_cycle_weekdays integer[], p_cycle_daily_minutes integer, p_items jsonb,
  p_today date DEFAULT CURRENT_DATE
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_new_id     UUID;
  v_today      DATE := COALESCE(p_today, CURRENT_DATE);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- p_today vem do client; aceita só um desvio razoável do relógio do servidor
  -- (fusos reais: -12h..+14h) para não permitir versionar no passado remoto.
  IF abs(v_today - CURRENT_DATE) > 2 THEN
    v_today := CURRENT_DATE;
  END IF;

  -- Matérias dos itens precisam pertencer ao usuário autenticado.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS item
    LEFT JOIN public.subjects s
      ON s.id = (item->>'subject_id')::uuid AND s.user_id = v_uid
    WHERE s.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Matéria inválida ou de outro usuário.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS item
    LEFT JOIN public.topics t
      ON t.id = NULLIF(item->>'topic_id','')::uuid AND t.user_id = v_uid
    WHERE NULLIF(item->>'topic_id','') IS NOT NULL AND t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Tópico inválido ou de outro usuário.';
  END IF;

  UPDATE recurrence_rules
  SET is_active = false, end_date = v_today - 1
  WHERE id = p_old_rule_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra de recorrência não encontrada.';
  END IF;

  INSERT INTO recurrence_rules (
    user_id, mode, start_date, end_date, is_active,
    cycle_per_day, cycle_weekdays, cycle_daily_minutes
  ) VALUES (
    v_uid, p_mode::public.recurrence_mode, v_today, p_end_date, true,
    p_cycle_per_day, p_cycle_weekdays,
    LEAST(1440, GREATEST(0, COALESCE(p_cycle_daily_minutes, 180)))
  ) RETURNING id INTO v_new_id;

  INSERT INTO recurrence_items (
    rule_id, subject_id, topic_id, planned_minutes,
    weekday, cycle_order, position
  )
  SELECT
    v_new_id,
    (item->>'subject_id')::UUID,
    NULLIF(item->>'topic_id', '')::UUID,
    LEAST(1440, GREATEST(5, COALESCE((item->>'planned_minutes')::INT, 60))),
    NULLIF(item->>'weekday', '')::INT,
    NULLIF(item->>'cycle_order', '')::INT,
    COALESCE((item->>'position')::INT, 0)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_new_id;
END;
$function$;
