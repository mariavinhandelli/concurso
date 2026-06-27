-- Restringe novos dados inválidos sem bloquear a migration por linhas antigas.
-- Depois de corrigir eventuais registros legados, estas constraints podem ser
-- validadas com: ALTER TABLE ... VALIDATE CONSTRAINT ...;

alter table public.study_logs
  add constraint study_logs_duration_nonnegative
  check (duration_sec >= 0) not valid,
  add constraint study_logs_timestamps_ordered
  check (ended_at >= started_at) not valid,
  add constraint study_logs_energy_range
  check (energy_level is null or energy_level between 1 and 5) not valid,
  add constraint study_logs_questions_nonnegative
  check (
    coalesce(questions_total, 0) >= 0
    and coalesce(questions_correct, 0) >= 0
  ) not valid,
  add constraint study_logs_correct_not_above_total
  check (coalesce(questions_correct, 0) <= coalesce(questions_total, 0)) not valid;

alter table public.topics
  add constraint topics_review_state_valid
  check (
    coalesce(interval_days, 0) >= 0
    and coalesce(repetitions, 0) >= 0
    and coalesce(ease_factor, 2.5) >= 1.3
  ) not valid;

alter table public.flashcards
  add constraint flashcards_review_state_valid
  check (
    coalesce(interval_days, 0) >= 0
    and coalesce(repetitions, 0) >= 0
    and coalesce(ease_factor, 2.5) >= 1.3
  ) not valid;

alter table public.study_blocks
  add constraint study_blocks_minutes_positive
  check (planned_minutes > 0) not valid;

alter table public.recurrence_items
  add constraint recurrence_items_minutes_positive
  check (planned_minutes > 0) not valid;

alter table public.cycle_completions
  add constraint cycle_completions_minutes_nonnegative
  check (minutes >= 0) not valid;

alter table public.exam_blueprints
  add constraint exam_blueprints_values_nonnegative
  check (
    weight >= 0
    and (num_questions_expected is null or num_questions_expected >= 0)
  ) not valid;
