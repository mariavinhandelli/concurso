-- Reestruturação: o texto das leis vive como arquivo estático no app (mesmo
-- padrão de data/jurisprudencias.ts) — barato, cacheável e offline-friendly.
-- O banco guarda só as interações pessoais, referenciando o artigo por chave
-- estável "slug:numero" (ex.: 'cf-88:37'). Tabelas de conteúdo são removidas.

drop function if exists public.append_lei_grifo(uuid, jsonb);
drop function if exists public.remove_lei_grifo(uuid, text);
drop table if exists public.lei_interacoes;
drop table if exists public.lei_artigos;
drop table if exists public.leis;

create table public.lei_interacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artigo_key text not null,
  favorito boolean not null default false,
  grifos jsonb not null default '[]'::jsonb,
  anotacoes text,
  is_review_active boolean not null default false,
  next_review_date date,
  interval_days int not null default 0,
  repetitions int not null default 0,
  last_reviewed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lei_interacoes_user_artigo_uniq unique (user_id, artigo_key)
);
create index lei_interacoes_due_idx on public.lei_interacoes (user_id, next_review_date)
  where is_review_active;

alter table public.lei_interacoes enable row level security;
create policy "interacoes select próprio" on public.lei_interacoes
  for select to authenticated using (auth.uid() = user_id);
create policy "interacoes insert próprio" on public.lei_interacoes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "interacoes update próprio" on public.lei_interacoes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "interacoes delete próprio" on public.lei_interacoes
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.append_lei_grifo(p_artigo_key text, p_grifo jsonb)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.lei_interacoes (user_id, artigo_key, grifos, updated_at)
  values (auth.uid(), p_artigo_key, jsonb_build_array(p_grifo), now())
  on conflict (user_id, artigo_key)
  do update set grifos = public.lei_interacoes.grifos || excluded.grifos, updated_at = now()
  returning grifos;
$$;

create or replace function public.remove_lei_grifo(p_artigo_key text, p_grifo_id text)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.lei_interacoes
  set grifos = coalesce(
        (select jsonb_agg(g) from jsonb_array_elements(grifos) g where g->>'id' <> p_grifo_id),
        '[]'::jsonb),
      updated_at = now()
  where user_id = auth.uid() and artigo_key = p_artigo_key
  returning grifos;
$$;
