-- Ficha completa da PC-GO Papiloscopista (03/08) — 2º cargo do Edital
-- 006/2022, cargo por cargo (Agente/Escrivão já feitos em 20260803230000).
-- Mesmo Anexo II, bloco de "Conhecimentos Específicos" próprio (a partir de
-- "CARGO: PAPILOSCOPISTA POLICIAL 3ª CLASSE").
--
-- Achados específicos deste cargo:
--   - Língua Portuguesa, Conhecimentos Regionais, Raciocínio Lógico,
--     Direito Constitucional, Criminalística, Medicina Legal e Legislação
--     Estadual têm texto IDÊNTICO ao de Agente/Escrivão — mesma curadoria.
--   - Direito Administrativo: mesmo texto do Agente/Escrivão, mas aqui o
--     item 6 cita "Lei nº 8.429/1992 (improbidade administrativa)"
--     EXPLICITAMENTE dentro do próprio Direito Administrativo (no
--     Agente/Escrivão, Improbidade só aparecia via Legislação Penal
--     Especial) — mesma conclusão pelos dois caminhos: fica incluída.
--   - Direito Penal do Papiloscopista é MAIS LONGO que o de Agente/Escrivão:
--     além do núcleo do Código Penal (itens 1-10, mesma curadoria), embute
--     16 leis extravagantes direto na lista (Desarmamento, Hediondos,
--     racismo, tortura, ECA, Idoso, CTB, Maria da Penha, Drogas, Consumo,
--     Contravenções, Ambientais, Abuso de Autoridade, Lei 14.344/22, Lei
--     13.431/17) — mas o Papiloscopista NÃO TEM "Legislação Penal
--     Especial" como matéria própria no catálogo. Como o vínculo do tópico
--     exige que a matéria dele já esteja ativada para o cargo
--     (activate_catalog_edital só ativa as matérias listadas em
--     edital_catalog_subjects), e adicionar essa matéria aqui exigiria
--     inventar quantas das 11 questões de "Direito Penal" vêm de cada lei
--     — informação que a banca não divulga —, a DECISÃO é: manter como está
--     (sem Legislação Penal Especial na ficha deste cargo, sem inventar
--     split de questões). O texto oficial completo (com as 16 leis) segue
--     100% visível em "Ver programa oficial desta matéria"; só os
--     checkboxes de tópico específicos dessas leis não existem para este
--     cargo. Mesmo raciocínio se aplica ao item extra de Direito Processual
--     Penal ("5 Juizados Especiais Criminais") — também Legislação Penal
--     Especial, mesma decisão.
--   - Direito Processual Penal: núcleo idêntico ao Agente/Escrivão (mesma
--     curadoria) + o item de Juizados (ver acima).
--   - Técnicas de Identificação (Papiloscopia): cobre identificação
--     humana, papiloscopia/datiloscopia, classificação (sistema Vucetich),
--     identidade civil/criminal e retrato falado — mas NÃO menciona
--     levantamento/revelação de impressões, confronto papiloscópico/laudos
--     nem necropapiloscopia. 3 tópicos novos para as leis específicas do
--     item 1-3 (12.037/2009, 9.454/1997, 7.116/1983), que não tinham
--     tópico em lugar nenhum do catálogo.
--   - Arquivologia: cobertura completa, sem exclusões.
--   - Química, Física e Biologia (Noções): matéria SEM NENHUM tópico no
--     catálogo até agora — árvore criada do zero a partir do próprio texto
--     do edital (3 troncos: Química, Física, Biologia).
--
-- edital_url já corrigida para o PDF retificado em 20260803230000 (mesmo
-- Edital 006, vale para os 3 cargos). Past paper e concurso_stats
-- conferidos: prova de 2022 aponta pro PDF direto do qconcursos (ainda
-- HTTP 200), stats com 1 linha completa — nada a corrigir.

-- ── 1. Tópicos novos ─────────────────────────────────────────────────────────
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.pos
from public.subjects_catalog s, (values
  ('Identificação criminal do civilmente identificado (Lei 12.037/09)', 9),
  ('Número único de registro de identidade civil (Lei 9.454/97)', 10),
  ('Expedição e validade nacional da carteira de identidade (Lei 7.116/83)', 11)
) as v(name, pos)
where s.name = 'Técnicas de Identificação (Papiloscopia)'
  and not exists (select 1 from public.topics_catalog t where t.subject_catalog_id = s.id and t.name = v.name);

