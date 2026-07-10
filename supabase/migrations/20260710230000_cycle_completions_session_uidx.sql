-- O upsert de cycle_completions (saveStudyLog → completeCycleSubject) usa
-- ON CONFLICT (user_id, client_session_id), mas a tabela não tinha índice único
-- nessas colunas → erro 42P10 engolido pelo try/catch: o timer NUNCA somava
-- minutos ao ciclo. Mesmo padrão do P0 corrigido em study_logs.
-- Índice completo (não-parcial): NULLs são distintos entre si no Postgres, então
-- os registros manuais (client_session_id null) continuam ilimitados, e o
-- ON CONFLICT consegue inferir o índice (parcial não seria inferido pelo
-- supabase-js, que não envia o predicado).
create unique index if not exists cycle_completions_user_session_uidx
  on public.cycle_completions (user_id, client_session_id);
