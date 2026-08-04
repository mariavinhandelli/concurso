-- Ficha completa da PC-GO Agente + Escrivão (03/08) — primeiro cargo de uma
-- auditoria edital-a-edital pedida pela Maria: "não só as matérias, tudo
-- relacionado ao edital, pra não precisar voltar". Feito por cargo/edital
-- (Papiloscopista e Delegado ficam para as próximas rodadas — programas
-- diferentes, exigem a mesma leitura item a item).
--
-- Agente (Edital 006/2022) e Escrivão têm o MESMO "Conhecimentos Específicos"
-- no Anexo II (cabeçalho único "CARGOS: AGENTE... E ESCRIVÃO..."), mesmas 11
-- matérias, mesmos pesos/questões no catálogo — curados juntos porque são,
-- de fato, o mesmo programa oficial.
--
-- 1) CURADORIA DE TÓPICOS — cruzamento item a item do Anexo II retificado
--    (https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/26822AnexII-d6b.pdf)
--    contra o catálogo. Achados que valem registrar:
--    - Direito Administrativo aqui é MUITO mais estreito que a PM-GO: sem
--      licitações/contratos, serviços públicos, bens públicos, intervenção na
--      propriedade, agentes públicos, autarquias/EP/SEM, terceiro setor, LAI.
--      E quer a Lei ESTADUAL 13.800/2001 (processo administrativo de Goiás),
--      não a federal 9.784/99 — mesmo padrão já visto na PM-GO.
--    - Improbidade Administrativa (Lei 8.429/92) NÃO seria coberta pelo texto
--      de Direito Administrativo, mas a Legislação Penal Especial deste
--      edital lista "Lei nº 8.429/1992" no próprio item 18 — então o tópico
--      fica INCLUÍDO (o vínculo é por tópico, não por matéria; a AOCP só
--      organizou esse assunto em outro lugar).
--    - Direito Penal e Processual Penal são "noções" bem mais enxutas que a
--      PM-GO: sem Penas, Extinção da Punibilidade, Ação Penal, Procedimentos,
--      Nulidades e Recursos, Execução Penal — só aplicação da lei, fato
--      típico/ilicitude/culpabilidade, os crimes em espécie (Penal) e
--      inquérito/prova/prisão (Processual).
--    - Criminalística e Medicina Legal também mais enxutas que exigiriam
--      leitura própria (sem vestígios/balística/perícias especializadas na
--      primeira; sem antropologia/identificação e psicopatologia na segunda).
--    - Legislação Estadual: os 3 tópicos do catálogo (já usados por PC-GO
--      genericamente) batem com os itens 1-3 do edital; itens 4-7 (Lei
--      20.491/19, Decreto 9.837/21, Lei 18.456/14, Lei 18.672/14) não tinham
--      tópico — criados agora, mesmo princípio da cobertura da PM-GO.
--
-- 2) edital_programas — texto verbatim das 11 seções, mesma fonte.
--
-- 3) edital_url — corrigido para o PDF do edital de abertura RETIFICADO
--    (sétimo termo, 10/03/2023), em vez da página institucional. Feito para
--    os 4 cargos da PC-GO de uma vez (agente/escrivão/papiloscopista
--    compartilham o Edital 006; delegado é o 008) — é correção mecânica,
--    verificada (HTTP 200, assinatura %PDF), independente da curadoria de
--    tópicos, então segura mesmo para os 2 cargos ainda não curados. A Edge
--    Function mirror-edital-pdfs (cron semanal) espelha sozinha a partir daqui.
--
-- 4) edital_updates — a Homologação do Resultado Final (20/12/2023), a
--    mesma fonte da migration de fontes oficiais, verificada.
--
-- 5) past_papers/concurso_stats conferidos, SEM mudança: a prova de Agente
--    já aponta pro PDF direto do qconcursos (correção deliberada de
--    20260715170000, ainda HTTP 200 hoje); Escrivão está documentado como
--    "sem URL verificável, conteúdo idêntico ao de Agente" — não é lacuna,
--    é decisão já tomada. As linhas de concurso_stats com ano=2016 e tudo
--    NULL são histórico incompleto pré-existente, não deste edital — não
--    inventei números; fica registrado como pendência (ver memória).

