-- IA invisível · Fase 3 — flashcards automáticos a partir do caderno de erros.
-- Diferente da Fase 2 (cache global — uma lei é igual pra todo mundo), aqui o
-- conteúdo-fonte é PRIVADO de cada usuária (a nota que ela escreveu sobre o
-- próprio erro). Por isso NÃO reusa ai_artifacts (que é legível por qualquer
-- usuária autenticada) — o flashcard nasce direto em `flashcards`, já protegido
-- pela RLS owner-only existente da tabela.

-- Marca origem do card: distingue "gerado pelo pipeline" de "criado manualmente
-- pela usuária" (inclusive quando ela mesma cria a partir de um erro via
-- FlashcardModal, que já usa source_error_id hoje). Sem isso não dá pra saber
-- se um card com source_error_id preenchido já foi processado pelo pipeline.
alter table public.flashcards
  add column ai_generated boolean not null default false;

-- Idempotência: 1 linha por (usuária, nota de erro) processada, seja qual for
-- o resultado. Sem isso a função reprocessaria a mesma nota toda noite pra
-- sempre (gasto de LLM sem fim) sempre que a nota não resultasse em card
-- publicado (juiz reprovou, nota vazia demais, etc.).
create table public.flashcard_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  error_note_id uuid not null references public.error_notebooks (id) on delete cascade,
  status text not null check (status in ('created', 'skipped')),
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, error_note_id)
);

alter table public.flashcard_generation_log enable row level security;

create policy "flashcard_generation_log_select_own" on public.flashcard_generation_log
  for select using ((select auth.uid()) = user_id);

-- Escrita exclusiva do service role (Edge Function de geração) — nunca do cliente.
