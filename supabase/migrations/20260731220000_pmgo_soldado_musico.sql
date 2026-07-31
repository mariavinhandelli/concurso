-- Auditoria PM-GO (31/07): o Edital 002/2022 tem DOIS cargos, não um.
--
-- O catálogo tinha um único "Soldado" com 1.520 vagas — que é exatamente a
-- soma de Combatente (1.500) + Músico (20) — mas a grade cadastrada era só a
-- do Combatente (Tabela 8.1). Ou seja: o número prometia os dois cargos e o
-- conteúdo entregava um. Quem se inscrevesse como Músico estudaria a grade
-- errada.
--
-- Os dois cargos têm prova DIFERENTE (Edital 002/2022, itens 8.1 e 8.2):
--   Combatente: LP 10 · Regionais 5 · D.Penal 5 · D.Const 6 · D.Proc.Penal 5
--               D.Adm 6 · D.Penal Militar 4 · D.Proc.Penal Militar 5
--               Leg.Extravagante 4  = 50 questões / 85 pts (+25 redação)
--   Músico:     LP 10 · Regionais 5 · D.Const 5 · D.Adm 5 · D.Penal Militar 5
--               Teoria Musical 20   = 50 questões / 70 pts (+25 redação)
-- O Músico NÃO tem Direito Penal, Processual Penal, Processual Penal Militar
-- nem Legislação Extravagante — e tem 20 questões (40% da prova) de Teoria
-- Musical, que não existia no catálogo.
-- O Músico também tem 6 fases (a 2ª é Teste de Habilidade Específica com
-- Prova de Prática Musical, item 12.2.5); o Combatente tem 5.
--
-- Fontes (conferidas ao vivo em 31/07/2026): Edital de Abertura nº 002/2022
-- retificado (goias.gov.br/administracao, PDF já espelhado no bucket) e
-- Anexo II dos Conteúdos Programáticos retificado em 12/05/2022
-- (120522-AnexoIIRetificado-fd3.pdf).

-- ── 1. Teoria Musical: matéria + 9 tópicos oficiais do Anexo II ────────────
insert into public.subjects_catalog (name, slug)
select 'Teoria Musical', 'teoria-musical'
where not exists (select 1 from public.subjects_catalog where name = 'Teoria Musical');

insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Teoria geral da música', 1),
  ('Construção e análise de escalas em geral', 2),
  ('Ornamentos', 3),
  ('Transposição e instrumentos transpositores', 4),
  ('Tons vizinhos e modulação', 5),
  ('Análise harmônica em graus e cifras; tríades e tétrades em estado fundamental e inversões', 6),
  ('Notas de tensão: nota de passagem, apojatura, retardo, antecipação e bordadura', 7),
  ('Compasso simples, composto e misto', 8),
  ('Análise fraseológica: semifrases, frases, períodos, seções e cadências (autêntica, plagal, enganosa e meia cadência)', 9)
) as v(name, position) on true
where s.name = 'Teoria Musical'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ── 2. O "Soldado" existente passa a se declarar Combatente ────────────────
-- Slug preservado de propósito: target_exams.slug referencia 'pm-go-soldado'
-- e trocá-lo desvincularia o concurso de quem já ativou.
update public.editais_catalog
set cargo = 'Soldado Combatente (QPPM)',
    vagas = 1500,   -- eram 1.520 somando as 20 do Músico, que agora tem ficha própria
    verificado_em = '2026-07-31',
    aviso = 'Edital nº 002/2022, cargo de Soldado de 2ª Classe Combatente (QPPM): 1.500 vagas '
         || '(1.349 masculinas + 151 femininas) distribuídas entre os 19 Comandos Regionais — a lotação '
         || 'segue o CRPM escolhido na inscrição, por no mínimo 3 anos após o curso de formação. Exige curso '
         || 'superior em qualquer área, idade máxima de 30 anos e CNH categoria B. Prova: 50 questões + redação, '
         || '5 fases. O mesmo edital abriu 20 vagas de Soldado Músico (QPM), que tem prova e conteúdo próprios — '
         || 'veja a ficha "Soldado Músico" deste órgão. Concurso ainda com movimentação judicial em 2026 '
         || '(convocações sub judice); convocações gerais suspensas pelo STF desde dez/2023 por limitação de vagas '
         || 'femininas. Novo edital em discussão desde 2023, sem banca, vagas ou data definidas.'