-- ── 1a. Tópicos novos: 4 leis de Legislação Estadual — Goiás ────────────────
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.pos
from public.subjects_catalog s, (values
  ('Organização administrativa do Poder Executivo (Lei estadual 20.491/19)', 4),
  ('Código de Ética e Conduta do Servidor (Decreto estadual 9.837/21)', 5),
  ('Prevenção e punição de assédio moral (Lei estadual 18.456/14)', 6),
  ('Responsabilização de pessoas jurídicas (Lei estadual 18.672/14)', 7)
) as v(name, pos)
where s.name = 'Legislação Estadual — Goiás'
  and not exists (select 1 from public.topics_catalog t where t.subject_catalog_id = s.id and t.name = v.name);

-- ── 1b. Curadoria por (edital, matéria) ──────────────────────────────────────
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

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Língua Portuguesa', array[
  'Redação Oficial', 'Princípios e características (Manual da Presidência)',
  'Tipos de documentos (ofício, memorando...)', 'Pronomes de tratamento'
]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Raciocínio Lógico-Matemático', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Legislação Estadual — Goiás', array[]::text[]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Direito Administrativo', array[
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

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Direito Constitucional', array[
  'Controle de Constitucionalidade', 'Controle difuso', 'Controle concentrado (ADI, ADC, ADPF)',
  'Remédios constitucionais (HC, MS, MI, HD, ação popular)',
  'Sistema Tributário Nacional (na CF)',
  'Ordem Econômica e Financeira',
  'Tribunais de Contas (fiscalização)'
]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Direito Penal', array[
  'Penas', 'Espécies de penas', 'Aplicação e dosimetria da pena', 'Medidas de segurança',
  'Efeitos da condenação',
  'Extinção da Punibilidade', 'Causas de extinção', 'Prescrição, decadência e perempção',
  'Crimes contra a Paz e a Incolumidade Pública'
]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Direito Processual Penal', array[
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

-- Lavagem e Anticrime não constam; as leis "de PM-GO" (DL201, falimentares,
-- parcelamento do solo, imprensa, doc. de identificação, estatuto PM) também
-- não — nenhuma delas aparece no rol de 22 itens deste edital. Improbidade
-- (8.429, item 18) FICA — é o mesmo tópico de Direito Administrativo,
-- vinculado aqui porque o próprio edital o lista dentro desta matéria.
select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Legislação Penal Especial', array[
  'Lavagem de dinheiro (9.613/98)', 'Pacote Anticrime (Lei 13.964/19)',
  'Crimes de responsabilidade de prefeitos e vereadores (DL 201/67)',
  'Crimes falimentares (Lei 11.101/05)',
  'Crimes no parcelamento do solo urbano (Lei 6.766/79)',
  'Crimes de imprensa (Lei 5.250/67)',
  'Uso de documento de identificação (Lei 5.553/68)',
  'Estatuto dos Policiais Militares de GO (Lei 8.033/75)'
]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Criminalística', array[
  'Vestígios e Evidências', 'Vestígios biológicos (sangue, DNA)',
  'Impressões digitais e papiloscopia', 'Documentoscopia e grafotécnica',
  'Balística Forense',
  'Perícias Especializadas', 'Perícia em crimes contra a pessoa',
  'Perícia em crimes contra o patrimônio', 'Perícia de incêndios e explosões',
  'Áreas de Apoio'
]);

select public.curar_topicos_multi(array['pc-go-agente','pc-go-escrivao'], 'Medicina Legal', array[
  'Antropologia e Identificação', 'Identidade e identificação',
  'Datiloscopia e métodos de identificação',
  'Psicopatologia Forense'
]);

drop function public.curar_topicos_multi(text[], text, text[]);

-- ── 2. edital_programas (texto oficial verbatim) ────────────────────────────
insert into public.edital_programas (edital_catalog_id, subject_catalog_id, texto, fonte_url, conferido_em)
select e.id, s.id, v.texto,
  'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/26822AnexII-d6b.pdf', '2026-08-03'