insert into public.topics_catalog (subject_catalog_id, parent_id, name, position)
select s.id, null, v.name, v.pos
from public.subjects_catalog s, (values
  ('Química', 1), ('Física', 2), ('Biologia', 3)
) as v(name, pos)
where s.name = 'Química, Física e Biologia (Noções)'
  and not exists (select 1 from public.topics_catalog t where t.subject_catalog_id = s.id and t.name = v.name);

insert into public.topics_catalog (subject_catalog_id, parent_id, name, position)
select s.id, p.id, vals.name, vals.pos
from public.subjects_catalog s
join (values
  ('Química', 'Estrutura da matéria e tabela periódica', 1),
  ('Química', 'Soluções, misturas e propriedades coligativas', 2),
  ('Química', 'Reações, estequiometria e equilíbrio químico', 3),
  ('Química', 'Química orgânica (estrutura e nomenclatura)', 4),
  ('Física', 'Oscilações e ondas', 1),
  ('Física', 'Eletricidade e circuitos', 2),
  ('Física', 'Óptica geométrica e ondulatória', 3),
  ('Biologia', 'Citologia e bioquímica celular', 1),
  ('Biologia', 'Embriologia humana', 2),
  ('Biologia', 'Genética (leis de Mendel e herança)', 3)
) as vals(pai, name, pos) on true
join public.topics_catalog p on p.subject_catalog_id = s.id and p.name = vals.pai
where s.name = 'Química, Física e Biologia (Noções)'
  and not exists (select 1 from public.topics_catalog t where t.subject_catalog_id = s.id and t.name = vals.name and t.parent_id = p.id);

-- ── 2. Curadoria ─────────────────────────────────────────────────────────────
create or replace function public.curar_topicos_multi(
  p_slugs text[], p_materia text, p_excluir text[]
) returns void
language plpgsql
as $$
begin
  delete from public.edital_catalog_topics t
  using public.editais_catalog e, public.topics_catalog tc, public.subjects_catalog s
  where t.edital_catalog_id = e.id
    and e.slug = any (p_slugs)
    and t.topic_catalog_id = tc.id
    and tc.subject_catalog_id = s.id
    and s.name = p_materia
    and tc.name = any (p_excluir);

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  from public.editais_catalog e, public.subjects_catalog s
  where ecs.edital_catalog_id = e.id
    and e.slug = any (p_slugs)
    and ecs.subject_catalog_id = s.id
    and s.name = p_materia;
