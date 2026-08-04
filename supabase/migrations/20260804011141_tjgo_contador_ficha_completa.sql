-- TJ-GO — Analista Judiciário — Área Especializada — Contador (Edital 01/2024).
-- Mesmas 4 matérias comuns do órgão (Língua Portuguesa exclui Redação
-- Oficial, resto pleno). Informática (13 itens, muito operacional) exclui
-- nuvem/BD-BigData/conceitos hardware-software/segurança da informação/
-- Linux/conceitos de redes — não citados. Contabilidade Geral exclui
-- Análise das Demonstrações e Operações com Mercadorias (não citadas).
-- Contabilidade Pública: cobertura plena (na dúvida mantém para
-- nomenclaturas técnicas como DCASP/PCASP/Lei 4.320, cujo conteúdo
-- descritivo aparece no programa mesmo sem citar a sigla/lei por nome).
do $$
declare
  v_edital uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-contador';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id
    and ecs.edital_catalog_id = v_edital
    and s.name in ('Atualidades e Conhecimentos Gerais', 'Legislação (Ética, Improbidade e Licitações)', 'Raciocínio Lógico-Matemático', 'Contabilidade Pública');

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Língua Portuguesa'
    and tc.name in (
      'Redação Oficial',
      'Princípios e características (Manual da Presidência)',
      'Pronomes de tratamento',
      'Tipos de documentos (ofício, memorando...)'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Língua Portuguesa';

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Informática'
    and tc.name in (
      'Armazenamento e Computação em Nuvem',
      'Conceitos de Banco de Dados e Big Data',
      'Conceitos de Hardware e Software',
      'Segurança da Informação',
      'Criptografia e certificação digital',
      'Malwares e ameaças (vírus, phishing, ransomware)',
      'Mecanismos de proteção (firewall, antivírus, backup)',
      'Princípios (confidencialidade, integridade...)',
      'Conceitos de redes (LAN, WAN, protocolos)',
      'Linux (conceitos e operação)'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Informática';

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital
    and ect.topic_catalog_id = tc.id
    and s.name = 'Contabilidade Geral'
    and tc.name in (
      'Análise das Demonstrações Contábeis',
      'Índices de endividamento',
      'Índices de liquidez',
      'Índices de rentabilidade',
      'Operações com Mercadorias'
    );

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Contabilidade Geral';
end $$;

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Língua Portuguesa'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-contador';
  if v <> 30 then raise exception 'Língua Portuguesa: esperado 30, achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Informática'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-contador';
  if v <> 9 then raise exception 'Informática: esperado 9 (19-10), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Contabilidade Geral'
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'tj-go-contador';
  if v <> 20 then raise exception 'Contabilidade Geral: esperado 20 (25-5), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'tj-go-contador'
  where not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
