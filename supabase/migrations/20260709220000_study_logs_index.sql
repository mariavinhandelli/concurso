-- Perf F3 (parcial) — índice mais crítico da auditoria. study_logs é a tabela mais
-- consultada (streak pagina 3 anos, coach/journey/missões filtram por user_id e
-- ordenam/filtram por started_at). Só havia pkey(id) e unique(user_id, client_session_id)
-- — nenhum cobria o padrão `where user_id = ? order by started_at desc`.
create index if not exists idx_study_logs_user_started
  on public.study_logs (user_id, started_at desc);
