-- Hub de Editais — grade do TJ-GO Juiz Substituto (59º concurso, Edital
-- 01/2025 FGV). Fonte (15/07/2026): edital de abertura + Gran Cursos.
-- Prova objetiva em 3 blocos (Res. CNJ 75/2009): Bloco I 40 questões (Civil,
-- Proc. Civil, Consumidor, ECA), Bloco II 30 (Penal, Proc. Penal,
-- Constitucional, Eleitoral), Bloco III 30 (Empresarial, Tributário e
-- Financeiro, Ambiental, Administrativo, Formação Humanística, D. Humanos).
-- O edital NÃO fixa questões por disciplina → num_questions_expected fica
-- NULL (nunca inventamos número); os pesos 1–5 são curadoria por bloco.

-- 1) Disciplinas que ainda não existiam no catálogo (sem tópicos — a
-- usuária monta a grade fina; curadoria de tópicos vem depois)
insert into public.subjects_catalog (slug, name, position, is_active)
select v.* from (values
  ('direito-consumidor', 'Direito do Consumidor', 33, true),
  ('direito-crianca-adolescente', 'Direito da Criança e do Adolescente (ECA)', 34, true),
  ('formacao-humanistica', 'Formação Humanística', 35, true)
) as v(slug, name, position, is_active)
where not exists (select 1 from public.subjects_catalog s where s.slug = v.slug);

-- 2) Grade do Juiz Substituto (ordem: Bloco I → II → III)
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, null, v.position
from (values
  -- Bloco I (40 questões)
  ('direito-civil', 5, 1),
  ('direito-processual-civil', 5, 2),
  ('direito-consumidor', 3, 3),
  ('direito-crianca-adolescente', 3, 4),
  -- Bloco II (30 questões)
  ('direito-penal', 4, 5),
  ('direito-processual-penal', 4, 6),
  ('direito-constitucional', 4, 7),
  ('direito-eleitoral', 3, 8),
  -- Bloco III (30 questões)
  ('direito-empresarial', 2, 9),
  ('direito-tributario', 3, 10),
  ('direito-financeiro', 2, 11),
  ('direito-ambiental', 2, 12),
  ('direito-administrativo', 3, 13),
  ('formacao-humanistica', 2, 14),
  ('direitos-humanos', 2, 15)
) as v(subject_slug, weight, position)
join public.editais_catalog e on e.slug = 'tj-go-juiz-substituto'
join public.subjects_catalog s on s.slug = v.subject_slug
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- 3) Vincula os tópicos já curados das disciplinas existentes (mesma decisão
-- disclosed da PC-GO: granularidade da biblioteca Focali, refinável ao ativar)
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select ecs.edital_catalog_id, t.id
from public.edital_catalog_subjects ecs
join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'tj-go-juiz-substituto'
join public.topics_catalog t on t.subject_catalog_id = ecs.subject_catalog_id
on conflict do nothing;

-- 4) Aviso ganha a explicação dos blocos + nova data de verificação
update public.editais_catalog
set aviso = aviso || ' Prova objetiva em 3 blocos (Res. CNJ 75): Bloco I com 40 questões, Blocos II e III com 30 cada — o edital não fixa nº de questões por disciplina; os pesos da grade são curadoria.',
    verificado_em = '2026-07-15'
where slug = 'tj-go-juiz-substituto'
  and aviso not like '%Res. CNJ 75%';
