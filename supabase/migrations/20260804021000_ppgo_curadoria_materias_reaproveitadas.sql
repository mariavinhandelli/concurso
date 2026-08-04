-- PP-GO Policial Penal — curadoria das 11 matérias reaproveitadas do
-- catálogo geral, comparadas item a item contra o Anexo IV do Edital
-- 02/2024 (IBFC).
do $$
declare
  v_edital uuid;
  v_topico_pai uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'policia-penal-go-policial';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  -- Vincula TODOS os tópicos existentes dessas 11 matérias primeiro (o
  -- registro nasceu sem nenhum vínculo — não veio de "vincula tudo" como os
  -- outros editais).
  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id
  from public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name in (
    'Língua Portuguesa','Conhecimentos Regionais','Raciocínio Lógico-Matemático',
    'Ética no Serviço Público','Informática','Direito Administrativo',
    'Direito Constitucional','Direito Penal','Direito Processual Penal',
    'Direitos Humanos','Legislação Penal Especial'
  )
  on conflict do nothing;

  -- Língua Portuguesa: programa de 12 itens não cita variação linguística
  -- nem verbos (tempos/modos/vozes) como tema próprio.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Língua Portuguesa'
    and tc.name in ('Estilística e Variação Linguística','Verbos','Emprego dos tempos e modos','Flexão verbal (tempo, modo, pessoa)','Vozes verbais');

  -- Conhecimentos Regionais: programa não cita cultura/folclore/patrimônio.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Conhecimentos Regionais'
    and tc.name in ('Cultura e Patrimônio','Manifestações culturais e folclore','Patrimônio histórico e artístico','Personalidades e produção cultural');

  -- Raciocínio Lógico: sem matemática básica/financeira nem lógica de conjuntos.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Raciocínio Lógico-Matemático'
    and tc.name in ('Matemática Básica','Operações, frações e decimais','Porcentagem','Razão e proporção','Regra de três (simples e composta)',
                     'Matemática Financeira','Descontos e taxas','Juros compostos','Juros simples','Lógica de Conjuntos');

  -- Ética no Serviço Público: o programa cita SÓ o Decreto estadual
  -- 9.837/2021 — os 7 tópicos atuais são do código federal (Decreto
  -- 1.171/94) e de temas genéricos que não aparecem no edital. Cria a
  -- árvore específica do decreto estadual (Cap. I: princípios e valores;
  -- Cap. II: condutas e tomada de decisão; apuração pela Câmara de
  -- Compliance).
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Ética no Serviço Público';

  insert into public.topics_catalog (subject_catalog_id, name)
  select s.id, 'Código de Ética e Conduta Profissional do Servidor do Estado de Goiás (Decreto 9.837/2021)'
  from public.subjects_catalog s where s.name = 'Ética no Serviço Público'
  and not exists (
    select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = s.id
    and tc2.name = 'Código de Ética e Conduta Profissional do Servidor do Estado de Goiás (Decreto 9.837/2021)'
  );

  select tc.id into v_topico_pai from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Ética no Serviço Público' and tc.name = 'Código de Ética e Conduta Profissional do Servidor do Estado de Goiás (Decreto 9.837/2021)';

  insert into public.topics_catalog (subject_catalog_id, parent_id, name)
  select (select subject_catalog_id from public.topics_catalog where id = v_topico_pai), v_topico_pai, v.name
  from (values ('Princípios e valores fundamentais (Cap. I)'), ('Condutas e tomada de decisão (Cap. II)'), ('Apuração de violações e Câmara de Compliance')) as v(name)
  where not exists (select 1 from public.topics_catalog tc2 where tc2.parent_id = v_topico_pai and tc2.name = v.name);

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc
  where tc.id = v_topico_pai or tc.parent_id = v_topico_pai
  on conflict do nothing;

  -- Informática: sem banco de dados/big data nem conceitos abstratos de
  -- hardware/software; "conceitos de redes" (LAN/WAN/protocolos) também
  -- não é citado — só uso prático de internet/navegadores. Cria tópico do
  -- SEI e da assinatura eletrônica estadual, citados nominalmente.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Informática'
    and tc.name in ('Conceitos de Banco de Dados e Big Data','Conceitos de Hardware e Software','Conceitos de redes (LAN, WAN, protocolos)');

  insert into public.topics_catalog (subject_catalog_id, name)
  select s.id, 'Sistema Eletrônico de Informações (SEI) e assinatura eletrônica (Decreto Estadual 10.254/2023)'
  from public.subjects_catalog s where s.name = 'Informática'
  and not exists (select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = s.id and tc2.name = 'Sistema Eletrônico de Informações (SEI) e assinatura eletrônica (Decreto Estadual 10.254/2023)');

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Informática' and tc.name = 'Sistema Eletrônico de Informações (SEI) e assinatura eletrônica (Decreto Estadual 10.254/2023)'
  on conflict do nothing;

  -- Direito Administrativo: programa não cita atos administrativos,
  -- controle da administração, intervenção na propriedade, licitações,
  -- poder de polícia, poderes administrativos, responsabilidade civil do
  -- Estado nem serviços públicos. Cria LGPD e Lei do SUSP (13.675/18),
  -- citadas nominalmente e sem tópico correspondente.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Administrativo'
    and tc.name in (
      'Atos Administrativos','Classificação e espécies','Conceito, requisitos e atributos','Extinção (anulação, revogação, cassação...)',
      'Controle da Administração Pública','Controle interno e externo','Controle judicial',
      'Intervenção do Estado na Propriedade','Desapropriação','Servidão, requisição, tombamento e limitações',
      'Licitações e Contratos','Contratos administrativos','Dispensa e inexigibilidade','Fases da licitação','Princípios e modalidades (Lei 14.133/21)',
      'Poder de Polícia','Poderes Administrativos','Responsabilidade Civil do Estado',
      'Serviços Públicos','Conceito, princípios e classificação','Concessão, permissão e autorização'
    );

  insert into public.topics_catalog (subject_catalog_id, name)
  select s.id, v.name from public.subjects_catalog s
  cross join (values ('Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018)'), ('Sistema Único de Segurança Pública — SUSP (Lei 13.675/2018)')) as v(name)
  where s.name = 'Direito Administrativo'
  and not exists (select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = s.id and tc2.name = v.name);

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Direito Administrativo' and tc.name in ('Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018)', 'Sistema Único de Segurança Pública — SUSP (Lei 13.675/2018)')
  on conflict do nothing;

  -- Direito Constitucional: programa de 5 itens é extremamente restrito —
  -- só direitos/garantias fundamentais, defesa do Estado/segurança pública
  -- e princípios fundamentais.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Constitucional'
    and tc.name in (
      'Anistia, graça e indulto',
      'Controle de Constitucionalidade','Controle concentrado (ADI, ADC, ADPF)','Controle difuso',
      'Eficácia das Normas Constitucionais',
      'Ordem Constitucional','Ordem Econômica e Financeira','Ordem Social (seguridade, educação, meio ambiente)','Sistema Tributário Nacional (na CF)',
      'Organização do Estado','Administração Pública na CF (arts. 37–41)','Constituição do Estado de Goiás','Organização político-administrativa','Repartição de competências','União, Estados, Municípios e DF',
      'Organização dos Poderes','Funções essenciais à Justiça (MP, AGU, Defensoria)','Poder Executivo (atribuições e responsabilidade)','Poder Judiciário (estrutura e garantias)','Poder Legislativo (estrutura e imunidades)','Processo legislativo','Tribunais de Contas (fiscalização)',
      'Teoria da Constituição','Conceito e classificação das constituições','Constitucionalismo','Poder Constituinte (originário e derivado)'
    );

  -- Direito Penal: exclui o que não é citado; mantém só "Concurso de
  -- pessoas" em Iter Criminis; cria os 4 estatutos/leis citados nominalmente
  -- sem tópico correspondente (Lei 1.079/1950 já existe — reaproveitada).
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Penal'
    and tc.name in (
      'Crimes contra a honra (calúnia, difamação, injúria)',
      'Concurso de crimes','Consumação e tentativa','Desistência, arrependimento e crime impossível',
      'Crimes contra a Dignidade Sexual','Crimes sexuais contra vulnerável','Demais crimes contra a dignidade sexual','Estupro e violação sexual',
      'Crimes contra a Família (arts. 235–249)',
      'Crimes contra a Fé Pública','Falsidade documental','Moeda falsa',
      'Crimes contra a Paz e a Incolumidade Pública',
      'Penas','Aplicação e dosimetria da pena','Efeitos da condenação','Espécies de penas','Medidas de segurança'
    );

  insert into public.topics_catalog (subject_catalog_id, name)
  select s.id, v.name from public.subjects_catalog s
  cross join (values
    ('Prisão temporária (Lei 7.960/1989)'),
    ('Estatuto do Idoso — crimes (Lei 10.741/2003)'),
    ('Estatuto da Igualdade Racial (Lei 12.288/2010)'),
    ('Crimes e infrações contra a criança e o adolescente (Lei 8.069/1990)')
  ) as v(name)
  where s.name = 'Direito Penal'
  and not exists (select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = s.id and tc2.name = v.name);

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Direito Penal' and tc.name in ('Prisão temporária (Lei 7.960/1989)','Estatuto do Idoso — crimes (Lei 10.741/2003)','Estatuto da Igualdade Racial (Lei 12.288/2010)','Crimes e infrações contra a criança e o adolescente (Lei 8.069/1990)')
  on conflict do nothing;

  -- Direito Processual Penal: mantém só o que o programa cita
  -- explicitamente (inquérito, ação penal, prisões/cautelares, competência,
  -- incidentes, prova, sujeitos, sentença, procedimento comum, HC, execução).
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direito Processual Penal'
    and tc.name in (
      'Nulidades','Recursos em espécie',
      'Princípios e Aplicação da Lei Processual','Lei processual no tempo e no espaço','Princípios do processo penal',
      'Procedimento do júri','Procedimentos especiais',
      'Citações, intimações e prazos'
    );

  -- Direitos Humanos: exclui o que a lista de tratados do edital não cita;
  -- cria os 3 instrumentos citados nominalmente sem tópico correspondente.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Direitos Humanos'
    and tc.name in ('Grupos vulneráveis e políticas afirmativas','Lei nº 13.060/2014 — instrumentos de menor potencial ofensivo','Pacto Internacional dos Direitos Civis e Políticos','Uso da força e direitos humanos na atividade policial');

  insert into public.topics_catalog (subject_catalog_id, name)
  select s.id, v.name from public.subjects_catalog s
  cross join (values
    ('Declaração de Pequim (IV Conferência Mundial sobre a Mulher)'),
    ('Convenção para a Prevenção e a Repressão do Crime de Genocídio'),
    ('Regras Mínimas das Nações Unidas para o Tratamento de Presos (Regras de Mandela)')
  ) as v(name)
  where s.name = 'Direitos Humanos'
  and not exists (select 1 from public.topics_catalog tc2 where tc2.subject_catalog_id = s.id and tc2.name = v.name);

  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Direitos Humanos' and tc.name in ('Declaração de Pequim (IV Conferência Mundial sobre a Mulher)','Convenção para a Prevenção e a Repressão do Crime de Genocídio','Regras Mínimas das Nações Unidas para o Tratamento de Presos (Regras de Mandela)')
  on conflict do nothing;

  -- Legislação Penal Especial ("Legislação Penal Extravagante" no edital):
  -- o programa cita exatamente 8 leis já cadastradas — mantém só elas (e os
  -- 2 pais necessários) em vez de excluir tudo o mais por nome.
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and s.name = 'Legislação Penal Especial'
    and tc.name not in (
      'Crimes Hediondos (8.072/90)',
      'Estatuto do Desarmamento (10.826/03)', 'Crimes e tipos penais', 'Posse e porte de arma',
      'Lei de Drogas (11.343/06)',
      'Lei Maria da Penha (11.340/06)', 'Medidas protetivas de urgência', 'Violência doméstica e formas',
      'Organizações Criminosas (12.850/13)',
      'Tortura e Abuso de Autoridade', 'Lei de Tortura (9.455/97)', 'Lei de Abuso de Autoridade (13.869/19)',
      'Outras Leis Penais Relevantes', 'Crimes de racismo (Lei 7.716/89)'
    );