from (values
  ('pc-go-agente', 'Língua Portuguesa', '1 Compreensão e interpretação de textos de gêneros variados. 2 Reconhecimento de tipos e gêneros textuais. 3 Domínio da ortografia oficial. 4 Domínio dos mecanismos de coesão textual. 4.1 Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual. 4.2 Emprego de tempos e modos verbais. 5 Domínio da estrutura morfossintática do período. 5.1 Emprego das classes de palavras. 5.2 Relações de coordenação entre orações e entre termos da oração. 5.3 Relações de subordinação entre orações e entre termos da oração. 5.4 Emprego dos sinais de pontuação. 5.5 Concordância verbal e nominal. 5.6 Regência verbal e nominal. 5.7 Emprego do sinal indicativo de crase. 5.8 Colocação dos pronomes átonos. 6 Reescrita de frases e parágrafos do texto. 6.1 Significação das palavras. 6.2 Substituição de palavras ou de trechos de texto. 6.3 Reorganização da estrutura de orações e de períodos do texto. 6.4 Reescrita de textos de diferentes gêneros e níveis de formalidade.'),
  ('pc-go-agente', 'Conhecimentos Regionais', '1 Formação econômica de Goiás: a mineração no século XVIII, a agropecuária nos séculos XIX e XX, a estrada de ferro e a modernização da economia goiana, as transformações econômicas com a construção de Goiânia e Brasília, industrialização, infraestrutura e planejamento. 2 Modernização da agricultura e urbanização do território goiano. 3 População goiana: povoamento, movimentos migratórios e densidade demográfica. 4 Economia goiana: industrialização e infraestrutura de transportes e comunicação. 5 As regiões goianas e as desigualdades regionais. 6 Aspectos físicos do território goiano: vegetação, hidrografia, clima e relevo. 6 Aspectos da história política de Goiás: a independência em Goiás, o coronelismo na República Velha, as oligarquias, a Revolução de 1930, a administração política de 1930 até os dias atuais. 7 Aspectos da História Social de Goiás: o povoamento branco, os grupos indígenas, a escravidão e cultura negra, os movimentos sociais no campo e a cultura popular. 8 Atualidades econômicas, políticas e sociais do Brasil, especialmente do Estado de Goiás.'),
  ('pc-go-agente', 'Raciocínio Lógico-Matemático', '1 Estruturas lógicas. 2 Lógica de argumentação: analogias, inferências, deduções e conclusões. 3 Lógica sentencial (ou proposicional). 3.1 Proposições simples e compostas. 3.2 Tabelas verdade. 3.3 Equivalências. 3.4 Leis de De Morgan. 3.5 Diagramas lógicos. 4 Lógica de primeira ordem. 5 Princípios de contagem e probabilidade. 6 Operações com conjuntos. 7 Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais.'),
  ('pc-go-agente', 'Direito Administrativo', '1 Estado, Governo e Administração Pública. 1.1 Conceitos, elementos, poderes e organização. 1.2 Natureza, fins e princípios. 2 Organização administrativa da União: administração direta e indireta. 3 Atos administrativos. 3.1 Conceitos, requisitos, elementos, pressupostos e classificação. 3.2 Fato e ato administrativo. 3.3 Atos administrativos em espécie. 3.4 O silêncio no direito administrativo. 3.5 Cassação. 3.6 Revogação e anulação. 3.7 Processo administrativo (Lei estadual n.º 13.800/2001). 3.8 Fatos da administração pública: atos da administração pública e fatos administrativos. 3.9 Formação do ato administrativo: elementos, procedimento administrativo. 3.10 Validade, eficácia e autoexecutoriedade do ato administrativo. 3.11 Atos administrativos simples, complexos e compostos. 3.12 Atos administrativos unilaterais, bilaterais e multilaterais. 3.13 Atos administrativos gerais e individuais. 3.14 Atos administrativos vinculados e discricionários. 3.15 Mérito do ato administrativo, discricionariedade. 3.16 Ato administrativo inexistente. 3.17 Teoria das nulidades no direito administrativo. 3.18 Atos administrativos nulos e anuláveis. 3.19 Vícios do ato administrativo. 3.20 Teoria dos motivos determinantes. 3.21 Revogação, anulação e convalidação do ato administrativo. 4 Poderes administrativos. 4.1 Poder hierárquico. 4.2 Poder disciplinar. 4.3 Poder regulamentar. 4.4 Poder de polícia. 4.5 Uso e abuso do poder. 5 Controle e responsabilização da administração. 5.1 Controle administrativo. 5.2 Controle judicial. 5.3 Controle legislativo. 5.4 Responsabilidade civil do Estado.'),
  ('pc-go-agente', 'Direito Constitucional', '1 Constituição da República Federativa do Brasil de 1988. 1.1 Princípios fundamentais. 2 Aplicabilidade das normas constitucionais. 2.1 Normas de eficácia plena, contida e limitada. 2.2 Normas programáticas. 3 Direitos e garantias fundamentais. 3.1 Direitos e deveres individuais e coletivos, direitos sociais, direitos de nacionalidade, direitos políticos, partidos políticos. 4 Organização político-administrativa do Estado. 4.1 Estado federal brasileiro, União, estados, Distrito Federal, municípios e territórios. 5 Administração pública. 5.1 Disposições gerais, servidores públicos. 6 Poder executivo. 6.1 Atribuições e responsabilidades do presidente da República. 7 Poder legislativo. 7.1 Estrutura. 7.2 Funcionamento e atribuições. 7.3 Processo legislativo. 8 Poder judiciário. 8.1 Disposições gerais. 8.2 Órgãos do poder judiciário. 9 Funções essenciais à Justiça. 10 Defesa do Estado e das instituições democráticas. 10.1 Segurança pública. 10.2 Organização da segurança pública. 11 Ordem social. 11.1 Base e objetivos da ordem social. 11.2 Seguridade social. 11.3 Meio ambiente. 11.4 Família, criança, adolescente, idoso e índio. 12 Direitos humanos na Constituição Federal. 12.1 Política Nacional de Direitos Humanos. 12.2 A Constituição brasileira e os tratados internacionais de direitos humanos.'),
  ('pc-go-agente', 'Direito Penal', '1 Aplicação da lei penal. 1.1 Princípios da legalidade e da anterioridade. 1.2 Lei penal no tempo e no espaço. 1.3 Tempo e lugar do crime. 1.4 Lei penal excepcional, especial e temporária. 1.5 Territorialidade e extraterritorialidade da lei penal. 1.6 Contagem de prazo. 1.7 Interpretação da lei penal. 1.8 Analogia. 1.9 Irretroatividade da lei penal. 2 Infração penal: elementos, espécies, sujeito ativo e sujeito passivo. 3 O fato típico e seus elementos. 3.1 Crime consumado e tentado. 3.2 Concurso de crimes. 3.3 Ilicitude e causas de exclusão. 3.4 Punibilidade. 3.5 Excesso punível. 3.6 Culpabilidade (elementos e causas de exclusão). 4 Imputabilidade penal. 5 Concurso de pessoas. 6 Crimes contra a pessoa. 7 Crimes contra o patrimônio. 8 Crimes contra a dignidade sexual. 9 Crimes contra a fé pública. 10 Crimes contra a administração pública. 11 Disposições constitucionais aplicáveis ao Direito Penal.'),
  ('pc-go-agente', 'Direito Processual Penal', '1 Inquérito policial. 1.1 Histórico, natureza, conceito, finalidade, características, fundamento, titularidade, grau de cognição, valor probatório, formas de instauração, notitia criminis, delatio criminis, procedimentos investigativos, indiciamento, garantias do investigado. 1.2 Conclusão, prazos. 2 Prova. 2.1 Exame do corpo de delito, cadeia de custódia e perícias em geral. 2.2 Interrogatório do acusado. 2.3 Confissão. 2.4 Qualificação e oitiva do ofendido. 2.5 Testemunhas. 2.6 Reconhecimento de pessoas e coisas. 2.7 Acareação. 2.8 Documentos de prova. 2.9 Indícios. 2.10 Busca e apreensão. 3 Restrição de liberdade. 3.1 Prisão em flagrante. 3.2 Prisão preventiva. 3.3 Lei nº 7.960/1989 (prisão temporária). 3.4 Alterações da Lei nº 12.403/2011. 4 Disposições constitucionais aplicáveis ao Direito Processual Penal.'),
  ('pc-go-agente', 'Legislação Penal Especial', '1. Crimes previstos no Estatuto do Desarmamento (Lei nº 10.826/2003); 2. Crimes hediondos (Lei nº 8.072/1990); 3. Crimes resultantes de preconceitos de raça ou de cor (Lei nº 7.716/1989); 4. Definição dos crimes de tortura (Lei nº 9.455/1997); 5. Crimes previstos no Estatuto da Criança e do Adolescente (Lei nº 8.069/1990); 6. Crimes previstos no Estatuto do Idoso (Lei nº 10.741/2003); 7. Organizações Criminosas (Lei nº 12.850/2013); 8. Interceptações telefônicas (Lei nº 9.296/1996); 9. Crimes previstos no Código de Trânsito Brasileiro (Lei nº 9.503/1997); 10. Lei de execução penal (Lei nº 7.210/1984); 11. Juizados Especiais Cíveis e Criminais (Lei nº 9.099/1995); 12. Crimes contra a Ordem Tributária, Econômica e outras relações de consumo (Lei nº 8.137/1990); 13. Lei Maria da Penha - Violência doméstica e familiar contra a mulher (Lei nº 11.340/2006); 14. Crimes previstos na (Lei nº 11.343/2006); 15. Crimes contra as Relações de Consumo (Título II da Lei nº 8.078/1990); 16. Lei das Contravenções Penais (Decreto-Lei nº 3.688/1941); 17. Crimes previstos na (Lei nº 9.605/1998); 18. Lei nº 8.429/1992 (improbidade administrativa); 19. Lei nº 12.037/2009 (identificação criminal); 20. Lei nº 13.869/2019 (abuso de autoridade); 21. Lei n.º 13.431/2017 (Estabelece o sistema de garantia de direitos da criança e do adolescente vítima ou testemunha de violência); 22. Lei nº 14.344/2022 – Violência Doméstica e Familiar contra a Criança e ao Adolescente.'),
  ('pc-go-agente', 'Criminalística', '1 Histórico e doutrina da Criminalística; 2. Postulados da criminalística; 3. Noções e princípios da Criminalística; 4. Tipos de Provas: prova confessional, prova testemunhal, prova documental e prova pericial; 5. Métodos da Criminalística; 6. Corpo de Delito: conceito; 7. Classificação dos locais de crime: 7.1. Quanto à natureza do fato; 7.2. Quanto à natureza da área: local de crime interno e local de crime externo; 7.3. Quanto à divisão: local mediato, imediato e relacionado; 7.4. Quanto à preservação: idôneo e inidôneo; 7.5. Isolamento de local. 8. Documentos criminalísticos: auto, laudo pericial, parecer criminalístico; 9. Finalidade da criminalística: constatação do fato, verificação dos meios e dos modos e possível indicação da autoria.'),
  ('pc-go-agente', 'Medicina Legal', '1. Noções de Tanatologia Forense: 1.1. cronotanatognose; 1.2. Morte suspeita; 1.3. Morte súbita; 1.4. Morte agonizante. 2. Noções de Asfixiologia Forense: 2.1. Por constrição cervical: enforcamento, estrangulamento, esganadura; 2.2. Por modificação do meio: afogamento, soterramento, confinamento; 2.3. Por sufocação: direta e indireta. 3. Noções de instrumentos de ação mecânica: 3.1. Ação cortante, perfurante, contundente e mista. 4. Noções de agentes químicos; 5. Noções de agentes térmicos; 6. Noções de sexologia forense. 7. Traumatologia forense. 7.1 Energia de ordem física. 7.2 Energia de ordem mecânica. 7.3 Lesões corporais: leve, grave e gravíssima e seguida de morte.'),
  ('pc-go-agente', 'Legislação Estadual — Goiás', '1. Lei estadual n.º 16.901/2010 (Lei Orgânica da Polícia Civil do Estado de Goiás). 2 Lei estadual n.º 20.756/2020 (regime jurídico dos servidores públicos civis do Estado de Goiás, das autarquias e fundações públicas estaduais). 3 Lei estadual n.º 13.800/2001 (processo administrativo no âmbito da Administração Pública do Estado de Goiás). 4 Lei estadual n.º 20.491/2019 (Organização administrativa do Poder Executivo). 5 Decreto estadual n.º 9.837/2021 (Código de Ética e Conduta Profissional do Servidor e da Alta Administração). 6 Lei estadual n.º 18.456/2014 (Prevenção e punição de assédio moral no âmbito da Administração). 7 Lei estadual n.º 18.672/2014 (Responsabilização administrativa e civil de pessoas jurídicas pela prática de atos contra a administração pública estadual).')
) as v(slug, materia, texto)
join public.editais_catalog e on e.slug = v.slug
join public.subjects_catalog s on s.name = v.materia
on conflict (edital_catalog_id, subject_catalog_id) do update
  set texto = excluded.texto, fonte_url = excluded.fonte_url, conferido_em = excluded.conferido_em;

