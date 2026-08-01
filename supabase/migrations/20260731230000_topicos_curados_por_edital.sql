-- Curadoria de tópicos POR EDITAL — corrige a falha estrutural achada em
-- 31/07: edital_catalog_topics vinculava TODOS os tópicos da matéria a
-- qualquer edital que cobrisse aquela matéria. Consequências:
--   (a) o aluno estudava tópicos que não caem na prova dele — o Soldado da
--       PM-GO via 19 tópicos de Direito Constitucional (poder constituinte,
--       controle de constitucionalidade, ordem econômica…) que o Anexo II
--       dele não cobra;
--   (b) o comparador dizia "0 tópicos" entre dois editais quaisquer, porque
--       por construção eles tinham a mesma lista — não por apuração.
--
-- Duas partes:
--   1. INFRAESTRUTURA: `topicos_curados` marca, por (edital, matéria), se a
--      lista de tópicos foi conferida contra o conteúdo programático oficial.
--      A UI usa isso para não afirmar fidelidade que não tem, e a curadoria
--      pode avançar edital a edital sem mentir sobre o resto.
--   2. PM-GO curado (3 cargos), a partir dos Anexos II oficiais retificados
--      em 12/05/2022: 120522-AnexoIIRetificado-fd3.pdf (Edital 002/2022,
--      Soldado Combatente e Músico) e 120522-AnexoIIRetificado-88e.pdf
--      (Edital 003/2022, Cadete).
--
-- PRINCÍPIO DA CURADORIA: só remove tópico quando o programa oficial
-- claramente NÃO o cobre. Na dúvida, mantém. Errar incluindo custa tempo de
-- estudo; errar excluindo faz perder questão na prova.

alter table public.edital_catalog_subjects
  add column if not exists topicos_curados boolean not null default false;

comment on column public.edital_catalog_subjects.topicos_curados is
  'true = a lista de tópicos desta matéria foi conferida contra o conteúdo programático oficial deste edital; false = usa a lista padrão do catálogo para a matéria.';

-- ── Helper: remove de um (edital, matéria) os tópicos fora da lista ────────
create or replace function public.curar_topicos_edital(
  p_slug text, p_materia text, p_excluir text[]
) returns void
language plpgsql
as $$
begin
  delete from public.edital_catalog_topics t
  using public.editais_catalog e, public.topics_catalog tc, public.subjects_catalog s
  where t.edital_catalog_id = e.id
    and e.slug = p_slug
    and t.topic_catalog_id = tc.id
    and tc.subject_catalog_id = s.id
    and s.name = p_materia
    and tc.name = any (p_excluir);

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.editais_catalog e, public.subjects_catalog s
  where ecs.edital_catalog_id = e.id
    and e.slug = p_slug
    and ecs.subject_catalog_id = s.id
    and s.name = p_materia;
end;
$$;

-- ══ PM-GO · Soldado Combatente (Edital 002/2022, "Noções de…") ════════════
-- Programa enxuto: o edital pede noções, não a matéria inteira.

-- Direito Penal: só aplicação da lei penal + crimes contra pessoa,
-- patrimônio e administração pública. Teoria do crime, penas, punibilidade,
-- dignidade sexual e fé pública NÃO são cobrados.
select public.curar_topicos_edital('pm-go-soldado', 'Direito Penal', array[
  'Teoria do Crime', 'Fato típico (conduta, nexo, resultado, tipicidade)',
  'Conceito e classificação de crimes', 'Consumação e tentativa',
  'Desistência, arrependimento e crime impossível', 'Erro de tipo e erro de proibição',
  'Ilicitude e excludentes', 'Culpabilidade e excludentes', 'Concurso de pessoas',
  'Concurso de crimes', 'Iter Criminis e Concurso', 'Penas', 'Espécies de penas',
  'Aplicação e dosimetria da pena', 'Medidas de segurança', 'Efeitos da condenação',
  'Extinção da Punibilidade', 'Causas de extinção', 'Prescrição, decadência e perempção',
  'Crimes contra a Dignidade Sexual', 'Crimes sexuais contra vulnerável',
  'Estupro e violação sexual', 'Demais crimes contra a dignidade sexual',
  'Crimes contra a Fé Pública', 'Moeda falsa', 'Falsidade documental',
  'Crimes contra a Paz e a Incolumidade Pública', 'Crimes contra a administração da justiça'
]);

-- Direito Constitucional: princípios fundamentais, direitos e garantias,
-- organização do Estado e dos poderes, defesa do Estado e administração
-- pública. Sem controle de constitucionalidade, poder constituinte, ordem
-- econômica/social, judiciário, tributário nem remédios constitucionais.
select public.curar_topicos_edital('pm-go-soldado', 'Direito Constitucional', array[
  'Controle difuso', 'Teoria da Constituição', 'Constitucionalismo',
  'Sistema Tributário Nacional (na CF)', 'Repartição de competências',
  'Remédios constitucionais (HC, MS, MI, HD, ação popular)',
  'Controle concentrado (ADI, ADC, ADPF)', 'Conceito e classificação das constituições',
  'Ordem Econômica e Financeira', 'Ordem Social (seguridade, educação, meio ambiente)',
  'Poder Constituinte (originário e derivado)', 'Eficácia das Normas Constitucionais',
  'Direitos sociais', 'Tribunais de Contas (fiscalização)',
  'Poder Judiciário (estrutura e garantias)', 'Direitos políticos e partidos',
  'Funções essenciais à Justiça (MP, AGU, Defensoria)', 'Controle de Constitucionalidade',
  'Ordem Constitucional'
]);