end $$;

-- "Crimes e tipos penais" e "Conceito e crimes" existem sob 2 pais
-- diferentes (Estatuto do Desarmamento e Lei de Drogas) — o NOT IN acima
-- por nome pode ter deixado ambos ou removido o errado; corrige mirando
-- por parent_id explícito.
do $$
declare
  v_edital uuid;
  v_desarmamento uuid;
  v_drogas uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'policia-penal-go-policial';
  select tc.id into v_desarmamento from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
    where s.name = 'Legislação Penal Especial' and tc.name = 'Estatuto do Desarmamento (10.826/03)';
  select tc.id into v_drogas from public.topics_catalog tc join public.subjects_catalog s on s.id = tc.subject_catalog_id
    where s.name = 'Legislação Penal Especial' and tc.name = 'Lei de Drogas (11.343/06)';

  -- Remove os filhos de Lei de Drogas (não citados: só "Lei 11.343/2006" no
  -- geral, sem detalhar crimes/procedimento — mantém só o pai).
  delete from public.edital_catalog_topics ect
  using public.topics_catalog tc
  where ect.edital_catalog_id = v_edital and ect.topic_catalog_id = tc.id and tc.parent_id = v_drogas;

  -- Garante que os 2 filhos do Estatuto do Desarmamento ficaram vinculados
  -- (o NOT IN por nome pode ter incluído por engano os mesmos nomes de
  -- outro pai — reforça explicitamente).
  insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
  select v_edital, tc.id from public.topics_catalog tc where tc.parent_id = v_desarmamento
  on conflict do nothing;

  update public.edital_catalog_subjects set topicos_curados = true
  where edital_catalog_id = v_edital and subject_catalog_id in (
    select id from public.subjects_catalog where name in (
      'Língua Portuguesa','Conhecimentos Regionais','Raciocínio Lógico-Matemático',
      'Ética no Serviço Público','Informática','Direito Administrativo',
      'Direito Constitucional','Direito Penal','Direito Processual Penal',
      'Direitos Humanos','Legislação Penal Especial'
    )
  );
