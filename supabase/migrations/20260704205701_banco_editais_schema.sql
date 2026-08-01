-- Banco de Editais: catálogo de concursos prontos, curados (read-only para usuários).
-- Nível tópico: cada edital referencia os tópicos EXATOS do syllabus oficial.

create table if not exists public.editais_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  orgao text not null,
  cargo text not null,
  banca text,
  ano integer,
  area_id uuid references public.catalog_areas(id) on delete set null,
  nivel text,
  exam_date date,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.edital_catalog_subjects (
  id uuid primary key default gen_random_uuid(),
  edital_catalog_id uuid not null references public.editais_catalog(id) on delete cascade,
  subject_catalog_id uuid not null references public.subjects_catalog(id) on delete cascade,
  weight integer not null default 1,
  num_questions_expected integer,
  position integer not null default 0,
  unique (edital_catalog_id, subject_catalog_id)
);

create table if not exists public.edital_catalog_topics (
  edital_catalog_id uuid not null references public.editais_catalog(id) on delete cascade,
  topic_catalog_id uuid not null references public.topics_catalog(id) on delete cascade,
  primary key (edital_catalog_id, topic_catalog_id)
);

create index if not exists idx_edital_subjects_edital on public.edital_catalog_subjects(edital_catalog_id);
create index if not exists idx_edital_topics_edital on public.edital_catalog_topics(edital_catalog_id);

alter table public.editais_catalog enable row level security;
alter table public.edital_catalog_subjects enable row level security;
alter table public.edital_catalog_topics enable row level security;

create policy catalog_read_editais on public.editais_catalog
  for select to authenticated using (true);
create policy catalog_read_edital_subjects on public.edital_catalog_subjects
  for select to authenticated using (true);
create policy catalog_read_edital_topics on public.edital_catalog_topics
  for select to authenticated using (true);