end;
$$;

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Língua Portuguesa', array[
  'Redação Oficial', 'Princípios e características (Manual da Presidência)',
  'Tipos de documentos (ofício, memorando...)', 'Pronomes de tratamento'
]);
select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Raciocínio Lógico-Matemático', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Legislação Estadual — Goiás', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Arquivologia', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Química, Física e Biologia (Noções)', array[]::text[]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Direito Administrativo', array[
  'Autarquias e fundações', 'Empresas públicas e sociedades de economia mista',
  'Terceiro setor (OS, OSCIP, entidades de apoio)',
  'Processo Administrativo (Lei 9.784/99)',
  'Licitações e Contratos', 'Princípios e modalidades (Lei 14.133/21)', 'Fases da licitação',
  'Dispensa e inexigibilidade', 'Contratos administrativos',
  'Serviços Públicos', 'Conceito, princípios e classificação', 'Concessão, permissão e autorização',
  'Agentes Públicos', 'Classificação e regime jurídico', 'Provimento, vacância, direitos e deveres',
  'Regime disciplinar e responsabilidade',
  'Bens Públicos',
  'Intervenção do Estado na Propriedade', 'Desapropriação',
  'Servidão, requisição, tombamento e limitações',
  'Lei de Acesso à Informação e Transparência'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Direito Constitucional', array[
  'Controle de Constitucionalidade', 'Controle difuso', 'Controle concentrado (ADI, ADC, ADPF)',
  'Remédios constitucionais (HC, MS, MI, HD, ação popular)',
  'Sistema Tributário Nacional (na CF)',
  'Ordem Econômica e Financeira',
  'Tribunais de Contas (fiscalização)'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Direito Penal', array[
  'Penas', 'Espécies de penas', 'Aplicação e dosimetria da pena', 'Medidas de segurança',
  'Efeitos da condenação',
  'Extinção da Punibilidade', 'Causas de extinção', 'Prescrição, decadência e perempção',
  'Crimes contra a Paz e a Incolumidade Pública'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Direito Processual Penal', array[
  'Princípios e Aplicação da Lei Processual', 'Princípios do processo penal',
  'Lei processual no tempo e no espaço',
  'Ação Penal', 'Ação penal pública e privada', 'Condições e pressupostos',
  'Sujeitos e Comunicação dos Atos', 'Juiz, MP, acusado e defensor', 'Competência',
  'Citações, intimações e prazos',
  'Procedimentos', 'Procedimento comum (ordinário, sumário, sumaríssimo)',
  'Procedimento do júri', 'Procedimentos especiais',
  'Nulidades e Recursos', 'Nulidades', 'Recursos em espécie',
  'Ações autônomas de impugnação (HC, revisão criminal)',
  'Execução Penal e Habeas Corpus'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Criminalística', array[
  'Vestígios e Evidências', 'Vestígios biológicos (sangue, DNA)',
  'Impressões digitais e papiloscopia', 'Documentoscopia e grafotécnica',
  'Balística Forense',
  'Perícias Especializadas', 'Perícia em crimes contra a pessoa',
  'Perícia em crimes contra o patrimônio', 'Perícia de incêndios e explosões',
  'Áreas de Apoio'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Medicina Legal', array[
  'Antropologia e Identificação', 'Identidade e identificação',
  'Datiloscopia e métodos de identificação',
  'Psicopatologia Forense'
]);

select public.curar_topicos_multi(array['pc-go-papiloscopista'], 'Técnicas de Identificação (Papiloscopia)', array[
  'Levantamento, revelação e transporte de impressões papilares',
  'Confronto papiloscópico e laudos',
  'Necropapiloscopia'
]);

drop function public.curar_topicos_multi(text[], text, text[]);

-- ── 3. edital_programas (texto oficial verbatim) ────────────────────────────
insert into public.edital_programas (edital_catalog_id, subject_catalog_id, texto, fonte_url, conferido_em)
select e.id, s.id, v.texto,
  'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/26822AnexII-d6b.pdf', '2026-08-03'
