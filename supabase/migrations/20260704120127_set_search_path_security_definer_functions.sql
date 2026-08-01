ALTER FUNCTION public.merge_profile_settings(p_user_id uuid, p_patch jsonb) SET search_path = '';
ALTER FUNCTION public.undo_last_cycle_completion(p_rule_id uuid, p_subject_id uuid) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.append_juris_destaque(p_juris_id uuid, p_destaque jsonb) SET search_path = '';
ALTER FUNCTION public.activate_catalog_subject(p_catalog_id uuid) SET search_path = '';
ALTER FUNCTION public.edit_recurrence_rule_versioned(p_old_rule_id uuid, p_mode text, p_end_date date, p_cycle_per_day integer, p_cycle_weekdays integer[], p_cycle_daily_minutes integer, p_items jsonb) SET search_path = '';
ALTER FUNCTION public.remove_juris_destaque(p_juris_id uuid, p_destaque_id text) SET search_path = '';
ALTER FUNCTION public.set_primary_target_exam(p_target_id uuid) SET search_path = '';
