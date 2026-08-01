-- RPC: merge_profile_settings
-- Atomically merges a JSONB patch into profiles.settings without
-- overwriting other keys that may have been set by concurrent tabs.
CREATE OR REPLACE FUNCTION public.merge_profile_settings(
  p_user_id uuid,
  p_patch    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.profiles
  SET settings = COALESCE(settings, '{}'::jsonb) || p_patch
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_profile_settings(uuid, jsonb) TO authenticated;

-- RPC: undo_last_cycle_completion
-- Atomically finds and deletes the most recent cycle_completion
-- for the given rule + subject belonging to the calling user.
-- FOR UPDATE SKIP LOCKED prevents TOCTOU race conditions.
CREATE OR REPLACE FUNCTION public.undo_last_cycle_completion(
  p_rule_id    uuid,
  p_subject_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.cycle_completions
  WHERE rule_id    = p_rule_id
    AND subject_id = p_subject_id
    AND user_id    = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    DELETE FROM public.cycle_completions WHERE id = v_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_last_cycle_completion(uuid, uuid) TO authenticated;
