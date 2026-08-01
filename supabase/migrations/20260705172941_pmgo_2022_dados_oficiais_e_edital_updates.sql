-- PM-GO Soldado 2022: substitui a composição aproximada pela composição OFICIAL
-- do Edital nº 002/2022 (Instituto AOCP), extraída do PDF do edital de abertura.

-- 1) Ficha com dados oficiais
update public.editais_catalog set
  vagas = 1520,
  remuneracao = 6353.13,
  edital_url = 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/',
  aviso = 'Dados oficiais da edição 2022 (Edital nº 002/2022 — Instituto AOCP): 1.500 vagas Soldado Combatente + 20 Músico. Novo edital em expectativa.'
where id = 'e0000000-0000-4000-8000-000000000002';

-- 2) Recompõe as disciplinas conforme a Tabela 8.1 do edital (prova objetiva
--    do Soldado Combatente, 50 questões)
delete from public.edital_catalog_topics where edital_catalog_id = 'e0000000-0000-4000-8000-000000000002';
delete from public.edital_catalog_subjects where edital_catalog_id = 'e0000000-0000-4000-8000-000000000002';

insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select 'e0000000-0000-4000-8000-000000000002', sc.id, v.weight, v.nq, v.pos
from (values
  ('Língua Portuguesa',                 4, 10, 1),
  ('Conhecimentos Regionais',           2,  5, 2),
  ('Direito Penal',                     3,  5, 3),
  ('Direito Constitucional',            3,  6, 4),
  ('Direito Processual Penal',          3,  5, 5),
  ('Direito Administrativo',            3,  6, 6),
  ('Direito Penal Militar',             2,  4, 7),
  ('Direito Processual Penal Militar',  3,  5, 8),
  ('Legislação Penal Especial',         2,  4, 9)
) as v(name, weight, nq, pos)
join public.subjects_catalog sc on sc.name = v.name;

-- 3) Tópicos fiéis ao Anexo II (apenas folhas; recorte por bloco do conteúdo
--    programático oficial)
with leaves as (
  select tc.id, tc.name, sc.name as subject_name, p.name as parent_name
  from public.topics_catalog tc
  join public.subjects_catalog sc on sc.id = tc.subject_catalog_id
  left join public.topics_catalog p on p.id = tc.parent_id
  where not exists (select 1 from public.topics_catalog c where c.parent_id = tc.id)
)
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select 'e0000000-0000-4000-8000-000000000002', id from leaves
where subject_name in ('Língua Portuguesa', 'Conhecimentos Regionais', 'Direito Penal Militar', 'Direito Processual Penal Militar')
   or (subject_name = 'Legislação Penal Especial' and name <> 'Lavagem de dinheiro (9.613/98)')
   or (subject_name = 'Direito Penal'
       and coalesce(parent_name, name) in ('Aplicação da Lei Penal', 'Crimes contra a Pessoa', 'Crimes contra o Patrimônio', 'Crimes contra a Administração Pública'))
   or (subject_name = 'Direito Constitucional'
       and coalesce(parent_name, name) in ('Princípios Fundamentais (arts. 1º a 4º)', 'Direitos e Garantias Fundamentais', 'Organização do Estado', 'Organização dos Poderes', 'Defesa do Estado e das Instituições')
       and name not in ('Poder Judiciário (estrutura e garantias)', 'Funções essenciais à Justiça (MP, AGU, Defensoria)'))
   or (subject_name = 'Direito Processual Penal'
       and (coalesce(parent_name, name) in ('Princípios e Aplicação da Lei Processual', 'Inquérito Policial', 'Ação Penal', 'Prisões e Medidas Cautelares', 'Execução Penal e Habeas Corpus')
            or name in ('Competência', 'Procedimentos especiais')))
   or (subject_name = 'Direito Administrativo'
       and coalesce(parent_name, name) in ('Regime Jurídico-Administrativo', 'Organização Administrativa', 'Agentes Públicos', 'Poderes Administrativos', 'Poder de Polícia', 'Atos Administrativos', 'Controle da Administração Pública', 'Responsabilidade Civil do Estado', 'Improbidade Administrativa (Lei 8.429/92)'))
on conflict do nothing;

-- 4) Notícias / retificações / resultados por edital
create table if not exists public.edital_updates (
  id uuid primary key default gen_random_uuid(),
  edital_catalog_id uuid not null references public.editais_catalog(id) on delete cascade,
  tipo text not null check (tipo in ('noticia', 'retificacao', 'aviso', 'resultado')),
  titulo text not null,
  url text,
  published_at date not null,
  created_at timestamptz not null default now()
);
alter table public.edital_updates enable row level security;
drop policy if exists "edital_updates_read" on public.edital_updates;
create policy "edital_updates_read" on public.edital_updates
  for select to authenticated using (true);

-- 5) Linha do tempo real da edição 2022 (fonte: goias.gov.br e edital de abertura)
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at) values
  ('e0000000-0000-4000-8000-000000000002', 'noticia',   'Edital de abertura nº 002/2022 publicado — 1.520 vagas (Soldado Combatente e Músico)', 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/', '2022-04-08'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia',   'Inscrições abertas de 29/04 a 30/05/2022 (taxa de R$ 110) no site do Instituto AOCP', 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/', '2022-04-29'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia',   'Aplicação da prova objetiva e redação', 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/', '2022-07-10'),
  ('e0000000-0000-4000-8000-000000000002', 'resultado', 'Resultado definitivo da prova objetiva', 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/', '2022-08-12'),
  ('e0000000-0000-4000-8000-000000000002', 'resultado', 'Resultado definitivo da redação', 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/', '2022-09-06');