-- Escrivão: mesmo texto (mesmo cabeçalho de cargo no Anexo II), mesma fonte.
insert into public.edital_programas (edital_catalog_id, subject_catalog_id, texto, fonte_url, conferido_em)
select e2.id, p.subject_catalog_id, p.texto, p.fonte_url, p.conferido_em
from public.edital_programas p
join public.editais_catalog e1 on e1.id = p.edital_catalog_id and e1.slug = 'pc-go-agente'
join public.editais_catalog e2 on e2.slug = 'pc-go-escrivao'
on conflict (edital_catalog_id, subject_catalog_id) do update
  set texto = excluded.texto, fonte_url = excluded.fonte_url, conferido_em = excluded.conferido_em;

-- ── 3. edital_url → PDF direto do edital de abertura retificado ────────────
-- Sétimo termo de retificação, 10/03/2023, HTTP 200 e assinatura %PDF
-- verificados em 03/08/2026. Mecânico: os 4 cargos da PC-GO de uma vez.
update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/100323-Ed00622-Retificado-932.pdf'
where slug in ('pc-go-agente', 'pc-go-escrivao', 'pc-go-papiloscopista');

update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/100323-Ed00822-Retificado-336.pdf'
where slug = 'pc-go-delegado';

-- ── 4. Linha do tempo: homologação do resultado final ───────────────────────
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select e.id, 'resultado', 'Homologação do Edital de Resultado Final e Classificação (vagas e cadastro de reserva)',
  'https://goias.gov.br/escoladegoverno/wp-content/uploads/sites/28/2023/12/20-12Homolog-vagasecadastrodereserva.pdf',
  '2023-12-20'
