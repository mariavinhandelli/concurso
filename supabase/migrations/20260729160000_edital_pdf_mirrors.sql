-- Cópia própria dos editais oficiais. Fecha a última dependência de terceiro
-- apontada pela 2ª auditoria de Concursos: hoje o botão "Baixar edital (PDF)"
-- depende de o servidor do órgão/banca continuar servindo aquele arquivo
-- naquela URL. Link rot em edital é perda de conteúdo insubstituível para quem
-- estuda, e já aconteceu neste projeto (403 anti-bot do Qconcursos, migration
-- 20260715170000).
--
-- Base legal: edital de concurso é ato oficial e não tem proteção autoral
-- (Lei 9.610/98, art. 8º, IV — "os textos de tratados, leis, decretos,
-- regulamentos, decisões judiciais e demais atos oficiais"). Espelhar é lícito.
--
-- Regra de escopo (autorizada explicitamente): SOMENTE o PDF do edital, e
-- SOMENTE quando vem de domínio oficial (órgão ou banca). Prova e gabarito
-- hospedados por terceiro NÃO entram — a cópia que temos deles é de terceiro,
-- não da fonte primária.
--
-- A proveniência é gravada junto (URL de origem, data de captura, sha256,
-- tamanho) para que a cópia nunca vire um arquivo órfão de origem duvidosa.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editais-oficiais', 'editais-oficiais', true, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- Leitura pública do bucket (documento público); escrita só pelo service role
-- (a Edge Function mirror-edital-pdfs) — sem policy de insert/update/delete,
-- nenhum usuário consegue gravar aqui.
drop policy if exists "editais oficiais leitura publica" on storage.objects;
create policy "editais oficiais leitura publica"
  on storage.objects for select
  using (bucket_id = 'editais-oficiais');

create table if not exists public.edital_pdf_mirrors (
  edital_catalog_id uuid primary key references public.editais_catalog(id) on delete cascade,
  source_url text not null,          -- de onde veio (sempre domínio oficial)
  storage_path text not null,        -- caminho no bucket editais-oficiais
  sha256 text not null,              -- identidade do arquivo capturado
  bytes bigint not null,
  captured_at timestamptz not null default now(),
  last_checked_at timestamptz
);

comment on table public.edital_pdf_mirrors is
  'Cópia própria do PDF do edital oficial, com proveniência. Só fonte oficial (Lei 9.610 art. 8º IV).';

alter table public.edital_pdf_mirrors enable row level security;

-- Mesma régua do resto do catálogo: leitura para todos (inclusive visitante,
-- que enxerga /editais), escrita só service role.
drop policy if exists "read edital_pdf_mirrors" on public.edital_pdf_mirrors;
create policy "read edital_pdf_mirrors"
  on public.edital_pdf_mirrors for select
  to anon, authenticated
  using (true);
