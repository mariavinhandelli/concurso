-- Ficha completa da PC-GO Delegado (03/08) — 4º e último cargo da PC-GO,
-- Edital 008/2022 (edital PRÓPRIO, diferente do 006 dos outros 3 cargos).
-- Cargo por cargo, mesmo processo dos anteriores.
--
-- Este é o programa mais ABRANGENTE dos 4 cargos da PC-GO — ao contrário de
-- Agente/Escrivão/Papiloscopista ("noções"), o Delegado cobre a matéria
-- quase inteira em quase todas as disciplinas jurídicas. Achados:
--   - Direito Penal, Direito Processual Penal, Direito Constitucional,
--     Medicina Legal, Direito Empresarial, Direito Tributário, Conhecimentos
--     Regionais: SEM exclusões — cobertura completa do catálogo (inclui
--     Penas, Extinção da Punibilidade, Crimes contra a Paz/Incolumidade,
--     Controle de Constitucionalidade, Remédios, Sistema Tributário, Ordem
--     Econômica — tudo o que ficou de fora nos outros 3 cargos).
--   - Legislação Penal Especial: só 2 exclusões (parcelamento do solo,
--     Estatuto PM-GO) — o resto das 33 leis do catálogo está no rol de 45
--     itens do edital.
--   - Direito Administrativo: 3 exclusões (terceiro setor, LAI, e o
--     "Processo Administrativo (Lei 9.784/99)" trocado pela Lei ESTADUAL
--     13.800/2001 — mesmo padrão visto em todos os cargos da PC-GO e na
--     PM-GO).
--   - Direito Civil: aqui SIM há exclusões grandes — o edital não menciona
--     Obrigações, Contratos (só cita "responsabilidade civil" solto) nem
--     Família/Sucessões. 14 de 31 tópicos saem.
--   - Direito Eleitoral: sem menção a propaganda eleitoral, financiamento de
--     campanha, ações eleitorais (AIJE/AIME/RCED) nem crimes eleitorais.
--   - Direito Ambiental: sem recursos hídricos/saneamento nem tutela
--     processual (ação civil pública).
--   - Direitos Humanos: sem grupos vulneráveis/políticas afirmativas.
--   - Criminologia: só exclui "Temas Contemporâneos" (bucket genérico sem
--     conteúdo específico no edital).
--
-- "Criminologia e Medicina Legal" e "Direito Civil e Empresarial" são UM
-- título só no Anexo II, mas o catálogo já os trata como matérias
-- separadas (assim como os outros cargos da PC-GO) — a curadoria e os
-- textos de programa oficial respeitam essa divisão.
--
-- edital_url já corrigida em 20260803230000 (PDF retificado do 008/2022).
-- past_paper (2022, qconcursos direto) e concurso_stats (1 linha completa)
-- conferidos, HTTP 200, nada a corrigir.

-- ── 1. Curadoria ─────────────────────────────────────────────────────────────
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

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Penal', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Processual Penal', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Constitucional', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Medicina Legal', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Empresarial', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Tributário', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Conhecimentos Regionais', array[]::text[]);
select public.curar_topicos_multi(array['pc-go-delegado'], 'Legislação Estadual — Goiás', array[]::text[]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Legislação Penal Especial', array[
  'Crimes no parcelamento do solo urbano (Lei 6.766/79)',
  'Estatuto dos Policiais Militares de GO (Lei 8.033/75)'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Administrativo', array[
  'Terceiro setor (OS, OSCIP, entidades de apoio)',
  'Lei de Acesso à Informação e Transparência',
  'Processo Administrativo (Lei 9.784/99)'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Criminologia', array[
  'Temas Contemporâneos'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Civil', array[
  'Teoria geral dos contratos', 'Espécies de contratos (compra e venda, locação...)',
  'Família', 'Casamento e união estável', 'Relações de parentesco',
  'Alimentos, bens e regime patrimonial',
  'Sucessões', 'Sucessão legítima e testamentária', 'Inventário e partilha',
  'Obrigações', 'Modalidades das obrigações', 'Transmissão e adimplemento',
  'Inadimplemento e suas consequências', 'Teoria geral'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Eleitoral', array[
  'Propaganda eleitoral',
  'Financiamento de campanha e prestação de contas',
  'Ações eleitorais: AIJE, AIME e RCED',
  'Crimes eleitorais'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direito Ambiental', array[
  'Recursos hídricos e saneamento',
  'Tutela processual do meio ambiente (ação civil pública)'
]);

select public.curar_topicos_multi(array['pc-go-delegado'], 'Direitos Humanos', array[
  'Grupos vulneráveis e políticas afirmativas'
]);

