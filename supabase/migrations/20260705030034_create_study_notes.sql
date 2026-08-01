-- Caderno de Anotações: notas livres (resumos, dicas, esquemas) organizadas
-- por matéria/tópico. Irmão do error_notebooks (Caderno de Erros) — mesma
-- estrutura de conteúdo Tiptap (content jsonb + content_text para busca).
create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null default '',
  content jsonb,
  content_text text,
  kind text not null default 'resumo' check (kind in ('resumo','dica','esquema','outro')),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_notes_user_updated_idx on public.study_notes (user_id, updated_at desc);

alter table public.study_notes enable row level security;
create policy "study_notes_owner" on public.study_notes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
