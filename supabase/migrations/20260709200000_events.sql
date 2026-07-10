-- Rodada 3 — Instrumentação. Tabela de eventos append-only, genérica (props jsonb).
-- Fonte da verdade de produto no próprio banco. Cliente só INSERE os próprios
-- eventos; leitura é do dev via service role/SQL (sem select policy = negado).

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  props jsonb not null default '{}',
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);

create index if not exists idx_events_name_created on public.events (name, created_at desc);
create index if not exists idx_events_user_created on public.events (user_id, created_at desc);