from public.editais_catalog e
where e.slug in ('pc-go-agente', 'pc-go-escrivao', 'pc-go-papiloscopista')
  and not exists (
    select 1 from public.edital_updates u
    where u.edital_catalog_id = e.id and u.tipo = 'resultado' and u.published_at = '2023-12-20'
  );

-- ── 5. verificado_em ─────────────────────────────────────────────────────────
update public.editais_catalog set verificado_em = '2026-08-03'
where slug in ('pc-go-agente', 'pc-go-escrivao');

-- ── Verificação dura ─────────────────────────────────────────────────────────
do $$
declare v int;
begin
  -- Os 4 novos tópicos de Legislação Estadual existem
  select count(*) into v from public.topics_catalog tc
  join public.subjects_catalog s on s.id = tc.subject_catalog_id
  where s.name = 'Legislação Estadual — Goiás';
  if v <> 7 then raise exception 'Legislação Estadual — Goiás: esperado 7 tópicos, achei %', v; end if;

  -- Ambas as matérias marcadas como curadas nos 2 cargos (11 matérias × 2 = 22)
  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id
  where e.slug in ('pc-go-agente', 'pc-go-escrivao') and ecs.topicos_curados;
  if v <> 22 then raise exception 'topicos_curados: esperado 22 (11 matérias × 2 cargos), achei %', v; end if;

  -- 11 programas por edital = 22
  select count(*) into v from public.edital_programas p
  join public.editais_catalog e on e.id = p.edital_catalog_id
  where e.slug in ('pc-go-agente', 'pc-go-escrivao');
  if v <> 22 then raise exception 'edital_programas: esperado 22, achei %', v; end if;

  -- Improbidade Administrativa continua vinculada (decisão deliberada)
  select count(*) into v
  from public.edital_catalog_topics ect
  join public.editais_catalog e on e.id = ect.edital_catalog_id and e.slug = 'pc-go-agente'
  join public.topics_catalog tc on tc.id = ect.topic_catalog_id
  where tc.name = 'Improbidade Administrativa (Lei 8.429/92)';
  if v <> 1 then raise exception 'Improbidade deveria seguir vinculada ao pc-go-agente'; end if;

  -- URLs das 4 PC-GO apontam pra PDF (não mais pra página institucional)
  select count(*) into v from public.editais_catalog
  where slug in ('pc-go-agente','pc-go-escrivao','pc-go-papiloscopista','pc-go-delegado')
    and edital_url not like '%.pdf';
  if v > 0 then raise exception 'edital_url ainda não é PDF direto em % editais', v; end if;
end $$;
