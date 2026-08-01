-- Mesmo bug do activate_catalog_subject: search_path vazio + corpo não-qualificado.
-- Correção mínima: search_path fixo public, pg_temp (não toca no corpo das funções).
alter function public.set_primary_target_exam(p_target_id uuid)
  set search_path = public, pg_temp;

alter function public.edit_recurrence_rule_versioned(p_old_rule_id uuid, p_mode text, p_end_date date, p_cycle_per_day integer, p_cycle_weekdays integer[], p_cycle_daily_minutes integer, p_items jsonb)
  set search_path = public, pg_temp;

alter function public.append_juris_destaque(p_juris_id uuid, p_destaque jsonb)
  set search_path = public, pg_temp;

alter function public.remove_juris_destaque(p_juris_id uuid, p_destaque_id text)
  set search_path = public, pg_temp;