drop function public.curar_topicos_multi(text[], text, text[]);

-- ── 2. edital_programas (texto oficial verbatim, só a prova objetiva) ──────
insert into public.edital_programas (edital_catalog_id, subject_catalog_id, texto, fonte_url, conferido_em)
select e.id, s.id, v.texto,
  'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/08/26822AnexII-1d0.pdf', '2026-08-03'
from (values
  ('pc-go-delegado', 'Direito Penal', '1 Introdução ao direito penal. 1.1 Conceito, caracteres e função do direito penal. 1.2 Princípios básicos do direito penal. 1.3 Relações com outros ramos do direito. 1.4 Direito penal e política criminal. 2 A lei penal. 2.1 Características, fontes, interpretação, vigência e aplicação. 2.2 Lei penal no tempo e no espaço. 2.3 Imunidade. 2.4 Condições de punibilidade. 2.5 Concurso aparente de normas. 3 Teoria geral do crime. 3.1 Conceito, objeto, sujeitos, conduta, tipicidade, culpabilidade. 3.2 Bem jurídico. 3.3 Tempo e lugar do crime. 3.4 Punibilidade. 3.5 Concurso de crimes e crime continuado. 4 Teoria do tipo. 4.1 Crime doloso e crime culposo. 4.2 Crime qualificado pelo resultado e crime preterdoloso. 4.3 Erro de tipo. 4.4 Classificação jurídica dos crimes. 4.5 Crimes comissivos e omissivos. 4.6 Crimes de dano e de perigo. 4.7 Punibilidade: causas de extinção da punibilidade. 4.8 Iter criminis. 4.9 Consumação e tentativa. 4.10 Desistência voluntária e arrependimento eficaz. 4.11 Arrependimento posterior. 4.12 Crime impossível. 5 Ilicitude. 5.1 Causas de exclusão da ilicitude: estado de necessidade, legítima defesa, estrito cumprimento do dever legal e exercício regular de direito. 6 Teoria geral da culpabilidade. 6.1 Fundamentos, conceito, elementos e conteúdo. 6.2 Princípio de culpabilidade. 6.3 Culpabilidade e pena. 6.4 Causas de exclusão da culpabilidade. 6.5 Imputabilidade. 6.6 Erro de proibição. 7 Concurso de agentes: autoria e participação; conduta delituosa; resultado; relação de causalidade; imputação. 8 Teoria geral da pena. 8.1 Cominação das penas. 8.2 Penas privativas de liberdade. 8.3 Penas restritivas de direitos. 8.4 Regimes de pena. 8.5 Pena pecuniária. 8.6 Medidas de segurança. 8.7 Aplicação da pena. 8.8 Elementares e circunstâncias. 8.9 Causas de aumento e de diminuição das penas. 8.10 Fins da pena. 8.11 Livramento condicional e suspensão condicional da pena. 8.12 Efeitos da condenação. 8.13 Execução penal. 9 Extinção da punibilidade. 9.1 Conceito, causas gerais e específicas, momentos de ocorrência. 9.2 Prescrição: conceito, teorias, prazos para o cálculo da prescrição, termos iniciais, causas suspensivas ou impeditivas, causas interruptivas. 10 Crimes. 10.1 Crimes contra a pessoa. 10.2 Crimes contra o patrimônio. 10.3 Crimes contra a propriedade imaterial. 10.4 Crimes contra a propriedade intelectual. 10.5 Crimes contra a organização do trabalho. 10.6 Crimes contra o sentimento religioso e contra o respeito aos mortos. 10.7 Crimes contra a dignidade sexual. 10.8 Crimes contra a família. 10.9 Crimes contra a incolumidade pública. 10.10 Crimes contra a paz pública. 10.11 Crimes contra a fé pública. 10.12 Crimes contra a administração pública. 10.13 Crimes contra as finanças públicas. 10.14 Crimes contra o Estado democrático de direito. 11 Disposições constitucionais aplicáveis ao direito penal. 12 Entendimento dos tribunais superiores acerca dos institutos de direito penal.'),
  ('pc-go-delegado', 'Direito Processual Penal', '1 Direito processual penal. 1.1 Princípios gerais, conceito, finalidade, características. 1.2 Fontes. 1.3 Lei processual penal: fontes, eficácia, interpretação, analogia, imunidades. 1.4 Sistemas de processo penal. 2 Inquérito policial. 2.1 Histórico; natureza; conceito; finalidade; características; fundamentos; titularidade; grau de cognição; valor probatório; formas de instauração; notitia criminis; delatio criminis; procedimentos investigativos; indiciamento; garantias do investigado; conclusão; prazos. 3 Processo criminal: finalidade, pressupostos e sistemas. 4 Ação penal. 4.1 Conceito, características, espécies e condições. 4.2 Sujeitos do processo: juiz, Ministério Público, acusado e seu defensor, assistente, curador do réu menor, auxiliares da justiça, assistentes, peritos e intérpretes, serventuários da justiça, impedimentos e suspeições. 4.3 Citação, intimação, interdição de direito. 5 Competência. 5.1 Critérios de determinação e modificação. 5.2 Incompetência. 5.3 Conexão e continência. 5.4 Questões e processos incidentes. 6 Juizados especiais criminais. 7 Termo circunstanciado de ocorrência; atos processuais; forma, lugar e tempo. 8 Provas. 8.1 Conceito, objeto, classificação e sistemas de avaliação. 8.2 Princípios gerais da prova, procedimento probatório. 8.3 Valoração. 8.4 Ônus da prova. 8.5 Provas ilícitas. 8.6 Meios de prova: perícias, interrogatório, confissão, testemunhas, reconhecimento de pessoas e coisas, acareação, documentos, indícios. 8.7 Busca e apreensão: pessoal, domiciliar, requisitos, restrições, horários. 8.8 Exame de corpo de delito, da cadeia de custódia e das perícias em geral. 9 Prisão. 9.1 Conceito, espécies, mandado de prisão e cumprimento. 9.2 Prisão em flagrante. 9.3 Prisão temporária. 9.4 Prisão preventiva. 9.5 Princípio da necessidade, prisão especial, liberdade provisória. 9.6 Fiança. 9.7 Medidas cautelares diversas da prisão. 10 Sentença: coisa julgada, habeas corpus, mandado de segurança em matéria criminal. 11. Processos dos crimes de responsabilidade dos funcionários públicos. 12. Processo criminal de crimes comuns.'),
  ('pc-go-delegado', 'Legislação Penal Especial', '1. Decreto-Lei n. 3.688/1941 - Lei das Contravenções Penais. 2. Lei n. 1.521/1951 - Lei dos Crimes contra a Economia Popular. 3. Lei n. 2.889/1956 - Lei do Crime de Genocídio. 4. Lei n. 5.250/1967 – Regula a liberdade de manifestação do pensamento e de informação. 5. Decreto-lei n. 201/1967 – Crimes de responsabilidade. 6. Lei n. 5.553/1968 (contravenção penal de retenção de documento de identificação). 7. Lei n. 7.210/1984 – Lei de Execução Penal. 8. Lei nº 7.492/1986 - Lei dos Crimes contra o Sistema Financeiro Nacional. 9. Lei n. 7.716/1989 - Lei dos Crimes resultantes de Preconceito de Raça ou de Cor. 10. Lei n. 7.960/1989 – Lei de Prisão Temporária. 11. Lei n. 8.069/1990 - Da prática de ato infracional. 12. Da apuração de ato infracional atribuído a adolescente. 13. Da infiltração de agentes de polícia para a investigação de crimes contra a dignidade sexual de criança e de adolescente. 14. Dos Crimes contra a criança e ao adolescente. 15. Lei n. 8.072/1990 - Lei dos Crimes Hediondos. 16. Lei n. 8.078/1990 - Crimes contra o Consumidor. 17. Lei n. 8.137/1990 - Lei dos Crimes contra a Ordem Tributária, Econômica e contra as Relações de Consumo. 18. Lei n. 8.176/1991 – Lei dos crimes contra a ordem econômica. 19. Lei n. 8.666/1993 - Crimes tipificados na Lei das Licitações. 20. Lei n. 9.099/1995 - Lei dos Juizados Especiais Criminais. 21. Lei n. 9.296/1996 - Lei da Interceptação de Comunicações Telefônicas. 22. Lei n. 9.434/1997 - Crimes tipificados na Lei de Transplantes. 23. Lei n. 9.455/1997 - Lei de Tortura. 24. Lei n. 9.503/1997 - Crimes de Trânsito. 25. Lei n. 9.605/1998 - Lei dos Crimes Ambientais. 26. Lei n. 9.613/1998 - Lei da Lavagem de Dinheiro. 27. Lei n. 9.069/1998 – Infrações Penais contra a propriedade intelectual. 28. Lei n. 9.807/1999 – Proteção a vítimas e testemunhas. 29. Lei n. 10.671/2003 - Crimes tipificados no Estatuto de Defesa do Torcedor. 30. Lei n. 10.741/2003 - Crimes tipificados no Estatuto do Idoso. 31. Lei n. 10.826/2003 - Estatuto do Desarmamento. 32. Lei n. 11.101/2005 - Disposições penais da Lei de Falências. 33. Lei n. 11.340/2006 - Lei Maria da Penha. 34. Lei n. 11.343/2006 - Lei de Drogas. 35. Lei n. 12.830/2013 – Lei de Investigação Criminal. 36. Lei n. 12.850/2013 - Lei das Organizações Criminosas. 37. Lei n. 12.965/2014 (Marco civil da Internet). 38. Lei n. 13.146/2015 - Crimes tipificados no Estatuto da Pessoa com Deficiência. 39. Lei n. 13.260/2016 - Lei do Terrorismo. 40. Lei nº 12.037/2009 – Identificação Criminal do civilmente identificado. 41. Lei nº 13.431/2017 (Estabelece o sistema de garantia de direitos da criança e do adolescente vítima ou testemunha de violência). 42. Lei n. 13.709/2018 – Lei Geral de Proteção de Dados Pessoas. 43. Lei n. 13.869/2019 - Lei do Abuso de Autoridade. 44. Lei nº 13.964/2019 (Aperfeiçoa a Legislação Penal e Processual Penal). 45. Lei n. 14.344/2022 – Violência doméstica e familiar contra a criança e ao adolescente.'),
  ('pc-go-delegado', 'Direito Administrativo', '1 Conceito e fontes do direito administrativo. 1.1 Regime jurídico-administrativo: princípios do direito administrativo. 1.2 Princípios da Administração Pública. 2 Administração Pública: organização, descentralização, desconcentração, órgãos públicos. 3 Administração indireta e entidades paralelas. 4 Atos administrativos. 4.1 Conceitos, requisitos, elementos, pressupostos e classificação. 4.2 Fato e ato administrativo. 4.3 Atos administrativos em espécie. 4.4 O silêncio no direito administrativo. 4.5 Cassação. 4.6 Revogação e anulação. 4.7 Processo administrativo. 4.8 Fatos da administração pública: atos da administração pública e fatos administrativos. 4.9 Formação do ato administrativo: elementos, procedimento administrativo. 4.10 Validade, eficácia e autoexecutoriedade do ato administrativo. 4.11 Atos administrativos simples, complexos e compostos. 4.12 Atos administrativos unilaterais, bilaterais e multilaterais. 4.13 Atos administrativos gerais e individuais. 4.14 Atos administrativos vinculados e discricionários. 4.15 Mérito do ato administrativo, discricionariedade. 4.16 Ato administrativo inexistente. 4.17 Teoria das nulidades no direito administrativo. 4.18 Atos administrativos nulos e anuláveis. 4.19 Vícios do ato administrativo. 4.20 Teoria dos motivos determinantes. 4.21 Revogação, anulação e convalidação do ato administrativo. 5 Poderes da administração pública. 5.1 Hierarquia: poder hierárquico e suas manifestações. 5.2 Poder disciplinar. 5.3 Poder de polícia. 5.4 Liberdades públicas e poder de polícia. 6 Serviços públicos: regulação, concessão, permissão e autorização do serviço público. 7 Intervenção do Estado sobre a propriedade privada. 7.1 Intervenção do Estado no domínio econômico. 8 Bens públicos. 8.1 Regime jurídico. 8.2 Aquisição e alienação dos bens públicos. 8.3 Formas de utilização dos bens públicos pelos particulares. 9 Licitações: modalidades e procedimentos. 10 Contratos administrativos. 11 Convênios e consórcios administrativos. 12 Controle e responsabilização da administração: controle administrativo, controle judicial, controle legislativo. 13 Agentes públicos: espécies e classificação. 13.1 Cargo, emprego e função públicos. 13.2 Formas de provimento e vacância dos cargos públicos. 13.3 Responsabilidade civil, penal e administrativa. 14 Sistemas administrativos: sistema inglês, sistema francês e sistema adotado no Brasil. 15 Administração pública. 15.1 Administração Pública em sentido amplo e em sentido estrito. 15.2 Administração Pública em sentido objetivo e em sentido subjetivo. 16 Regime jurídico-administrativo. 16.1 Conceito. 16.2 Conteúdo: supremacia do interesse público sobre o privado e indisponibilidade, pela Administração, dos interesses púbicos. 16.3 Princípios expressos e implícitos da administração pública. 16.4 Jurisprudência aplicada dos tribunais superiores. 17 Agências reguladoras. 18 Processo administrativo. 18.1 Lei estadual nº 13.800/2001. 19 Poderes e deveres da administração pública. 19.1 Poder regulamentar. 19.2 Dever de agir. 19.3 Dever de eficiência. 19.4 Dever de probidade. 19.5 Dever de prestação de contas. 19.6 Uso e abuso do poder. 19.7 Jurisprudência aplicada dos tribunais superiores. 20 Lei nº 8.987/1995 (regime de concessão e permissão da prestação de serviços públicos). 21 Lei nº 11.079/2004 (parceria público-privada). 21.1 Disposições doutrinárias. 21.2 Conceito. 21.3 Delegação: concessão, permissão e autorização. 22 Lei nº 10.520/2002 e demais disposições normativas relativas ao pregão. 23 Contratação direta: dispensa e inexigibilidade. 24 Modalidades. 25 Tipos. 26 Procedimento. 27 Anulação e revogação. 28 Improbidade administrativa. 29 Processo Administrativo Disciplinar da Lei estadual n. 20.756/2020.'),
  ('pc-go-delegado', 'Direito Constitucional', '1 Direito constitucional. 1.1 Noções gerais, ciclos constitucionais. 2 Classificações das constituições. 3 Poder constituinte. 3.1 Fundamentos do poder constituinte. 3.2 Poder constituinte originário e derivado. 3.3 Reforma e revisão constitucionais. 3.4 Limitação do poder de revisão. 3.5 Emendas à Constituição. 3.6 Poder constituinte e revolução. 4 Controle de constitucionalidade. 4.1 Conceito e sistemas de controle de constitucionalidade. 4.2 Inconstitucionalidade: por ação e por omissão. 4.3 Sistema brasileiro de controle de constitucionalidade. 4.4 Arguição de descumprimento de preceitos fundamentais. 4.5 O fenômeno Jurídico da desconstitucionalização. 5 Interpretação constitucional. 6 Direitos e deveres fundamentais. 6.1 Direitos e deveres individuais e coletivos. 6.2 Direito à vida, à liberdade, à igualdade, à segurança e à propriedade. 6.3 Direitos sociais, nacionalidade, cidadania e direitos políticos. 6.4 Partidos políticos. 6.5 Garantias constitucionais individuais. 6.6 Garantias dos direitos coletivos, sociais e políticos. 6.7 Remédios do direito constitucional. 6.8 Direitos Sociais e sua efetivação. 6.9 Tratados Internacionais de Direitos Humanos e sua posição no ordenamento jurídico brasileiro. 7 Poder legislativo: fundamento, atribuições e garantias de independência. 8 Processo legislativo: fundamento e garantias de independência, conceito, objetos, atos e procedimentos. 9 Poder executivo. 9.1 Forma e sistema de governo. 9.2 Chefia de Estado e chefia de governo. 9.3 Atribuições e responsabilidades do presidente da República. 10 Poder judiciário. 11 Funções essenciais à Justiça. 12 Defesa do Estado e das instituições democráticas. 12.1 Segurança Pública. 12.2 Organização da segurança pública. 13 Atribuições constitucionais da Polícia Judiciária. 14 Ordem social. 15 Tratados e Convenções. 15.1 Convenção de Mérida. 15.2 Convenção de Palermo. 15.3 Convenção de Viena. 15.4 Pacto de São José da Costa Rica. 15.5 Tratado de Roma. 16 Conceito, objeto, elementos e classificações da Constituição. História das Constituições. Supremacia da Constituição. Aplicabilidade das normas constitucionais. Neoconstitucionalismo. Poder constituinte decorrente. 17 Organização do Estado. 17.1 Organização político-administrativa. 17.2 Estado federal brasileiro. 17.3 A União. 17.4 Estados federados. 17.5 Municípios. 17.6 O Distrito Federal. 17.7 Territórios. 18 Administração pública. 18.1 Disposições gerais. 18.2 Servidores públicos. 19 Organização dos poderes no Estado. 19.1 Mecanismos de freios e contrapesos. 20 Comissões parlamentares de inquérito. 21 Organização e competências. 22 Conselho Nacional de Justiça (CNJ). 23 Funções essenciais à justiça. 23.1 Ministério Público. Princípios, garantias, vedações, organização e competências. Conselho Nacional do Ministério Público (CNMP). 24 Sistema Tributário Nacional. Princípios gerais. 24.1 Limitações do poder de tributar. 24.2 Impostos da União, dos Estados e dos municípios. 24.3 Repartição das receitas tributárias. 25 Finanças públicas. 25.1 Normas gerais. 26 Ordem econômica e financeira. 26.1 Princípios gerais da atividade econômica. 26.2 Política urbana, agrícola e fundiária e reforma agrária. 27 Sistema Financeiro Nacional.'),
  ('pc-go-delegado', 'Criminologia', '1 Criminologia. 1.1 Conceito. 1.2 Métodos: empirismo e interdisciplinaridade. 1.3 Objetos da criminologia: delito, delinquente, vítima, controle social. 2 Funções da criminologia. 2.1 Criminologia e política criminal. 2.2 Direito penal. 3 Modelos teóricos da criminologia. 3.1 Teorias sociológicas. 3.2 Prevenção da infração penal no Estado democrático de direito. 3.3 Prevenção primária. 3.4 Prevenção secundária. 3.5 Prevenção terciária. 3.6 Modelos de reação ao crime.'),
  ('pc-go-delegado', 'Medicina Legal', '1 Conceitos importâncias e divisões da Medicina Legal. 2 Corpo de Delito, perícia e peritos em Medicina Legal. 3 Documentos Médico-Legais. 3.1 Conceitos de identidade, de identificação e de reconhecimento. 4 Principais métodos de identificação. 5 Lesões e mortes por ação contundente, por armas brancas e por projéteis de arma de fogo comuns e de alta energia. 6 Conceito e diagnóstico da morte. 6.1 Fenômenos cadavéricos. 6.2 Cronotanatognose, comoriência e promoriência. 6.3 Exumação. 6.4 Causa jurídica da morte. 6.5 Morte súbita e morte suspeita. 7 Exame de locais de crime. 7.1 Aspectos médico-legais das toxicomanias e da embriaguez. 7.2 Lesões e morte por ação térmica, por ação elétrica, por baropatias e por ação química. 8 Aspectos médico-legais dos crimes contra a liberdade sexual. 9 Asfixias por constrição cervical, por sufocação, por restrição aos movimentos do tórax e por modificações do meio ambiente. 10 Aspectos médico-legais do aborto, infanticídio e abandono de recém-nascido. 11 Modificadores e avaliação pericial da imputabilidade penal e da capacidade civil. 11.1 Doença mental, desenvolvimento mental incompleto ou retardado, perturbação mental. 12 Aspectos médico legais do testemunho, da confissão e da acareação. 13 Aspectos médico-legais das lesões corporais e dos maus-tratos a menores e idosos.'),
  ('pc-go-delegado', 'Direito Civil', '1 Lei de Introdução às Normas do Direito Brasileiro. 2 Pessoa natural. 3 Pessoa jurídica. 4 Personalidade. 5 Domicílio e residência. 6 Bens, diferentes classes de bens. 7 Fato Jurídico. 7.1 Atos Jurídicos Lícitos e Ilícitos. 7.2 Negócio Jurídico. 7.3 Prescrição e decadência. 8 Posse. 8.1 Classificação, aquisição, efeitos e perda. 8.2 Propriedade: aquisição e perda da propriedade. 8.3 Direito real sobre coisa alheia. 9 Responsabilidade civil. 9.1 Teoria da culpa e do risco.'),
  ('pc-go-delegado', 'Direito Empresarial', '10.1 Origem; evolução histórica; autonomia; fontes; características. 10.2 Empresário: caracterização; inscrição; capacidade; teoria da empresa e seus perfis. 11 Teoria geral dos títulos de crédito. 11.1 Títulos de crédito: letra de câmbio; cheque; nota promissória; duplicata. 11.2 Aceite; aval; endosso; protesto; prescrição. 11.3 Ações cambiais. 12 Espécies de empresa. 12.1 Responsabilidade dos sócios. 12.2 Distribuição de lucros. 12.3 Sócio oculto. 12.4 Segredo comercial. 13 Teoria geral do direito societário. 13.1 Conceito de sociedade; personalização da sociedade. 13.2 Classificação das sociedades: sociedades não personificadas; sociedades personificadas; sociedade simples; sociedade em nome coletivo; sociedade em comandita simples; sociedade em comandita por ações; sociedade cooperada; sociedades coligadas. 13.3 Liquidação; transformação; incorporação; fusão; cisão; sociedades dependentes de autorização. 13.4 Sociedade limitada; sociedade anônima. 13.5 Estabelecimento empresarial. 13.6 Recuperação judicial; recuperação extrajudicial; falência do empresário e da sociedade empresária. 13.7 Institutos complementares do direito empresarial: registro; nome; prepostos; escrituração; propriedade industrial. 14 Sistema Financeiro Nacional: constituição; competência das entidades integrantes; instituições financeiras públicas e privadas; liquidação extrajudicial de instituições financeiras; sistema financeiro da habitação. 15 Títulos de crédito: atributos gerais; integração das leis uniformes de Genebra no direito brasileiro; nota promissória, duplicata; cheque.'),
  ('pc-go-delegado', 'Direito Eleitoral', '1 Lei Federal nº 4.737/1965 e suas alterações (Código Eleitoral). 1.1 Introdução. 1.2 Órgãos da justiça eleitoral. 1.2.1 Tribunal Superior Eleitoral (TSE). 1.2.2 Tribunais Regionais Eleitorais. 1.2.3 Juízes eleitorais e juntas eleitorais: composição, competências e atribuições. 1.3 Alistamento eleitoral: qualificação e inscrição, cancelamento e exclusão. 2 Lei Federal nº 9.504/1997. 2.1 Disposições gerais. 2.2 Coligações. 2.3 Convenções para escolha de candidatos. 2.4 Registro de candidatos. 2.5 Sistema eletrônico de votação e totalização dos votos. 3 Lei Federal nº 9.096/1995. 3.1 Disposições preliminares. 3.2 Filiação partidária. 4 Resolução do TSE nº 21.538/2003. 4.1 Alistamento eleitoral. 4.2 Transferência de domicílio eleitoral. 4.3 Segunda via da inscrição. 4.4 Restabelecimento de inscrição cancelada por equívoco. 4.5 Formulário de atualização da situação do eleitor. 4.6 Título eleitoral. 4.7 Acesso às informações constantes do cadastro. 4.8 Restrição de direitos políticos. 4.9 Revisão do eleitorado. 4.10 Justificação do não comparecimento à eleição (com a alteração do Acórdão do TSE nº 649/2005). 5. Lei Federal n. 6.091/1974.'),
  ('pc-go-delegado', 'Direito Tributário', '1 O Estado e o poder de tributar. 2 Direito tributário: conceito e princípios. 3 Tributo: conceito e espécies. 4 O Código Tributário Nacional. 5 Normas gerais de direito tributário. 6 Obrigação tributária. 6.1 Conceito e espécies. 6.2 Fato gerador (hipótese de incidência). 6.3 Sujeitos ativo e passivo. 6.4 Solidariedade. 6.5 Capacidade tributária. 6.6 Domicílio tributário. 7 Crédito tributário. 7.1 Conceito. 7.2 Natureza. 7.3 Lançamento. 7.4 Revisão. 7.5 Suspensão, extinção e exclusão. 7.6 Prescrição e decadência. 7.7 Repetição do indébito. 8 Responsabilidade tributária. 8.1 Responsabilidade por dívida própria e por dívida de outrem. 8.2 Solidariedade e sucessão. 8.3 Responsabilidade pessoal e de terceiros. 8.4 Responsabilidade supletiva. 9 Sistema Tributário Nacional. 9.1 Princípios gerais. 9.2 Limitações ao poder de tributar. 10 Os tributos da União, dos Estados, do Distrito Federal e dos municípios. 11 Processo judicial tributário. 11.1 Execução fiscal. 11.1.1 Exceção de pré-executividade. 11.1.2 Embargos do executado. 11.2 Ação anulatória de débito fiscal. 12 Ilícito tributário: ilícito administrativo tributário, ilícito penal tributário, crimes contra a ordem tributária.'),
  ('pc-go-delegado', 'Direito Ambiental', '1 Princípios do Direito Ambiental. 2 A Constituição Federal e o meio ambiente. 3 A legislação brasileira florestal (Leis nº 12.651/2012, 11.428/2006, 11.284/2006 e regulamentos). 4 A legislação brasileira de unidades de conservação (Lei nº 9.985/2000 e regulamentos). A Proteção e a conservação da biodiversidade. A Lei nº 11.516/2007. 5 Poder de Polícia Ambiental. Crimes e infrações administrativas contra o meio ambiente (Lei nº 9.605/1998 e regulamentos). Procedimento administrativo para apuração de infrações ambientais (Decreto nº 6.514/2008). Licenciamento ambiental (LC nº 140/2011, Lei nº 6.938/1981, RESOLUÇÃO CONAMA nº 428/2010 e regulamentos). 6 Organizações dos Sistemas Nacionais de Meio Ambiente e de Unidades de Conservação (SISNAMA e SNUC). Instrumentos da Política Nacional de Meio Ambiente (Lei nº 6.938/1981). Proteção e conservação da biodiversidade. Legislação e tratados para a proteção às espécies ameaçadas. Biossegurança e controle de Organismos Geneticamente Modificados (OGM). 7 Responsabilidade ambiental: conceito de dano e reparação ambiental.'),
  ('pc-go-delegado', 'Direitos Humanos', '1. Constituição Federal Brasileira (1988). 2. Declaração Universal dos Direitos Humanos (ONU - 1948). 3. Convenção contra a Tortura e outros Tratamentos ou Penas Cruéis, Desumanas ou Degradantes (1984). 4. Teoria Geral dos Direitos Humanos: conceito, terminologia, estrutura normativa, fundamentação; 5. Afirmação histórica dos direitos humanos; 6. Garantias processuais dos Direitos Humanos, Interpretação e Aplicação dos Tratados Internacionais de Proteção aos Direitos Humanos. 7. A Natureza Jurídica da incorporação de normas internacionais sobre Direitos Humanos ao direito interno brasileiro. 8. Declaração Universal dos Direitos Humanos. 9. Convenção contra a Tortura e Outros Tratamentos ou Penas Cruéis, Desumanos ou Degradantes (Decreto nº 40/1991). 10. Lei nº 13.060/2014. 11. Código de Conduta para os Funcionários Responsáveis pela Aplicação da Lei (Resolução da ONU nº 34/169 de 1979). 12 Pacto de São José da Costa Rica e Decreto nº 678/1992.'),
  ('pc-go-delegado', 'Conhecimentos Regionais', '1 Formação econômica de Goiás: a mineração no século XVIII, a agropecuária nos séculos XIX e XX, a estrada de ferro e a modernização da economia goiana, as transformações econômicas com a construção de Goiânia e Brasília, industrialização, infraestrutura e planejamento. 2 Modernização da agricultura e urbanização do território goiano. 3 População goiana: povoamento, movimentos migratórios e densidade demográfica. 4 Economia goiana: industrialização e infraestrutura de transportes e comunicação. 5 As regiões goianas e as desigualdades regionais. 6 Aspectos físicos do território goiano: vegetação, hidrografia, clima e relevo. 6 Aspectos da história política de Goiás: a independência em Goiás, o coronelismo na República Velha, as oligarquias, a Revolução de 1930, a administração política de 1930 até os dias atuais. 7 Aspectos da História Social de Goiás: o povoamento branco, os grupos indígenas, a escravidão e cultura negra, os movimentos sociais no campo e a cultura popular. 8 Atualidades econômicas, políticas e sociais do Brasil, especialmente do Estado de Goiás.'),
  ('pc-go-delegado', 'Legislação Estadual — Goiás', '1. Lei estadual n.º 16.901/2010 (Lei Orgânica da Polícia Civil do Estado de Goiás). 2. Lei estadual n.º 20.756/2020 (regime jurídico dos servidores públicos civis do Estado de Goiás, das autarquias e fundações públicas estaduais). 3. Lei estadual n.º 13.800/2001 (processo administrativo no âmbito da Administração Pública do Estado de Goiás). 4. Lei estadual n.º 20.491/2019 (Organização administrativa do Poder Executivo). 5. Decreto estadual n.º 9.837/2021 (Código de Ética e Conduta Profissional do Servidor e da Alta Administração). 6. Lei estadual n.º 18.456/2014 (Prevenção e punição de assédio moral no âmbito da Administração). 7. Lei estadual n.º 18.672/2014 (Responsabilização administrativa e civil de pessoas jurídicas pela prática de atos contra a administração pública estadual).')
) as v(slug, materia, texto)
join public.editais_catalog e on e.slug = v.slug
join public.subjects_catalog s on s.name = v.materia
on conflict (edital_catalog_id, subject_catalog_id) do update
  set texto = excluded.texto, fonte_url = excluded.fonte_url, conferido_em = excluded.conferido_em;

