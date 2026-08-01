-- Respostas individuais do banco de questões C/E do Vade Mecum.
-- Uma linha por (usuário, questão); re-responder faz upsert.
create table if not exists public.lei_questao_respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lei_slug text not null,
  questao_id text not null,
  resposta boolean not null,
  acertou boolean not null,
  updated_at timestamptz not null default now(),
  unique (user_id, questao_id)
);

create index if not exists lei_questao_respostas_user_lei_idx
  on public.lei_questao_respostas (user_id, lei_slug);

alter table public.lei_questao_respostas enable row level security;

create policy "lei_questao_respostas_select" on public.lei_questao_respostas
  for select using (auth.uid() = user_id);
create policy "lei_questao_respostas_insert" on public.lei_questao_respostas
  for insert with check (auth.uid() = user_id);
create policy "lei_questao_respostas_update" on public.lei_questao_respostas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lei_questao_respostas_delete" on public.lei_questao_respostas
  for delete using (auth.uid() = user_id);
