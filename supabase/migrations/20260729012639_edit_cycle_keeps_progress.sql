-- Editar um ciclo cria uma NOVA versão da regra (para o histórico do dia_fixo
-- ficar correto), mas o usuário entende que é o MESMO ciclo. Como getCycleState
-- filtra completions por rule_id, o progresso ficava preso na versão antiga:
-- trocar só a meta diária de 210 para 240 zerava voltas e minutos, sem aviso.
-- Agora o progresso acompanha a nova versão. Criar um ciclo do zero continua
-- começando zerado (passa por archiveCycle + insert, não por esta função).
create or replace function public.edit_recurrence_rule_versioned(
  p_old_rule_id uuid, p_mode text, p_end_date date, p_cycle_per_day integer,
  p_cycle_weekdays integer[], p_cycle_daily_minutes integer, p_items jsonb,
  p_today date default CURRENT_DATE)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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

  -- Leva o progresso acumulado para a nova versão. item_id é remapeado para o
  -- primeiro slot da mesma matéria (NULL se a matéria saiu do ciclo — a FK é
  -- ON DELETE SET NULL, e a leitura agrega por subject_id de qualquer forma).
  IF p_mode = 'ciclo' THEN
    UPDATE cycle_completions cc
    SET rule_id = v_new_id,
        item_id = (
          SELECT ri.id FROM recurrence_items ri
          WHERE ri.rule_id = v_new_id AND ri.subject_id = cc.subject_id
          ORDER BY ri.cycle_order NULLS LAST, ri.position
          LIMIT 1
        )
    WHERE cc.rule_id = p_old_rule_id AND cc.user_id = v_uid;
  END IF;

  RETURN v_new_id;
END;
$function$;