from (values
  ('pc-go-papiloscopista', 'Língua Portuguesa', '1 Compreensão e interpretação de textos de gêneros variados. 2 Reconhecimento de tipos e gêneros textuais. 3 Domínio da ortografia oficial. 4 Domínio dos mecanismos de coesão textual. 4.1 Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual. 4.2 Emprego de tempos e modos verbais. 5 Domínio da estrutura morfossintática do período. 5.1 Emprego das classes de palavras. 5.2 Relações de coordenação entre orações e entre termos da oração. 5.3 Relações de subordinação entre orações e entre termos da oração. 5.4 Emprego dos sinais de pontuação. 5.5 Concordância verbal e nominal. 5.6 Regência verbal e nominal. 5.7 Emprego do sinal indicativo de crase. 5.8 Colocação dos pronomes átonos. 6 Reescrita de frases e parágrafos do texto. 6.1 Significação das palavras. 6.2 Substituição de palavras ou de trechos de texto. 6.3 Reorganização da estrutura de orações e de períodos do texto. 6.4 Reescrita de textos de diferentes gêneros e níveis de formalidade.'),
  ('pc-go-papiloscopista', 'Conhecimentos Regionais', '1 Formação econômica de Goiás: a mineração no século XVIII, a agropecuária nos séculos XIX e XX, a estrada de ferro e a modernização da economia goiana, as transformações econômicas com a construção de Goiânia e Brasília, industrialização, infraestrutura e planejamento. 2 Modernização da agricultura e urbanização do território goiano. 3 População goiana: povoamento, movimentos migratórios e densidade demográfica. 4 Economia goiana: industrialização e infraestrutura de transportes e comunicação. 5 As regiões goianas e as desigualdades regionais. 6 Aspectos físicos do território goiano: vegetação, hidrografia, clima e relevo. 6 Aspectos da história política de Goiás: a independência em Goiás, o coronelismo na República Velha, as oligarquias, a Revolução de 1930, a administração política de 1930 até os dias atuais. 7 Aspectos da História Social de Goiás: o povoamento branco, os grupos indígenas, a escravidão e cultura negra, os movimentos sociais no campo e a cultura popular. 8 Atualidades econômicas, políticas e sociais do Brasil, especialmente do Estado de Goiás.'),
  ('pc-go-papiloscopista', 'Raciocínio Lógico-Matemático', '1 Estruturas lógicas. 2 Lógica de argumentação: analogias, inferências, deduções e conclusões. 3 Lógica sentencial (ou proposicional). 3.1 Proposições simples e compostas. 3.2 Tabelas verdade. 3.3 Equivalências. 3.4 Leis de De Morgan. 3.5 Diagramas lógicos. 4 Lógica de primeira ordem. 5 Princípios de contagem e probabilidade. 6 Operações com conjuntos. 7 Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais.'),
  ('pc-go-papiloscopista', 'Direito Administrativo', '1 Estado, Governo e Administração Pública. 1.1 Conceitos, elementos, poderes e organização. 1.2 Natureza, fins e princípios. 2 Organização administrativa da União: administração direta e indireta. 3 Atos administrativos. 3.1 Conceitos, requisitos, elementos, pressupostos e classificação. 3.2 Fato e ato administrativo. 3.3 Atos administrativos em espécie. 3.4 O silêncio no direito administrativo. 3.5 Cassação. 3.6 Revogação e anulação. 3.7 Processo administrativo (Lei estadual n.º 13.800/2001). 3.8 Fatos da administração pública: atos da administração pública e fatos administrativos. 3.9 Formação do ato administrativo: elementos, procedimento administrativo. 3.10 Validade, eficácia e autoexecutoriedade do ato administrativo. 3.11 Atos administrativos simples, complexos e compostos. 3.12 Atos administrativos unilaterais, bilaterais e multilaterais. 3.13 Atos administrativos gerais e individuais. 3.14 Atos administrativos vinculados e discricionários. 3.15 Mérito do ato administrativo, discricionariedade. 3.16 Ato administrativo inexistente. 3.17 Teoria das nulidades no direito administrativo. 3.18 Atos administrativos nulos e anuláveis. 3.19 Vícios do ato administrativo. 3.20 Teoria dos motivos determinantes. 3.21 Revogação, anulação e convalidação do ato administrativo. 4 Poderes administrativos. 4.1 Poder hierárquico. 4.2 Poder disciplinar. 4.3 Poder regulamentar. 4.4 Poder de polícia. 4.5 Uso e abuso do poder. 5 Controle e responsabilização da administração. 5.1 Controle administrativo. 5.2 Controle judicial. 5.3 Controle legislativo. 5.4 Responsabilidade civil do Estado. 6 Lei nº 8.429/1992 (improbidade administrativa).'),
  ('pc-go-papiloscopista', 'Direito Constitucional', '1 Constituição da República Federativa do Brasil de 1988. 1.1 Princípios fundamentais. 2 Aplicabilidade das normas constitucionais. 2.1 Normas de eficácia plena, contida e limitada. 2.2 Normas programáticas. 3 Direitos e garantias fundamentais. 3.1 Direitos e deveres individuais e coletivos, direitos sociais, direitos de nacionalidade, direitos políticos, partidos políticos. 4 Organização político-administrativa do Estado. 4.1 Estado federal brasileiro, União, estados, Distrito Federal, municípios e territórios. 5 Administração pública. 5.1 Disposições gerais, servidores públicos. 6 Poder executivo. 6.1 Atribuições e responsabilidades do presidente da República. 7 Poder legislativo. 7.1 Estrutura. 7.2 Funcionamento e atribuições. 7.3 Processo legislativo. 8 Poder judiciário. 8.1 Disposições gerais. 8.2 Órgãos do poder judiciário. 9 Funções essenciais à Justiça. 10 Defesa do Estado e das instituições democráticas. 10.1 Segurança pública. 10.2 Organização da segurança pública. 11 Ordem social. 11.1 Base e objetivos da ordem social. 11.2 Seguridade social. 11.3 Meio ambiente. 11.4 Família, criança, adolescente, idoso e índio. 12 Direitos humanos na Constituição Federal. 12.1 Política Nacional de Direitos Humanos. 12.2 A Constituição brasileira e os tratados internacionais de direitos humanos.'),
  ('pc-go-papiloscopista', 'Direito Penal', '1 Aplicação da lei penal. 1.1 Princípios da legalidade e da anterioridade. 1.2 Lei penal no tempo e no espaço. 1.3 Tempo e lugar do crime. 1.4 Lei penal excepcional, especial e temporária. 1.5 Territorialidade e extraterritorialidade da lei penal. 1.6 Contagem de prazo. 1.7 Interpretação da lei penal. 1.8 Analogia. 1.9 Irretroatividade da lei penal. 2 Infração penal: elementos, espécies, sujeito ativo e sujeito passivo. 3 O fato típico e seus elementos. 3.1 Crime consumado e tentado. 3.2 Concurso de crimes. 3.3 Ilicitude e causas de exclusão. 3.4 Punibilidade. 3.5 Excesso punível. 3.6 Culpabilidade (elementos e causas de exclusão). 4 Imputabilidade penal. 5 Concurso de pessoas. 6 Crimes contra a pessoa. 7 Crimes contra o patrimônio. 8 Crimes contra a dignidade sexual. 9 Crimes contra a fé pública. 10 Crimes contra a administração pública. 11 Crimes previstos no Estatuto do Desarmamento (Lei nº 10.826/0203); 12 Crimes hediondos (Lei nº 8.072/1990); 13 Crimes resultantes de preconceitos de raça ou de cor (Lei nº 7.716/1989); 14 Crimes de tortura (Lei nº 9.455/1997); 15 Crimes previstos no Estatuto da Criança e do Adolescente (Lei nº 8.069/1990); 16 Crimes previstos no Estatuto do Idoso (Lei nº 10.741/2003); 17 Crimes previstos no Código de Trânsito Brasileiro (Lei nº 9.503/1997); 18 Lei Maria da Penha - Violência doméstica e familiar contra a mulher (Lei nº 11.340/2006); 19 Crimes previstos na Lei nº 11.343/2006 (Lei de drogas); 20. Crimes contra as Relações de Consumo (Título II da Lei nº 8.078/1990); 21 Lei das Contravenções Penais (Decreto-Lei nº 3.688/1941); 22 Crimes previstos na Lei nº 9.605/1998 (crimes contra o meio ambiente); 23 Lei nº 13.869/2019 (abuso de autoridade). 24. Lei nº 14.344/2022 – Violência Doméstica e Familiar contra a Criança e o Adolescente. 25 Lei n.º 13.431/2017 (Estabelece o sistema de garantia de direitos da criança e do adolescente vítima ou testemunha de violência); 26 Disposições constitucionais aplicáveis ao Direito Penal.'),
  ('pc-go-papiloscopista', 'Direito Processual Penal', '1 Inquérito policial. 1.1 Histórico, natureza, conceito, finalidade, características, fundamento, titularidade, grau de cognição, valor probatório, formas de instauração, notitia criminis, delatio criminis, procedimentos investigativos, indiciamento, garantias do investigado. 1.2 Conclusão, prazos. 2 Prova. 2.1 Exame do corpo de delito, cadeia de custódia e perícias em geral. 2.2 Interrogatório do acusado. 2.3 Confissão. 2.4 Qualificação e oitiva do ofendido. 2.5 Testemunhas. 2.6 Reconhecimento de pessoas e coisas. 2.7 Acareação. 2.8 Documentos de prova. 2.9 Indícios. 2.10 Busca e apreensão. 3 Restrição de liberdade. 3.1 Prisão em flagrante. 3.2 Prisão preventiva. 3.3 Lei nº 7.960/1989 (prisão temporária). 3.4 Alterações da Lei nº 12.403/2011. 4 Disposições constitucionais aplicáveis ao Direito Processual Penal. 5 Juizados Especiais Criminais (Capítulo III da Lei nº 9.099 /1995).'),
  ('pc-go-papiloscopista', 'Criminalística', '1 Histórico e doutrina da Criminalística; 2. Postulados da criminalística; 3. Noções e princípios da Criminalística; 4. Tipos de Provas: prova confessional, prova testemunhal, prova documental e prova pericial; 5. Métodos da Criminalística; 6. Corpo de Delito: conceito; 7. Classificação dos locais de crime: 7.1. Quanto à natureza do fato; 7.2. Quanto à natureza da área: local de crime interno e local de crime externo; 7.3. Quanto à divisão: local mediato, imediato e relacionado; 7.4. Quanto à preservação: idôneo e inidôneo; 7.5. Isolamento de local. 8. Documentos criminalísticos: auto, laudo pericial, parecer criminalístico; 9. Finalidade da criminalística: constatação do fato, verificação dos meios e dos modos e possível indicação da autoria.'),
  ('pc-go-papiloscopista', 'Medicina Legal', '1. Noções de Tanatologia Forense: 1.1. cronotanatognose; 1.2. Morte suspeita; 1.3. Morte súbita; 1.4. Morte agonizante. 2. Noções de Asfixiologia Forense: 2.1. Por constrição cervical: enforcamento, estrangulamento, esganadura; 2.2. Por modificação do meio: afogamento, soterramento, confinamento; 2.3. Por sufocação: direta e indireta. 3. Noções de instrumentos de ação mecânica: 3.1. Ação cortante, perfurante, contundente e mista. 4. Noções de agentes químicos; 5. Noções de agentes térmicos; 6. Noções de sexologia forense. 7. Traumatologia forense. 7.1 Energia de ordem física. 7.2 Energia de ordem mecânica. 7.3 Lesões corporais: leve, grave e gravíssima e seguida de morte.'),
  ('pc-go-papiloscopista', 'Legislação Estadual — Goiás', '1. Lei estadual n.º 16.901/2010 (Lei Orgânica da Polícia Civil do Estado de Goiás). 2 Lei estadual n.º 20.756/2020 (regime jurídico dos servidores públicos civis do Estado de Goiás, das autarquias e fundações públicas estaduais). 3 Lei estadual n.º 13.800/2001 (processo administrativo no âmbito da Administração Pública do Estado de Goiás). 4 Lei estadual n.º 20.491/2019 (Organização administrativa do Poder Executivo). 5 Decreto estadual n.º 9.837/2021 (Código de Ética e Conduta Profissional do Servidor e da Alta Administração). 6 Lei estadual n.º 18.456/2014 (Prevenção e punição de assédio moral no âmbito da Administração). 7 Lei estadual n.º 18.672/2014 (Responsabilização administrativa e civil de pessoas jurídicas pela prática de atos contra a administração pública estadual).'),
  ('pc-go-papiloscopista', 'Técnicas de Identificação (Papiloscopia)', '1 Lei nº 12.037/2009 (identificação criminal do civilmente identificado). 2 Lei nº 9.454/1997 (número único de registro de identidade civil). 3 Lei nº 7.116/1983 (expedição e validade nacional das carteiras de identidade). 4 Características morfológicas de identificação: gênero, raça, idade, estatura, malformações, sinais profissionais, sinais individuais, tatuagens. 5 Identidade policial e judiciária. 5.1 Bertiolagem. 5.2 Retrato falado. 5.3 Fotografia sinalética. 6 Papiloscopia. 6.1 Impressões datiloscópicas. 6.2 Sistema datiloscópico de Vucetich.'),
  ('pc-go-papiloscopista', 'Arquivologia', '1 Arquivística: princípios e conceitos. 2 Gestão da informação e de documentos. 2.1 Protocolo: recebimento, registro, distribuição, tramitação e expedição de documentos. 2.2 Classificação de documentos de arquivo. 2.3 Arquivamento e ordenação de documentos de arquivo. 2.4 Tabela de temporalidade de documentos de arquivo. 3 Acondicionamento e armazenamento de documentos de arquivo. 4 Preservação e conservação de documentos de arquivo. 5 Tipologias documentais e suportes físicos: microfilmagem; automação; preservação, conservação e restauração de documentos.'),
  ('pc-go-papiloscopista', 'Química, Física e Biologia (Noções)', 'QUÍMICA: 1 Classificação dos materiais. 2 Teoria atômico-molecular. 3 Classificação periódica dos elementos químicos. 4 Radioatividade. 5 Interações químicas. 6 Misturas, soluções e propriedades coligativas. 7 Métodos de separação de misturas. 8 Funções químicas inorgânicas. 9 Gases. 10 Propriedades dos sólidos. 11 Estequiometria. 12 Termoquímica. 13 Cinética química. 14 Equilíbrio químico. 13 Eletroquímica. 14 Química orgânica: estrutura, nomenclatura e propriedades físicas e químicas de compostos orgânicos. FÍSICA: 1 Oscilações e ondas: movimento harmônico simples; energia no movimento harmônico simples; ondas em uma corda; energia transmitida pelas ondas; ondas estacionárias; equação de onda. 2 Eletricidade: carga elétrica; condutores e isolantes; campo elétrico; potencial elétrico; corrente elétrica; resistores; capacitores; circuitos elétricos. 3 Óptica: óptica geométrica; reflexão; refração; polarização; interferência. 4 Espectroscopias de absorção e de emissão molecular (fluorescência). BIOLOGIA: 1 Citologia. 1.1 Composição química da matéria viva. 1.2 Organização celular das células eucarióticas. 1.3 Estrutura e função dos componentes citoplasmáticos. 1.4 Membrana celular. 1.5 Núcleo. 1.5.1 Estrutura, componentes e funções. 1.5.2 Divisão celular (mitose e meiose, e suas fases). 1.6 Citoesqueleto e movimento celular. 2 Bioquímica. 2.1 Processos de obtenção de energia na célula. 2.2 Principais vias metabólicas. 2.3 Regulação metabólica. 2.4 Metabolismo e regulação da utilização de energia. 2.5 Proteínas e enzimas. 3 Embriologia. 3.1 Gametogênese. 3.2 Fecundação, segmentação e gastrulação. 3.3 Organogênese. 3.4 Anexos embrionários. 3.5 Desenvolvimento embrionário humano. 4 Genética. 4.1 Primeira lei de Mendel. 4.2 Probabilidade genética. 4.3 Árvore genealógica. 4.4 Genes letais. 4.5 Herança sem dominância. 4.6 Segunda lei de Mendel. 4.7 Alelos múltiplos: grupos sanguíneos dos sistemas ABO, Rh e MN. 4.8 Determinação do sexo. 4.9 Herança dos cromossomos sexuais. 4.10 Doenças genéticas.')
) as v(slug, materia, texto)
join public.editais_catalog e on e.slug = v.slug
join public.subjects_catalog s on s.name = v.materia
on conflict (edital_catalog_id, subject_catalog_id) do update
  set texto = excluded.texto, fonte_url = excluded.fonte_url, conferido_em = excluded.conferido_em;

