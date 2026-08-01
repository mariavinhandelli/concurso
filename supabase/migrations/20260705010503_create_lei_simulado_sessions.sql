-- Histórico de simulados C/E do Vade Mecum — mesmo padrão de juris_simulado_sessions.
create table public.lei_simulado_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lei_slug text not null,
  total int not null,
  certas int not null,
  elapsed_secs int not null,
  respostas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index lei_simulado_sessions_user_idx on public.lei_simulado_sessions (user_id, lei_slug, created_at desc);

alter table public.lei_simulado_sessions enable row level security;
create policy "lei_simulado_sessions_owner" on public.lei_simulado_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
