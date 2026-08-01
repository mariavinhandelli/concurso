-- Vade Mecum: leis e artigos são conteúdo global read-only (como jurisprudencias);
-- lei_interacoes guarda grifos/anotações/revisão por usuário (como juris_interacoes).
--
-- ⚠️ Substituída no dia seguinte por 20260704235105_vademecum_static_content_restructure.sql,
-- que move o texto das leis para arquivo estático no app e apaga estas tabelas.

create table public.leis (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  nome_curto text not null,
  ano int,
  disciplina text,
  descricao text,
  fonte_url text,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.lei_artigos (
  id uuid primary key default gen_random_uuid(),
  lei_id uuid not null references public.leis(id) on delete cascade,
  ordem int not null,
  numero text not null,
  rotulo text not null,
  caminho text,
  -- blocos: [{ id, rotulo, texto, nivel }] — caput, parágrafos, incisos, alíneas
  blocos jsonb not null,
  incidencia text not null default 'baixa'
    check (incidencia in ('baixa','media','alta','muito_alta')),
  incidencia_nota text,
  revogado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lei_id, ordem)
);
create index lei_artigos_lei_ordem_idx on public.lei_artigos (lei_id, ordem);

create table public.lei_interacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artigo_id uuid not null references public.lei_artigos(id) on delete cascade,
  favorito boolean not null default false,
  -- grifos: [{ id, bloco, start, end, cor, estilo, nota, criado_em }]
  grifos jsonb not null default '[]'::jsonb,
  anotacoes text,
  is_review_active boolean not null default false,
  next_review_date date,
  interval_days int not null default 0,
  repetitions int not null default 0,
  last_reviewed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- constraint COMPLETA (não-parcial): upsert PostgREST exige índice inferível
  constraint lei_interacoes_user_artigo_uniq unique (user_id, artigo_id)
);
create index lei_interacoes_due_idx on public.lei_interacoes (user_id, next_review_date)
  where is_review_active;

-- RLS
alter table public.leis enable row level security;
alter table public.lei_artigos enable row level security;
alter table public.lei_interacoes enable row level security;

create policy "leis leitura autenticada" on public.leis
  for select to authenticated using (true);
create policy "artigos leitura autenticada" on public.lei_artigos
  for select to authenticated using (true);

create policy "interacoes select próprio" on public.lei_interacoes
  for select to authenticated using (auth.uid() = user_id);
create policy "interacoes insert próprio" on public.lei_interacoes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "interacoes update próprio" on public.lei_interacoes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "interacoes delete próprio" on public.lei_interacoes
  for delete to authenticated using (auth.uid() = user_id);

-- RPCs atômicas de grifo (single-statement: sem race de read-modify-write).
-- security invoker + search_path qualificado (lição das funções quebradas em jul/2026).
create or replace function public.append_lei_grifo(p_artigo_id uuid, p_grifo jsonb)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.lei_interacoes (user_id, artigo_id, grifos, updated_at)
  values (auth.uid(), p_artigo_id, jsonb_build_array(p_grifo), now())
  on conflict (user_id, artigo_id)
  do update set grifos = public.lei_interacoes.grifos || excluded.grifos, updated_at = now()
  returning grifos;
$$;

create or replace function public.remove_lei_grifo(p_artigo_id uuid, p_grifo_id text)
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
  where user_id = auth.uid() and artigo_id = p_artigo_id
  returning grifos;
$$;
