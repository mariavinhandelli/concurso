-- Check semanal de atualização de legislação. Tabela operacional (não é dado
-- de usuária) — guarda, por lei, o hash + snapshot do texto da fonte oficial
-- na última verificação, pra comparar semana a semana. Sem policies: só o
-- service role (Edge Function) acessa; não é consultada do cliente.
--
-- IMPORTANTE: isto só DETECTA e AVISA. O texto das leis vive em arquivos
-- estáticos (public/leis/*.json), fora do banco — nenhum processo de fundo
-- consegue aplicar a mudança sozinho, e não deveria: reescrever texto legal
-- sem supervisão é o tipo de erro de alto risco que este projeto já decidiu
-- evitar (ver lição da tabela de incidência fabricada, memória project_vademecum).
-- A mudança real exige uma sessão de código pra regenerar o JSON e redeployar.
create table public.lei_source_checks (
  slug text primary key,
  source_url text not null,
  source_hash text,
  source_text text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_alert_sent_at timestamptz,
  diff_snippet text
);

alter table public.lei_source_checks enable row level security;
