-- Auditoria da Agenda (jul/2026)
-- 1) Corrige edit_recurrence_rule_versioned: o INSERT quebrava com
--    'column "mode" is of type recurrence_mode but expression is of type text'
--    (editar recorrência falhava 100%). Aproveita para validar posse das
--    matérias/tópicos (função é SECURITY DEFINER) e sanear minutos.
CREATE OR REPLACE FUNCTION public.edit_recurrence_rule_versioned(
  p_old_rule_id uuid, p_mode text, p_end_date date, p_cycle_per_day integer,
  p_cycle_weekdays integer[], p_cycle_daily_minutes integer, p_items jsonb
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_new_id     UUID;
  v_yesterday  DATE := CURRENT_DATE - 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
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

  -- Tópicos (quando presentes) também.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS item
    LEFT JOIN public.topics t
      ON t.id = NULLIF(item->>'topic_id','')::uuid AND t.user_id = v_uid
    WHERE NULLIF(item->>'topic_id','') IS NOT NULL AND t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Tópico inválido ou de outro usuário.';
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
    v_uid, p_mode::public.recurrence_mode, CURRENT_DATE, p_end_date, true,
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

-- 2) create_study_block: rejeita durações absurdas (aceitava -30, 0, 99999).
CREATE OR REPLACE FUNCTION public.create_study_block(
  p_block_date date, p_subject_id uuid, p_topic_id uuid, p_planned_minutes integer
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_next_pos int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_planned_minutes IS NULL OR p_planned_minutes < 1 OR p_planned_minutes > 1440 THEN
    RAISE EXCEPTION 'Duração inválida: use entre 1 e 1440 minutos.';
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE id = p_subject_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'subject_id não pertence ao usuário autenticado';
  END IF;

  IF p_topic_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.topics WHERE id = p_topic_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'topic_id não pertence ao usuário autenticado';
  END IF;

  PERFORM pg_advisory_xact_lock(abs(hashtext(v_uid::text || p_block_date::text)));

  SELECT COALESCE(MAX(position) + 1, 0)
  INTO v_next_pos
  FROM public.study_blocks
  WHERE user_id = v_uid AND block_date = p_block_date;

  INSERT INTO public.study_blocks (user_id, block_date, subject_id, topic_id, planned_minutes, position)
  VALUES (v_uid, p_block_date, p_subject_id, p_topic_id, p_planned_minutes, v_next_pos);
END;
$function$;

-- 3) Cintos de segurança no schema (dados atuais já validados: 0 violações).
ALTER TABLE public.study_blocks
  ADD CONSTRAINT study_blocks_planned_minutes_check
  CHECK (planned_minutes > 0 AND planned_minutes <= 1440);
ALTER TABLE public.recurrence_items
  ADD CONSTRAINT recurrence_items_planned_minutes_check
  CHECK (planned_minutes > 0 AND planned_minutes <= 1440);
ALTER TABLE public.cycle_completions
  ADD CONSTRAINT cycle_completions_minutes_check
  CHECK (minutes >= 0 AND minutes <= 1440);
ALTER TABLE public.recurrence_rules
  ADD CONSTRAINT recurrence_rules_cycle_daily_minutes_check
  CHECK (cycle_daily_minutes >= 0 AND cycle_daily_minutes <= 1440);

-- 4) Uma ocorrência de recorrência = no máximo 1 override (evita duplicatas
--    em corrida de duas abas/dispositivos; habilita upsert no client).
CREATE UNIQUE INDEX IF NOT EXISTS recurrence_overrides_occurrence_uniq
  ON public.recurrence_overrides (rule_id, item_id, occur_date);

-- 5) Índice único parcial redundante (o índice completo em
--    (user_id, client_session_id) já cobre o upsert e o caso não-nulo).
DROP INDEX IF EXISTS public.cycle_completions_user_client_session_uniq;
