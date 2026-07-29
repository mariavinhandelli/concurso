-- Monitor de fontes oficiais de concurso. Mesmo desenho do lei_source_checks
-- (20260712170000): guarda hash + snapshot do texto de cada página oficial para
-- comparar de semana em semana. Tabela operacional, sem policies — só o service
-- role (Edge Function) acessa.
--
-- Por que existe: a 2ª auditoria de Concursos (28/07) mostrou que o módulo
-- promete "Acompanhar novidades" com push, mas a última notícia curada era de
-- 09/06 — sete semanas de silêncio. A infra de push já funcionava; o que
-- faltava era alguém perceber que a fonte mudou.
--
-- IMPORTANTE: isto só DETECTA e AVISA a curadora. NÃO cria edital_updates nem
-- altera o catálogo sozinho. Publicar notícia de concurso a partir de um diff
-- de HTML sem leitura humana produziria exatamente o tipo de conteúdo errado
-- que esta plataforma decidiu não ter (mesma lição do monitor de leis e da
-- tabela de incidência fabricada).
create table public.edital_source_checks (
  slug text primary key,          -- identificador da FONTE (não do edital)
  label text not null,            -- nome legível para o alerta
  source_url text not null,
  source_hash text,
  source_text text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_alert_sent_at timestamptz,
  diff_snippet text
);

alter table public.edital_source_checks enable row level security;

-- Fontes monitoradas. Todas conferidas ao vivo em 29/07/2026 antes de entrar
-- aqui, exceto tj-go (403 para bots — mesmo caso do go-13800 no monitor de
-- leis; fica cadastrada para não esquecer, e a função registra a falha).
insert into public.edital_source_checks (slug, label, source_url) values
  ('tce-go-concursos', 'TCE-GO — página de concursos',
   'https://portal.tce.go.gov.br/concursos'),
  ('sead-go-concursos', 'SEAD-GO — concursos do estado (PM-GO, PC-GO)',
   'https://goias.gov.br/administracao/concursos/'),
  ('fcc-inscricoes', 'FCC — inscrições abertas (banca do TCE-GO)',
   'https://www.concursosfcc.com.br/'),
  ('tj-go-concursos', 'TJ-GO — concursos',
   'https://www.tjgo.jus.br/index.php/concursos')
on conflict (slug) do nothing;
