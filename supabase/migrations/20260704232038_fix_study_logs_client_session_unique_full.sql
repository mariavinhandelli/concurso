-- O índice único parcial (WHERE client_session_id IS NOT NULL) não é inferível
-- pelo ON CONFLICT (user_id, client_session_id) do PostgREST, o que quebrou
-- TODOS os saves de study_logs desde 20/jun. Troca por constraint única
-- completa: NULLs são distintos entre si no btree, então as linhas antigas
-- (client_session_id NULL) não conflitam.
drop index if exists public.study_logs_user_client_session_uniq;
alter table public.study_logs
  add constraint study_logs_user_client_session_uniq unique (user_id, client_session_id);