-- Direito Processual Penal: o edital para em "Do processo comum" — júri e
-- procedimentos especiais ficam de fora, assim como citações/intimações.
select public.curar_topicos_edital('pm-go-soldado', 'Direito Processual Penal', array[
  'Procedimento do júri', 'Procedimentos especiais', 'Citações, intimações e prazos'
]);

-- Direito Administrativo: sem bens públicos, serviços públicos/concessões,
-- intervenção na propriedade, terceiro setor e LAI.
select public.curar_topicos_edital('pm-go-soldado', 'Direito Administrativo', array[
  'Bens Públicos', 'Serviços Públicos', 'Concessão, permissão e autorização',
  'Intervenção do Estado na Propriedade', 'Desapropriação',
  'Servidão, requisição, tombamento e limitações',
  'Terceiro setor (OS, OSCIP, entidades de apoio)',
  'Lei de Acesso à Informação e Transparência'
]);

-- Legislação Extravagante do Combatente cobre drogas, hediondos, preconceito,
-- abuso, tortura, ECA, desarmamento, consumidor, ambiental, juizados, CTB,
-- interceptação, 12.850 e pacote anticrime — só lavagem de dinheiro fica fora.
select public.curar_topicos_edital('pm-go-soldado', 'Legislação Penal Especial', array[
  'Lavagem de dinheiro (9.613/98)'
]);

-- Sem exclusões (o programa oficial cobre a matéria inteira do catálogo):
select public.curar_topicos_edital('pm-go-soldado', 'Língua Portuguesa', array[]::text[]);
select public.curar_topicos_edital('pm-go-soldado', 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_edital('pm-go-soldado', 'Direito Penal Militar', array[]::text[]);
select public.curar_topicos_edital('pm-go-soldado', 'Direito Processual Penal Militar', array[]::text[]);

-- ══ PM-GO · Oficial/Cadete (Edital 003/2022) ══════════════════════════════
-- Programa comprehensivo — a matéria inteira, com poucas exceções.

select public.curar_topicos_edital('pm-go-oficial', 'Direito Constitucional', array[
  'Sistema Tributário Nacional (na CF)', 'Tribunais de Contas (fiscalização)',
  'Remédios constitucionais (HC, MS, MI, HD, ação popular)',
  'Defesa do Estado e das Instituições'
]);

select public.curar_topicos_edital('pm-go-oficial', 'Direito Administrativo', array[
  'Bens Públicos', 'Terceiro setor (OS, OSCIP, entidades de apoio)',
  'Lei de Acesso à Informação e Transparência'
]);

select public.curar_topicos_edital('pm-go-oficial', 'Língua Portuguesa', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Direito Penal', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Direito Processual Penal', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Direito Penal Militar', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Direito Processual Penal Militar', array[]::text[]);
select public.curar_topicos_edital('pm-go-oficial', 'Legislação Penal Especial', array[]::text[]);

-- ══ PM-GO · Soldado Músico (Edital 002/2022, tabela 8.2) ══════════════════
-- Constitucional do Músico é diferente do Combatente: inclui direitos
-- sociais, direitos políticos, poder judiciário e anistia/indulto, mas não
-- tem processo legislativo.
select public.curar_topicos_edital('pm-go-soldado-musico', 'Direito Constitucional', array[
  'Controle difuso', 'Teoria da Constituição', 'Constitucionalismo',
  'Sistema Tributário Nacional (na CF)', 'Repartição de competências',
  'Remédios constitucionais (HC, MS, MI, HD, ação popular)', 'Processo legislativo',
  'Controle concentrado (ADI, ADC, ADPF)', 'Ordem Econômica e Financeira',
  'Ordem Social (seguridade, educação, meio ambiente)',
  'Poder Constituinte (originário e derivado)', 'Eficácia das Normas Constitucionais',
  'Tribunais de Contas (fiscalização)', 'Funções essenciais à Justiça (MP, AGU, Defensoria)',
  'Controle de Constitucionalidade', 'Ordem Constitucional'
]);

-- Direito Administrativo do Músico = mesmo programa do Combatente.
select public.curar_topicos_edital('pm-go-soldado-musico', 'Direito Administrativo', array[
  'Bens Públicos', 'Serviços Públicos', 'Concessão, permissão e autorização',
  'Intervenção do Estado na Propriedade', 'Desapropriação',
  'Servidão, requisição, tombamento e limitações',
  'Terceiro setor (OS, OSCIP, entidades de apoio)',
  'Lei de Acesso à Informação e Transparência'
]);

select public.curar_topicos_edital('pm-go-soldado-musico', 'Língua Portuguesa', array[]::text[]);
select public.curar_topicos_edital('pm-go-soldado-musico', 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_edital('pm-go-soldado-musico', 'Direito Penal Militar', array[]::text[]);
-- Teoria Musical já nasceu do Anexo II (migration 20260731220000).
select public.curar_topicos_edital('pm-go-soldado-musico', 'Teoria Musical', array[]::text[]);

drop function public.curar_topicos_edital(text, text, text[]);
