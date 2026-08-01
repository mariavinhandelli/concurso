-- Hub de editais: metadados de situação e ficha do concurso no catálogo,
-- e vínculo do alvo do usuário com o edital de origem.
alter table public.editais_catalog
  add column if not exists situacao text not null default 'em_expectativa'
    check (situacao in ('vigente', 'em_expectativa', 'encerrado')),
  add column if not exists ultima_edicao integer,
  add column if not exists edital_url text,
  add column if not exists vagas integer,
  add column if not exists remuneracao numeric,
  add column if not exists inscricoes_ate date,
  add column if not exists aviso text;

alter table public.target_exams
  add column if not exists catalog_edital_id uuid references public.editais_catalog(id) on delete set null;

-- Backfill: alvos criados a partir do catálogo compartilham o slug do edital.
update public.target_exams t
set catalog_edital_id = e.id
from public.editais_catalog e
where t.slug = e.slug and t.catalog_edital_id is null;