-- ── 4. verificado_em ─────────────────────────────────────────────────────────
update public.editais_catalog set verificado_em = '2026-08-03' where slug = 'pc-go-papiloscopista';

-- ── Verificação dura ─────────────────────────────────────────────────────────
do $$
declare v int;
begin
  select count(*) into v from public.topics_catalog tc join public.subjects_catalog s on s.id=tc.subject_catalog_id
  where s.name = 'Química, Física e Biologia (Noções)';
  if v <> 13 then raise exception 'Química/Física/Biologia: esperado 13 tópicos, achei %', v; end if;

  select count(*) into v from public.topics_catalog tc join public.subjects_catalog s on s.id=tc.subject_catalog_id
  where s.name = 'Técnicas de Identificação (Papiloscopia)';
  if v <> 11 then raise exception 'Técnicas de Identificação: esperado 11 tópicos (8+3 novos), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'pc-go-papiloscopista'
  where ecs.topicos_curados;
  if v <> 13 then raise exception 'topicos_curados: esperado 13 matérias, achei %', v; end if;

  select count(*) into v from public.edital_programas p
  join public.editais_catalog e on e.id = p.edital_catalog_id and e.slug = 'pc-go-papiloscopista';
  if v <> 13 then raise exception 'edital_programas: esperado 13, achei %', v; end if;

  -- num_questions_expected continua completo (a barra de % não pode quebrar)
  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'pc-go-papiloscopista'
  where ecs.num_questions_expected is null;
  if v > 0 then raise exception 'num_questions_expected ficou nulo em algum lugar — barra de porcentagem quebraria'; end if;
end $$;
