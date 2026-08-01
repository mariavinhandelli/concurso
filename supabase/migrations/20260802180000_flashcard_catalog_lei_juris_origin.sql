-- Estrutura para flashcards automáticos de lei seca e jurisprudência no Banco
-- de Flashcards (decisão de produto, ago/2026). NÃO cria o gerador (edge
-- function + cron) — só o que ele vai precisar para existir depois, no mesmo
-- molde do generate-lei-questoes (cache global, 1x por fonte, juiz valida
-- antes de publicar) e do generate-error-flashcards (log de idempotência).
--
-- Desenho:
--  - flashcard_deck_catalog.origin identifica o TIPO do deck (curadoria manual
--    vs. lei seca vs. jurisprudência) — é o que dá o selo na aba Banco.
--  - flashcard_catalog_cards ganha as duas colunas de rastreabilidade — só uma
--    delas é preenchida quando origin != 'curadoria'; os índices únicos
--    parciais são a garantia, no banco, de que o gerador nunca duplica um
--    card para o mesmo artigo/julgado (defesa em profundidade além do log).
--  - flashcard_catalog_generation_log é o log de idempotência do gerador
--    futuro — mesmo papel do flashcard_generation_log (Fase 3, erros), mas
--    global (sem user_id): a fonte é a mesma lei/julgado pra todo mundo.

alter table public.flashcard_deck_catalog
  add column if not exists origin text not null default 'curadoria';

alter table public.flashcard_deck_catalog
  drop constraint if exists flashcard_deck_catalog_origin_check;
alter table public.flashcard_deck_catalog
  add constraint flashcard_deck_catalog_origin_check
  check (origin in ('curadoria', 'lei_seca', 'jurisprudencia'));

alter table public.flashcard_catalog_cards
  add column if not exists source_lei_artigo_key text,
  add column if not exists source_jurisprudencia_id uuid references public.jurisprudencias(id) on delete set null;

-- Parciais (WHERE not null): a maioria dos cards é curadoria manual e não
-- tem fonte rastreável — um índice único "cru" rejeitaria a 2ª, 3ª... linha
-- com NULL nessas colunas (comportamento de UNIQUE varia por engine, mas em
-- Postgres NULLs não colidem entre si; o WHERE aqui é só para deixar a
-- intenção explícita e não depender dessa sutileza).
drop index if exists flashcard_catalog_cards_source_lei_artigo_key_idx;
create unique index flashcard_catalog_cards_source_lei_artigo_key_idx
  on public.flashcard_catalog_cards (source_lei_artigo_key)
  where source_lei_artigo_key is not null;

drop index if exists flashcard_catalog_cards_source_jurisprudencia_id_idx;
create unique index flashcard_catalog_cards_source_jurisprudencia_id_idx
  on public.flashcard_catalog_cards (source_jurisprudencia_id)
  where source_jurisprudencia_id is not null;

-- Log de idempotência do gerador futuro (não populado por nada ainda).
create table if not exists public.flashcard_catalog_generation_log (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null check (source_type in ('lei_artigo', 'jurisprudencia')),
  source_key text not null,        -- artigo_key (lei) ou id (jurisprudência, como texto)
  status text not null check (status in ('created', 'skipped', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  unique (source_type, source_key)
);

alter table public.flashcard_catalog_generation_log enable row level security;
-- Sem policy: log interno do gerador (service role), não é lido pelo cliente.
-- Mesma postura de "revogar de PUBLIC, nada por padrão" já usada no projeto.
revoke all on public.flashcard_catalog_generation_log from public, anon, authenticated;