-- ── 3. verificado_em ─────────────────────────────────────────────────────────
update public.editais_catalog set verificado_em = '2026-08-03' where slug = 'pc-go-delegado';

-- ── Verificação dura ─────────────────────────────────────────────────────────
do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'pc-go-delegado'
  where ecs.topicos_curados;
  if v <> 15 then raise exception 'topicos_curados: esperado 15 matérias, achei %', v; end if;

  select count(*) into v from public.edital_programas p
  join public.editais_catalog e on e.id = p.edital_catalog_id and e.slug = 'pc-go-delegado';
  if v <> 15 then raise exception 'edital_programas: esperado 15, achei %', v; end if;

  -- num_questions_expected: Delegado já tinha NULL em 4 matérias antes desta
  -- migration (Criminologia, Medicina Legal, Direito Civil, Direito
  -- Empresarial — pré-existente, banca não divulga peso separado) — a barra
  -- de porcentagem já estava desabilitada ali; esta migration não piora isso,
  -- só confirma que não criou NOVOS nulos além dos 4 já conhecidos.
  select count(*) into v
  from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'pc-go-delegado'
  where ecs.num_questions_expected is null;
  if v <> 4 then raise exception 'esperado 4 matérias com num_questions_expected nulo (pré-existente), achei %', v; end if;
end $$;
