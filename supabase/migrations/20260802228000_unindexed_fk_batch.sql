-- Auditoria de performance (02/08) — 44 foreign keys sem índice de cobertura
-- (advisor `unindexed_foreign_keys`, INFO). Toda tabela é pequena hoje, mas
-- cada FK sem índice custa um seq scan em deletes/updates da tabela pai e em
-- joins — barato de corrigir agora, caro de descobrir depois em escala.
-- `if not exists` torna a migration idempotente.

create index if not exists idx_editais_catalog_area_id on public.editais_catalog (area_id);
create index if not exists idx_editais_catalog_orgao_id on public.editais_catalog (orgao_id);
create index if not exists idx_edital_catalog_subjects_subject_catalog_id on public.edital_catalog_subjects (subject_catalog_id);
create index if not exists idx_edital_catalog_topics_topic_catalog_id on public.edital_catalog_topics (topic_catalog_id);
create index if not exists idx_edital_follows_edital_catalog_id on public.edital_follows (edital_catalog_id);
create index if not exists idx_edital_pdf_extractions_user_id on public.edital_pdf_extractions (user_id);
create index if not exists idx_edital_requests_atendido_edital_id on public.edital_requests (atendido_edital_id);
create index if not exists idx_edital_requests_user_id on public.edital_requests (user_id);
create index if not exists idx_edital_updates_edital_catalog_id on public.edital_updates (edital_catalog_id);
create index if not exists idx_error_notebooks_board_id on public.error_notebooks (board_id);
create index if not exists idx_error_notebooks_subject_id on public.error_notebooks (subject_id);
create index if not exists idx_error_notebooks_topic_id on public.error_notebooks (topic_id);
create index if not exists idx_error_notebooks_user_id on public.error_notebooks (user_id);
create index if not exists idx_exam_blueprints_subject_id on public.exam_blueprints (subject_id);
create index if not exists idx_exam_blueprints_user_id on public.exam_blueprints (user_id);
create index if not exists idx_flashcard_catalog_cards_topic_catalog_id on public.flashcard_catalog_cards (topic_catalog_id);
create index if not exists idx_flashcard_deck_catalog_subject_catalog_id on public.flashcard_deck_catalog (subject_catalog_id);
create index if not exists idx_flashcard_generation_log_error_note_id on public.flashcard_generation_log (error_note_id);
create index if not exists idx_flashcards_source_error_id on public.flashcards (source_error_id);
create index if not exists idx_flashcards_subject_id on public.flashcards (subject_id);
create index if not exists idx_flashcards_topic_id on public.flashcards (topic_id);
create index if not exists idx_question_bank_subject_id on public.question_bank (subject_id);
create index if not exists idx_question_topic_map_topic_id on public.question_topic_map (topic_id);
create index if not exists idx_recurrence_items_subject_id on public.recurrence_items (subject_id);
create index if not exists idx_recurrence_items_topic_id on public.recurrence_items (topic_id);
create index if not exists idx_recurrence_overrides_item_id on public.recurrence_overrides (item_id);
create index if not exists idx_recurrence_overrides_override_subject_id on public.recurrence_overrides (override_subject_id);
create index if not exists idx_recurrence_overrides_override_topic_id on public.recurrence_overrides (override_topic_id);
create index if not exists idx_social_reports_reporter_id on public.social_reports (reporter_id);
create index if not exists idx_study_blocks_subject_id on public.study_blocks (subject_id);
create index if not exists idx_study_blocks_topic_id on public.study_blocks (topic_id);
create index if not exists idx_study_logs_board_id on public.study_logs (board_id);
create index if not exists idx_study_logs_subject_id on public.study_logs (subject_id);
create index if not exists idx_study_logs_topic_id on public.study_logs (topic_id);
create index if not exists idx_study_notes_subject_id on public.study_notes (subject_id);
create index if not exists idx_study_notes_topic_id on public.study_notes (topic_id);
create index if not exists idx_subjects_catalog_id on public.subjects (catalog_id);
create index if not exists idx_target_exams_archived_cycle_rule_id on public.target_exams (archived_cycle_rule_id);
create index if not exists idx_target_exams_board_id on public.target_exams (board_id);
create index if not exists idx_target_exams_catalog_edital_id on public.target_exams (catalog_edital_id);
create index if not exists idx_topic_boards_board_id on public.topic_boards (board_id);
create index if not exists idx_topic_metrics_user_id on public.topic_metrics (user_id);
create index if not exists idx_topics_catalog_id on public.topics (catalog_id);
create index if not exists idx_turmas_owner_id on public.turmas (owner_id);