end $$;

do $$
declare v int;
begin
  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Língua Portuguesa'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 29 then raise exception 'LP: esperado 29, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Conhecimentos Regionais'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 17 then raise exception 'Regionais: esperado 17, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Raciocínio Lógico-Matemático'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 15 then raise exception 'RLM: esperado 15, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Ética no Serviço Público'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 4 then raise exception 'Ética: esperado 4 (só o decreto estadual), achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Informática'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 17 then raise exception 'Informática: esperado 17, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Administrativo'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 20 then raise exception 'DAdm: esperado 20, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Constitucional'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 8 then raise exception 'DConst: esperado 8, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Penal'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 37 then raise exception 'DPenal: esperado 37 (catálogo tem 51, já incluindo os 2 tópicos de responsabilidade fiscal/política criados hoje para TJ-GO), achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direito Processual Penal'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 25 then raise exception 'DPP: esperado 25, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Direitos Humanos'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 9 then raise exception 'DH: esperado 9, achei %', v; end if;

  select count(*) into v from public.edital_catalog_topics t join public.topics_catalog tc on tc.id=t.topic_catalog_id
    join public.subjects_catalog s on s.id=tc.subject_catalog_id and s.name='Legislação Penal Especial'
    join public.editais_catalog e on e.id=t.edital_catalog_id and e.slug='policia-penal-go-policial';
  if v <> 14 then raise exception 'LPE: esperado 14 (7 leis-tema + filhos relevantes), achei %', v; end if;

  select count(*) into v from public.edital_catalog_subjects ecs
    join public.editais_catalog e on e.id=ecs.edital_catalog_id and e.slug='policia-penal-go-policial'
    where ecs.subject_catalog_id in (select id from public.subjects_catalog where name in (
      'Língua Portuguesa','Conhecimentos Regionais','Raciocínio Lógico-Matemático',
      'Ética no Serviço Público','Informática','Direito Administrativo',
      'Direito Constitucional','Direito Penal','Direito Processual Penal',
      'Direitos Humanos','Legislação Penal Especial'
    )) and not ecs.topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
