do $$
declare
  v_edital uuid;
  v_topico_pai uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-oficial-de-justica';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id
    and ecs.edital_catalog_id = v_edital
    and s.name in ('Atualidades e Conhecimentos Gerais', 'Legislação (Ética, Improbidade e Licitações)', 'Raciocínio Lógico-Matemático', 'Direito Processual Civil');

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Língua Portuguesa'
    and tc.name in ('Redação Oficial', 'Princípios e características (Manual da Presidência)', 'Pronomes de tratamento', 'Tipos de documentos (ofício, memorando...)');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Língua Portuguesa';

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Informática'
    and tc.name in ('Armazenamento e Computação em Nuvem','Conceitos de Banco de Dados e Big Data','Conceitos de Hardware e Software','Segurança da Informação','Criptografia e certificação digital','Malwares e ameaças (vírus, phishing, ransomware)','Mecanismos de proteção (firewall, antivírus, backup)','Princípios (confidencialidade, integridade...)','Conceitos de redes (LAN, WAN, protocolos)','Linux (conceitos e operação)');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Informática';

  -- Direito Constitucional: programa de 16 itens, sem controle de constitucionalidade,
  -- ordem constitucional (econ/social/tributária), teoria da constituição, anistia/graça/indulto, defesa do Estado, eficácia das normas
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Constitucional'
    and tc.name in ('Anistia, graça e indulto','Controle de Constitucionalidade','Controle concentrado (ADI, ADC, ADPF)','Controle difuso','Defesa do Estado e das Instituições','Eficácia das Normas Constitucionais','Ordem Constitucional','Ordem Econômica e Financeira','Ordem Social (seguridade, educação, meio ambiente)','Sistema Tributário Nacional (na CF)','Teoria da Constituição','Conceito e classificação das constituições','Constitucionalismo','Poder Constituinte (originário e derivado)');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Constitucional';

  -- Direito Administrativo: programa cita só o processo federal (9.784), não o
  -- estadual; não cita bens públicos, improbidade, LAI, nem intervenção na propriedade
  -- (esses 3 primeiros já são cobertos pela matéria Legislação deste edital)
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Administrativo'
    and tc.name in ('Bens Públicos','Improbidade Administrativa (Lei 8.429/92)','Intervenção do Estado na Propriedade','Desapropriação','Servidão, requisição, tombamento e limitações','Lei de Acesso à Informação e Transparência','Processo administrativo de Goiás (Lei estadual 13.800/01)');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Administrativo';

  -- Direito Civil: programa não cita Direito das Coisas, Família nem Sucessões
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Civil'
    and tc.name in ('Direito das Coisas','Direitos reais sobre coisa alheia','Posse','Propriedade','Família','Alimentos, bens e regime patrimonial','Casamento e união estável','Relações de parentesco','Sucessões','Inventário e partilha','Sucessão legítima e testamentária');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Civil';

  -- Direito Processual Penal: sem inquérito policial, prisões/cautelares, provas,
  -- questões incidentes, execução penal/HC; procedimentos só o especial (crimes de
  -- responsabilidade de funcionário público)
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Processual Penal'
    and tc.name in ('Execução Penal e Habeas Corpus','Inquérito Policial','Conceito, características e finalidade','Indiciamento e conclusão','Instauração e procedimentos','Prisões e Medidas Cautelares','Liberdade provisória e fiança','Medidas cautelares diversas da prisão','Prisão em flagrante','Prisão preventiva e temporária','Provas','Meios de prova (perícia, testemunha, interrogatório...)','Provas ilícitas','Teoria geral da prova e ônus','Questões e processos incidentes','Procedimento comum (ordinário, sumário, sumaríssimo)','Procedimento do júri');
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Processual Penal';

  -- Direito Penal: cria 2 tópicos novos (crimes de responsabilidade fiscal e
  -- política — leis explicitamente citadas mas sem tópico no catálogo)
  select tc.id into v_topico_pai from public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Direito Penal' and tc.name = 'Crimes contra a Administração Pública';
  if v_topico_pai is null then raise exception 'pai não encontrado'; end if;

  insert into public.topics_catalog (subject_catalog_id, parent_id, name)
  select (select tc3.subject_catalog_id from public.topics_catalog tc3 where tc3.id = v_topico_pai), v_topico_pai, v.name
  from (values
    ('Crime de responsabilidade fiscal (Lei 10.028/2000)'),
    ('Crimes de responsabilidade de agentes políticos (Lei 1.079/1950 e Decreto-lei 201/1967)')
  ) as v(name)
  where not exists (
    select 1 from public.topics_catalog tc2 where tc2.parent_id = v_topico_pai and tc2.name = v.name
  );

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc
  where tc.parent_id = v_topico_pai
    and tc.name in ('Crime de responsabilidade fiscal (Lei 10.028/2000)', 'Crimes de responsabilidade de agentes políticos (Lei 1.079/1950 e Decreto-lei 201/1967)')
    and not exists (select 1 from public.edital_catalog_topics x where x.edital_catalog_id = v_edital and x.topic_catalog_id = tc.id);

  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Penal'
    and tc.name in (
      'Aplicação da Lei Penal','Disposições constitucionais aplicáveis ao direito penal','Interpretação e analogia','Lei penal no tempo e no espaço','Princípios e fontes do Direito Penal',
      'Crimes contra a Dignidade Sexual','Crimes sexuais contra vulnerável','Demais crimes contra a dignidade sexual','Estupro e violação sexual',
      'Crimes contra a Família (arts. 235–249)',
      'Crimes contra a Fé Pública','Falsidade documental','Moeda falsa',
      'Crimes contra a Paz e a Incolumidade Pública',
      'Crimes contra a Pessoa','Crimes contra a honra (calúnia, difamação, injúria)','Crimes contra a liberdade individual','Crimes contra a vida (homicídio, aborto, infanticídio)','Lesão corporal','Periclitação da vida e da saúde',
      'Crimes contra o Patrimônio','Apropriação indébita','Estelionato e outras fraudes','Furto','Receptação e dano','Roubo e extorsão',
      'Extinção da Punibilidade','Causas de extinção','Prescrição, decadência e perempção',
      'Concurso de crimes','Concurso de pessoas','Desistência, arrependimento e crime impossível',
      'Aplicação e dosimetria da pena','Espécies de penas','Medidas de segurança'
    );
  update public.edital_catalog_subjects ecs set topicos_curados = true from public.subjects_catalog s
  where ecs.subject_catalog_id = s.id and ecs.edital_catalog_id = v_edital and s.name = 'Direito Penal';
end $$;

do $$
declare v int;
begin
  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Língua Portuguesa'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 30 then raise exception 'LP: esperado 30, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Informática'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 9 then raise exception 'Informática: esperado 9, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Constitucional'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 20 then raise exception 'DConst: esperado 20, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Administrativo'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 32 then raise exception 'DAdm: esperado 32, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Civil'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 20 then raise exception 'DCivil: esperado 20, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Processual Penal'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 16 then raise exception 'DPP: esperado 16, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Penal'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='tj-go-oficial-de-justica';
  if v <> 16 then raise exception 'DPenal: esperado 16, achei %', v; end if;

  select count(*) into v from public.edital_catalog_subjects ecs
    join public.editais_catalog e on e.id=ecs.edital_catalog_id and e.slug='tj-go-oficial-de-justica'
    where not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