where slug = 'pm-go-soldado';

-- ── 3. Ficha própria do Soldado Músico ─────────────────────────────────────
insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, orgao_id, area_id,
   situacao, ultima_edicao, vagas, remuneracao, edital_url, aviso, is_active, position, verificado_em)
select
  'pm-go-soldado-musico', 'PM-GO', 'Soldado Músico (QPM)', 'Instituto AOCP', 2022, 'GO', 'superior',
  'pm-go-soldado-musico', o.id, e.area_id,
  'em_expectativa', 2022, 20, 6353.13,
  e.edital_url,
  'Edital nº 002/2022, cargo de Soldado de 2ª Classe Músico (QPM): 20 vagas divididas por instrumento — '
  || 'Clarineta (3), Percussão (3), Tuba (3), Vocal (3), Sax Alto (2), Sax Tenor (2), Trompete (2), Flauta (1) '
  || 'e Trombone (1); todas lotadas no 1º CRPM (Goiânia). Prova DIFERENTE da do Combatente: 20 das 50 questões '
  || 'são de Teoria Musical, e não caem Direito Penal, Processual Penal, Processual Penal Militar nem Legislação '
  || 'Extravagante. São 6 fases (a 2ª é o Teste de Habilidade Específica, com Prova de Prática Musical individual '
  || 'de até 10 minutos avaliada por banca de 3 policiais músicos). Mesmos requisitos do Combatente: curso superior, '
  || 'até 30 anos, CNH categoria B. Novo edital em discussão desde 2023, sem banca, vagas ou data definidas.',
  true, 3, '2026-07-31'
from public.orgaos_catalog o
join public.editais_catalog e on e.slug = 'pm-go-soldado'
where o.slug = 'pm-go'
and not exists (select 1 from public.editais_catalog x where x.slug = 'pm-go-soldado-musico');

-- Grade do Músico (Tabela 8.2 do edital). num_questions_expected oficial em
-- todas as matérias — a página mostra o % real de cada uma na prova.
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, v.questoes, v.position
from (values
  ('Língua Portuguesa', 4, 10, 1),
  ('Conhecimentos Regionais', 2, 5, 2),
  ('Direito Constitucional', 3, 5, 3),
  ('Direito Administrativo', 3, 5, 4),
  ('Direito Penal Militar', 3, 5, 5),
  ('Teoria Musical', 5, 20, 6)
) as v(subject_name, weight, questoes, position)
join public.subjects_catalog s on s.name = v.subject_name
cross join (select id from public.editais_catalog where slug = 'pm-go-soldado-musico') e
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- Tópicos: todos os da matéria (mesmo padrão das demais grades do catálogo).
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select ecs.edital_catalog_id, tc.id, null
from public.edital_catalog_subjects ecs
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
join public.editais_catalog e on e.id = ecs.edital_catalog_id
where e.slug = 'pm-go-soldado-musico'
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = ecs.edital_catalog_id and x.topic_catalog_id = tc.id
);

-- Prova e gabarito oficiais do Músico (AOCP 2022) — distintos dos do
-- Combatente, que já estavam cadastrados.
insert into public.edital_past_papers (edital_catalog_id, ano, banca, prova_url, gabarito_url)
select e.id, 2022, 'Instituto AOCP',
  'https://arquivos.qconcursos.com/prova/arquivo_prova/88984/instituto-aocp-2022-pm-go-soldado-de-2-classe-qppm-musico-prova.pdf',
  'https://arquivos.qconcursos.com/prova/arquivo_gabarito/88984/instituto-aocp-2022-pm-go-soldado-de-2-classe-qppm-musico-gabarito.pdf'
from public.editais_catalog e
where e.slug = 'pm-go-soldado-musico'
and not exists (select 1 from public.edital_past_papers p where p.edital_catalog_id = e.id);

-- ── 4. Estatística do concurso: separa as vagas por cargo ──────────────────
update public.edital_concurso_stats set vagas = 1500
where concurso_key = 'pm-go-soldado' and ano = 2022;

insert into public.edital_concurso_stats (concurso_key, ano, vagas, fonte_url)
select 'pm-go-soldado-musico', 2022, 20,
  'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/'
where not exists (
  select 1 from public.edital_concurso_stats where concurso_key = 'pm-go-soldado-musico' and ano = 2022
);
