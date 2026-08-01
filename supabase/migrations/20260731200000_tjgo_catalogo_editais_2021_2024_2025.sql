-- TJ-GO: catálogo alimentado a partir dos PDFs oficiais enviados em 31/07/2026
-- (editais, cadernos de prova, gabaritos definitivos e padrões de resposta).
--
-- Material auditado nesta migration:
--   • Edital nº 02/2021 — Concurso Público Unificado (Centro de Seleção/UFG),
--     95 vagas. Provas 19/12/2021, gabarito final 17/01/2022.
--   • Edital nº 01/2024 — 3º Concurso Público Unificado (Instituto Verbena/UFG),
--     41 vagas. Provas 13/10/2024 (Oficial de Justiça e Analista de Sistemas)
--     e 24/11/2024 (Contador).
--   • Edital nº 01/2025 — 59º Concurso de Juiz Substituto (FGV), 51 vagas.
--     VIGENTE. Objetiva aplicada em 29/03/2026.
--
-- ── Como os pesos foram derivados (o ponto crítico desta carga) ─────────────
-- `edital_catalog_subjects.weight` não é o "peso da questão" do edital: ele é
-- consumido proporcionalmente (lib/schedule/distributor.ts e
-- scheduleGenerator.service.ts fazem weight/somaPesos × tempo total). O que o
-- edital fixa é PONTUAÇÃO por disciplina = quantidade de questões × peso da
-- questão. Então o peso 1–5 aqui é a escala 5 × pontos ÷ maiorPontuação,
-- arredondada e corrigida para nunca empatar uma disciplina com outra de
-- pontuação estritamente menor.
--
-- A pontuação real de cada disciplina fica registrada de duas formas
-- auditáveis: em `num_questions_expected` (quando o edital publica a divisão)
-- e nos comentários de cada bloco abaixo. Onde o edital NÃO publica a divisão,
-- num_questions_expected fica null — mesma regra das grades do TCE-GO e do
-- INSS: não fabricar precisão que a fonte não tem.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MATÉRIAS NOVAS DO CATÁLOGO
-- ═══════════════════════════════════════════════════════════════════════════
-- Quatro disciplinas dos editais do TJ-GO não tinham equivalente em
-- subjects_catalog. As demais foram mapeadas para matérias já existentes
-- (Língua Portuguesa, Raciocínio Lógico-Matemático, Informática,
-- Conhecimentos Regionais, Administração Pública, Contabilidade Geral,
-- Contabilidade Pública e os ramos do Direito).

insert into public.subjects_catalog (name, slug)
select v.name, v.slug
from (values
  ('Atualidades e Conhecimentos Gerais', 'atualidades-e-conhecimentos-gerais'),
  ('Legislação (Ética, Improbidade e Licitações)', 'legislacao-etica-improbidade-licitacoes'),
  ('Legislação Complementar (TJ-GO)', 'legislacao-complementar-tj-go'),
  ('Tecnologia da Informação', 'tecnologia-da-informacao')
) as v(name, slug)
where not exists (select 1 from public.subjects_catalog s where s.name = v.name);

-- ── Atualidades e Conhecimentos Gerais ──────────────────────────────────────
-- Transcrito do Anexo IV do Edital 01/2024, disciplina "Atualidades e
-- História, Geografia e Conhecimentos Gerais do Brasil e de Goiás" (17 itens).
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Formação social, política, histórica e econômica do Brasil', 1),
  ('Direitos humanos', 2),
  ('Minorias e etnicidade', 3),
  ('Mundo do trabalho', 4),
  ('Mobilidade e migrações', 5),
  ('Questões atuais do meio ambiente, desastres ambientais e políticas ambientais', 6),
  ('Educação: história, desafios e inovações tecnológicas', 7),
  ('Segurança: conflitos sociais e explosão urbana', 8),
  ('Cultura: homogeneidade e heterogeneidade no Brasil', 9),
  ('Tecnologia e sua influência no meio social', 10),
  ('Energia, sustentabilidade e compromisso social', 11),
  ('Comunicação em redes: internet e suas implicações', 12),
  ('Relações internacionais', 13),
  ('Movimentos sociais', 14),
  ('Aspectos socioantropológicos da saúde no Brasil e no mundo', 15),
  ('Religiosidades e influências das matrizes africana, europeia e indígena', 16),
  ('Aspectos histórico-geográficos de Goiás', 17)
) as v(name, position) on true
where s.name = 'Atualidades e Conhecimentos Gerais'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ── Legislação (Ética, Improbidade e Licitações) ────────────────────────────
-- Transcrito do Anexo IV do Edital 01/2024, disciplina "Legislação" (17 itens).
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Ética e função pública', 1),
  ('Ética no setor público', 2),
  ('Improbidade administrativa (Lei nº 8.429/1992 e alterações)', 3),
  ('Processo administrativo (Lei nº 9.784/1999 e alterações)', 4),
  ('Lei de Acesso à Informação (Lei nº 12.527/2011)', 5),
  ('Decreto nº 7.724/2012 (regulamento da LAI)', 6),
  ('Decreto nº 9.830/2019 (LINDB — arts. 20 a 30)', 7),
  ('Princípios fundamentais da CF/1988; direitos e garantias fundamentais', 8),
  ('Organização do Estado: União, estados, municípios, DF e territórios', 9),
  ('Administração Pública e servidores públicos na CF/1988', 10),
  ('Organização dos Poderes', 11),
  ('Princípios de Direito Administrativo', 12),
  ('Atos administrativos: elementos e atributos', 13),
  ('Classificações e espécies dos atos administrativos', 14),
  ('Anulação, revogação e convalidação dos atos administrativos', 15),
  ('Competência e processos administrativos', 16),
  ('Agentes públicos: agentes políticos e servidores públicos', 17),
  ('Nova Lei de Licitações e Contratos (Lei nº 14.133/2021)', 18)
) as v(name, position) on true
where s.name = 'Legislação (Ética, Improbidade e Licitações)'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ── Legislação Complementar (TJ-GO) ─────────────────────────────────────────
-- Transcrito do Anexo IV do Edital 02/2021 (consolidado pelo Edital
-- Complementar nº 1), disciplina "Legislação Complementar".
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Regimento Interno do Tribunal de Justiça do Estado de Goiás', 1),
  ('Lei Estadual nº 9.129/1981 (atualizada pela Lei nº 20.816/2020)', 2),
  ('Resolução nº 325/2020 do Conselho Nacional de Justiça', 3),
  ('Constituição do Estado de Goiás', 4),
  ('Código de Organização Judiciária do Estado de Goiás', 5)
) as v(name, position) on true
where s.name = 'Legislação Complementar (TJ-GO)'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ── Tecnologia da Informação ────────────────────────────────────────────────
-- Transcrito do Anexo IV do Edital 01/2024, "Conhecimentos Específicos —
-- Analista Judiciário / Área Especializada / Analista de Sistemas" (60 itens,
-- agrupados aqui nos 39 tópicos de primeiro nível que o próprio edital separa
-- por assunto).
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Componentes e arquiteturas de sistemas computacionais (hardware e software)', 1),
  ('Representação de dados (binário, hexadecimal, decimal) e aritmética computacional', 2),
  ('Processamento paralelo e distribuído; pipeline; multiprocessamento simétrico e assimétrico', 3),
  ('Arquiteturas de processadores e conjuntos de instrução', 4),
  ('Hierarquia de memória e interface entre processadores e periféricos', 5),
  ('Fundamentos de sistemas operacionais: processos, threads, deadlocks e starvation', 6),
  ('Gerenciamento de memória: alocação, segmentação, memória virtual e paginação', 7),
  ('Sistemas de entrada e saída e armazenamento secundário e terciário', 8),
  ('Ubuntu, Windows 10 e superiores e Windows Server 2019 e superiores', 9),
  ('Virtualização, máquinas virtuais, containers e Docker', 10),
  ('Engenharia de usabilidade e arquitetura da informação', 11),
  ('Usabilidade, comunicabilidade, acessibilidade e navegabilidade', 12),
  ('Análise de requisitos e testes de usabilidade', 13),
  ('Concepção, projeto e implementação de interfaces; wireframes; telas e relatórios', 14),
  ('Acessibilidade: Decreto nº 5.296/2004, e-MAG e recomendações W3C/WAI', 15),
  ('Cartilhas de usabilidade e padrões Brasil e-Gov', 16),
  ('Lógica de programação: operadores, expressões e estruturas de controle', 17),
  ('Estruturas de dados: listas, pilhas, filas, árvores; ordenação, pesquisa e hashing', 18),
  ('Análise de algoritmos e custo computacional (notação Big-O)', 19),
  ('Paradigmas de programação: orientação a objetos e programação funcional', 20),
  ('Java, PHP, Spring (Boot, MVC, Data JPA, Data Envers) e Java EE', 21),
  ('Testes de software: unitários (JUnit, Spock, Mockito), integração e funcionais', 22),
  ('Metodologias TDD e BDD', 23),
  ('Programação para dispositivos móveis: Android e iOS', 24),
  ('Integração contínua: GitLab CI, Docker Compose, Gradle e NPM', 25),
  ('Desenvolvimento web: HTML, CSS3, JavaScript, jQuery, Angular, React e REST', 26),
  ('Arquitetura de aplicações web e portais corporativos; internet, intranet e extranet', 27),
  ('Servidores de aplicação (JBoss, WildFly, Tomcat) e web (Apache, IIS, nginx)', 28),
  ('Padrões de projeto (GoF, POSA, Java Enterprise Patterns), refatoração e Clean Code', 29),
  ('Arquitetura em 3 camadas e padrão MVC', 30),
  ('Integração: SOA, REST, Web Services e microserviços com Docker Swarm', 31),
  ('Engenharia de software: princípios e ciclo de vida; ferramentas CASE', 32),
  ('Análise e projeto orientado a objetos com UML', 33),
  ('Processos de software (ABNT NBR ISO/IEC 12207) e Análise de Pontos de Função', 34),
  ('Metodologias ágeis: SCRUM, XP, FDD, MDA e MDD', 35),
  ('Qualidade de software: CMMI 2.0 e MPS.BR', 36),
  ('Linguagens SQL e PL/SQL', 37),
  ('Gerenciamento de projetos (PMBOK 7ª edição) e de serviços (ITIL v4)', 38),
  ('Redes: protocolos, arquitetura TCP/IP, IPv4 e IPv6, VoIP e redes sem fio (IEEE 802.11)', 39),
  ('Infraestrutura e gerência de redes: cabeamento, VLANs, QoS, SNMP, Zabbix, SDN e VXLAN', 40)
) as v(name, position) on true
where s.name = 'Tecnologia da Informação'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. JUIZ SUBSTITUTO — PESOS CORRIGIDOS (Edital 01/2025, VIGENTE)
-- ═══════════════════════════════════════════════════════════════════════════
-- A grade de 15/07 trazia pesos 5/5/3/3 · 4/4/4/3 · 2/3/2/2/3/2/2, que
-- distinguiam Direito Civil de Direito do Consumidor, Tributário de Ambiental
-- etc. O edital NÃO sustenta nenhuma dessas distinções: o subitem 12.6 publica
-- apenas o total por bloco e o 12.9 diz que TODA questão vale 0,1 ponto.
--
--   Bloco I  — 40 questões ÷ 4 disciplinas = 10 questões por disciplina
--   Bloco II — 30 questões ÷ 4 disciplinas =  7,5
--   Bloco III— 30 questões ÷ 6 disciplinas =  5
--
-- Razão 10 : 7,5 : 5 = 4 : 3 : 2 — e é exatamente o que os pesos abaixo
-- reproduzem: 4×4 + 4×3 + 6×2 = 40 pontos, distribuídos 40% / 30% / 30%,
-- idênticos aos 40/30/30 do edital. Qualquer diferença de peso DENTRO de um
-- bloco seria invenção.
--
-- Ressalva conhecida: o edital trata "Direito Tributário e Financeiro" como
-- uma disciplina só; a plataforma tem as duas separadas, então o Bloco III
-- fica com 7 matérias e pesa 33% em vez de 30%. Preferimos isso a jogar fora
-- os tópicos de Direito Financeiro, que o Anexo II cobra expressamente
-- (item 16: PPA, LDO, LOA, Lei nº 4.320/1964 e LRF).

update public.edital_catalog_subjects ecs
set weight = v.weight
from (values
  -- Bloco I — 40 questões
  ('Direito Civil', 4),
  ('Direito Processual Civil', 4),
  ('Direito do Consumidor', 4),
  ('Direito da Criança e do Adolescente (ECA)', 4),
  -- Bloco II — 30 questões
  ('Direito Penal', 3),
  ('Direito Processual Penal', 3),
  ('Direito Constitucional', 3),
  ('Direito Eleitoral', 3),
  -- Bloco III — 30 questões
  ('Direito Empresarial', 2),
  ('Direito Tributário', 2),
  ('Direito Financeiro', 2),
  ('Direito Ambiental', 2),
  ('Direito Administrativo', 2),
  ('Formação Humanística', 2),
  ('Direitos Humanos', 2)
) as v(subject_name, weight)
join public.subjects_catalog s on s.name = v.subject_name
where ecs.subject_catalog_id = s.id
and ecs.edital_catalog_id = (select id from public.editais_catalog where slug = 'tj-go-juiz-substituto')
and ecs.weight is distinct from v.weight;

-- num_questions_expected precisa continuar null: o edital publica o total do
-- bloco, nunca o da disciplina.
update public.edital_catalog_subjects
set num_questions_expected = null
where edital_catalog_id = (select id from public.editais_catalog where slug = 'tj-go-juiz-substituto');

update public.editais_catalog
set ano = 2025,
    vagas = 51,
    exam_date = '2026-03-29',
    edital_url = 'https://conhecimento.fgv.br/sites/default/files/concursos/59_juiz_edital_abertura_consolidado_13-01-2026.pdf',
    aviso = 'Edital nº 01/2025, consolidado em 13/01/2026 — 59º concurso da magistratura goiana, 51 vagas mais cadastro de reserva. '
         || 'Prova objetiva aplicada em 29/03/2026 (100 questões: 40 do Bloco I, 30 do Bloco II e 30 do Bloco III, cada uma valendo 0,1 ponto). '
         || 'Provas escritas — discursiva e sentenças cível e criminal — aplicadas em 31/05 e 01/06/2026, com resultado preliminar da discursiva já publicado. '
         || 'Faltam a inscrição definitiva (sindicância, exames e psicotécnico), a prova oral e a avaliação de títulos. '
         || 'Quem começa a estudar agora está se preparando para o 60º concurso.',
    verificado_em = '2026-07-31'
where slug = 'tj-go-juiz-substituto';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CONCURSO UNIFICADO (SERVIDORES) — UMA FICHA POR CARGO
-- ═══════════════════════════════════════════════════════════════════════════
-- A ficha genérica `tj-go-analista-judiciario` (sem banca, sem grade, sem
-- seguidores) virou o cargo real que ela mais se aproximava: Analista
-- Judiciário — Área Judiciária do Edital 02/2021. Os outros quatro cargos
-- entram como fichas novas, no mesmo padrão por cargo já usado na PC-GO.
--
-- Nenhum está vigente. O 3º Concurso Unificado (2024) foi homologado em
-- 20/12/2024, com validade de 2 anos. O TJ-GO prepara o 4º: a Comissão de
-- Seleção e Treinamento aprovou em 25/03/2026 (Pauta 002/2026, PROAD
-- 202505000644123) a minuta da resolução que o regulamenta — ainda sem
-- edital, banca ou vagas.

update public.editais_catalog
set cargo = 'Analista Judiciário — Área Judiciária',
    banca = 'Centro de Seleção/UFG',
    ano = 2021,
    nivel = 'superior',
    uf = 'GO',
    situacao = 'em_expectativa',
    ultima_edicao = 2021,
    vagas = 49,
    remuneracao = 4259.86,
    edital_url = 'https://centrodeselecao.ufg.br/2021/tj-go/sistema/arquivos/EDITAL_TJ_ABERTURA_2021_RETIFICADO_N2.pdf',
    aviso = 'Última edição: Edital nº 02/2021 (Centro de Seleção/UFG), 95 vagas no total — 49 delas para este cargo (36 ampla concorrência, 3 PcD e 10 negros), 40h, exigindo graduação em Direito. '
         || 'Provas objetiva e discursiva em 19/12/2021; gabarito final em 17/01/2022. '
         || 'O cargo NÃO foi ofertado no 3º Concurso Unificado (Edital 01/2024), que trouxe apenas Oficial de Justiça, Analista de Sistemas e Contador. '
         || 'O TJ-GO prepara o 4º Concurso Unificado: a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da nova resolução do certame, mas ainda não há edital, banca nem vagas definidas. '
         || 'A grade abaixo é a do edital de 2021 e pode mudar no próximo.',
    verificado_em = '2026-07-31',
    position = 8,
    -- concurso_key agrupa edições, histórico e provas anteriores. Estava
    -- isolado em 'tj-go-analista-judiciario'; os cinco cargos de servidor são
    -- o MESMO certame (Concurso Público Unificado), então compartilham 'tj-go'.
    concurso_key = 'tj-go'
where slug = 'tj-go-analista-judiciario';

insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, orgao_id, area_id,
   situacao, ultima_edicao, vagas, remuneracao, edital_url, aviso, is_active, position, verificado_em)
select
  v.slug, 'TJ-GO', v.cargo, v.banca, v.ano, 'GO', 'superior', 'tj-go',
  o.id, a.id, 'em_expectativa', v.ultima_edicao, v.vagas, v.remuneracao,
  v.edital_url, v.aviso, true, v.position, '2026-07-31'
from (values
  ('tj-go-analista-apoio-administrativo',
   'Analista Judiciário — Área de Apoio Judiciário e Administrativo',
   'Centro de Seleção/UFG', 2021, 2021, 46, 3833.88, 'Área Administrativa',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/arquivos/EDITAL_TJ_ABERTURA_2021_RETIFICADO_N2.pdf',
   'Última edição: Edital nº 02/2021 (Centro de Seleção/UFG), 95 vagas no total — 46 delas para este cargo (34 ampla concorrência, 3 PcD e 9 negros), 40h, exigindo graduação superior em QUALQUER área. '
   || 'Provas objetiva e discursiva em 19/12/2021; gabarito final em 17/01/2022. '
   || 'O cargo NÃO foi ofertado no 3º Concurso Unificado (Edital 01/2024). O TJ-GO prepara o 4º Concurso Unificado: a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da nova resolução do certame, mas ainda não há edital, banca nem vagas definidas. '
   || 'A grade abaixo é a do edital de 2021 e pode mudar no próximo.', 9),

  ('tj-go-oficial-de-justica',
   'Analista Judiciário — Oficial de Justiça',
   'Instituto Verbena/UFG', 2024, 2024, 29, 5200.37, 'Carreiras Jurídicas',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/arquivos/editais/RL-EDITAL_TJ_ABERTURA_COMPILADO-2024.pdf',
   'Última edição: Edital nº 01/2024 (Instituto Verbena/UFG), o 3º Concurso Unificado — 41 vagas no total, 29 delas para este cargo (20 ampla concorrência, 2 PcD, 6 negros e 1 indígena), 40h, exigindo graduação em Direito. '
   || 'Provas objetiva e discursiva em 13/10/2024; resultado final em 18/12/2024 e homologação em 20/12/2024, com validade de 2 anos. '
   || 'O TJ-GO prepara o 4º Concurso Unificado: a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da nova resolução do certame, mas ainda não há edital, banca nem vagas definidas. '
   || 'A grade abaixo é a do edital de 2024 e pode mudar no próximo.', 10),

  ('tj-go-contador',
   'Analista Judiciário — Área Especializada — Contador',
   'Instituto Verbena/UFG', 2024, 2024, 8, 5200.37, 'Área Administrativa',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/arquivos/editais/RL-EDITAL_TJ_ABERTURA_COMPILADO-2024.pdf',
   'Última edição: Edital nº 01/2024 (Instituto Verbena/UFG), o 3º Concurso Unificado — 41 vagas no total, 8 delas para este cargo (6 ampla concorrência e 2 negros), 40h, exigindo graduação na área de Contabilidade. '
   || 'A prova deste cargo foi aplicada em 24/11/2024, depois da data comum dos demais (13/10/2024). Homologação do concurso em 20/12/2024, com validade de 2 anos. '
   || 'O TJ-GO prepara o 4º Concurso Unificado: a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da nova resolução do certame, mas ainda não há edital, banca nem vagas definidas. '
   || 'A grade abaixo é a do edital de 2024 e pode mudar no próximo.', 11),

  ('tj-go-analista-sistemas',
   'Analista Judiciário — Área Especializada — Analista de Sistemas',
   'Instituto Verbena/UFG', 2024, 2024, 4, 5200.37, 'Área Administrativa',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/arquivos/editais/RL-EDITAL_TJ_ABERTURA_COMPILADO-2024.pdf',
   'Última edição: Edital nº 01/2024 (Instituto Verbena/UFG), o 3º Concurso Unificado — 41 vagas no total, 4 delas para este cargo (3 ampla concorrência e 1 negros), 40h, exigindo graduação na área de Tecnologia da Informação. '
   || 'Provas objetiva e discursiva em 13/10/2024; homologação em 20/12/2024, com validade de 2 anos. '
   || 'Único cargo do certame sem Noções de Informática na prova — em troca, Legislação vale o dobro das questões (10 em vez de 5). '
   || 'O TJ-GO prepara o 4º Concurso Unificado: a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da nova resolução do certame, mas ainda não há edital, banca nem vagas definidas. '
   || 'A grade abaixo é a do edital de 2024 e pode mudar no próximo.', 12)
) as v(slug, cargo, banca, ano, ultima_edicao, vagas, remuneracao, area_name, edital_url, aviso, position)
join public.orgaos_catalog o on o.slug = 'tj-go'
join public.catalog_areas a on a.name = v.area_name
where not exists (select 1 from public.editais_catalog e where e.slug = v.slug);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. GRADES POR CARGO
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada linha registra: questões × peso da questão = pontos (o edital fecha
-- sempre em 60 questões e 100,0 pontos).

insert into public.edital_catalog_subjects
  (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, v.nq, v.position
from (values
  -- ── Edital 02/2021 · Área Judiciária (Quadro 3 + Anexo IV) ───────────────
  -- Legislação Complementar 10×2=20 · LP 15×1=15 · Const 7×2=14 ·
  -- Adm 5×2=10 · Civil 5×2=10 · Proc.Civil 5×2=10 · Penal 4×2=8 ·
  -- Proc.Penal 4×2=8 · Hist./Geo. de Goiás 5×1=5  →  60 questões, 100,0 pontos
  ('tj-go-analista-judiciario', 'Legislação Complementar (TJ-GO)',  5, 10, 1),
  ('tj-go-analista-judiciario', 'Língua Portuguesa',                4, 15, 2),
  ('tj-go-analista-judiciario', 'Direito Constitucional',           4,  7, 3),
  ('tj-go-analista-judiciario', 'Direito Administrativo',           3,  5, 4),
  ('tj-go-analista-judiciario', 'Direito Civil',                    3,  5, 5),
  ('tj-go-analista-judiciario', 'Direito Processual Civil',         3,  5, 6),
  ('tj-go-analista-judiciario', 'Direito Penal',                    2,  4, 7),
  ('tj-go-analista-judiciario', 'Direito Processual Penal',         2,  4, 8),
  ('tj-go-analista-judiciario', 'Conhecimentos Regionais',          1,  5, 9),

  -- ── Edital 02/2021 · Apoio Judiciário e Administrativo ───────────────────
  -- Adm. Pública 18×2=36 · Legislação Complementar 10×2=20 · LP 15×1=15 ·
  -- Dir. Adm. 7×2=14 · Dir. Const. 5×2=10 · Hist./Geo. de Goiás 5×1=5
  --   →  60 questões, 100,0 pontos
  ('tj-go-analista-apoio-administrativo', 'Administração Pública',            5, 18, 1),
  ('tj-go-analista-apoio-administrativo', 'Legislação Complementar (TJ-GO)',  3, 10, 2),
  ('tj-go-analista-apoio-administrativo', 'Língua Portuguesa',                2, 15, 3),
  ('tj-go-analista-apoio-administrativo', 'Direito Administrativo',           2,  7, 4),
  ('tj-go-analista-apoio-administrativo', 'Direito Constitucional',           2,  5, 5),
  ('tj-go-analista-apoio-administrativo', 'Conhecimentos Regionais',          1,  5, 6),

  -- ── Edital 01/2024 · Oficial de Justiça (Quadro 3 + Anexo IV) ────────────
  -- LP 10×2=20 · Conhecimentos Específicos 30×2=60 · RLM 5×1=5 ·
  -- Atualidades 5×1=5 · Informática 5×1=5 · Legislação 5×1=5
  --   →  60 questões, 100,0 pontos.
  -- Os 60 pontos de Conhecimentos Específicos cobrem 6 ramos do Direito que o
  -- edital lista sem dividir a quantidade de questões — daí peso 2 igual para
  -- os seis (10 pontos cada) e num_questions_expected null.
  ('tj-go-oficial-de-justica', 'Língua Portuguesa',                            4, 10, 1),
  ('tj-go-oficial-de-justica', 'Direito Constitucional',                       2, null, 2),
  ('tj-go-oficial-de-justica', 'Direito Administrativo',                       2, null, 3),
  ('tj-go-oficial-de-justica', 'Direito Civil',                                2, null, 4),
  ('tj-go-oficial-de-justica', 'Direito Processual Civil',                     2, null, 5),
  ('tj-go-oficial-de-justica', 'Direito Penal',                                2, null, 6),
  ('tj-go-oficial-de-justica', 'Direito Processual Penal',                     2, null, 7),
  ('tj-go-oficial-de-justica', 'Raciocínio Lógico-Matemático',                 1,  5, 8),
  ('tj-go-oficial-de-justica', 'Atualidades e Conhecimentos Gerais',           1,  5, 9),
  ('tj-go-oficial-de-justica', 'Informática',                                  1,  5, 10),
  ('tj-go-oficial-de-justica', 'Legislação (Ética, Improbidade e Licitações)', 1,  5, 11),

  -- ── Edital 01/2024 · Contador ────────────────────────────────────────────
  -- LP 10×2=20 · Conhecimentos Específicos 30×2=60 · RLM 5×1=5 ·
  -- Atualidades 5×1=5 · Informática 5×1=5 · Legislação 5×1=5
  --   →  60 questões, 100,0 pontos.
  -- Os 39 itens de Conhecimentos Específicos se dividem entre contabilidade
  -- geral (itens 1–23) e contabilidade pública (itens 24–39); os pesos 5 e 4
  -- refletem essa proporção. O edital não diz quantas questões cabem a cada
  -- uma, então num_questions_expected fica null nas duas.
  ('tj-go-contador', 'Contabilidade Geral',                           5, null, 1),
  ('tj-go-contador', 'Contabilidade Pública',                         4, null, 2),
  ('tj-go-contador', 'Língua Portuguesa',                             3, 10, 3),
  ('tj-go-contador', 'Raciocínio Lógico-Matemático',                  1,  5, 4),
  ('tj-go-contador', 'Atualidades e Conhecimentos Gerais',            1,  5, 5),
  ('tj-go-contador', 'Informática',                                   1,  5, 6),
  ('tj-go-contador', 'Legislação (Ética, Improbidade e Licitações)',  1,  5, 7),

  -- ── Edital 01/2024 · Analista de Sistemas ────────────────────────────────
  -- LP 10×2=20 · Conhecimentos Específicos 30×2=60 · Legislação 10×1=10 ·
  -- RLM 5×1=5 · Atualidades 5×1=5  →  60 questões, 100,0 pontos.
  -- Sem Noções de Informática (o Anexo IV exclui este cargo expressamente).
  ('tj-go-analista-sistemas', 'Tecnologia da Informação',                     5, 30, 1),
  ('tj-go-analista-sistemas', 'Língua Portuguesa',                            2, 10, 2),
  ('tj-go-analista-sistemas', 'Legislação (Ética, Improbidade e Licitações)', 1, 10, 3),
  ('tj-go-analista-sistemas', 'Raciocínio Lógico-Matemático',                 1,  5, 4),
  ('tj-go-analista-sistemas', 'Atualidades e Conhecimentos Gerais',           1,  5, 5)
) as v(edital_slug, subject_name, weight, nq, position)
join public.editais_catalog e on e.slug = v.edital_slug
join public.subjects_catalog s on s.name = v.subject_name
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- Tópicos: todos os da matéria — mesmo padrão das demais grades do catálogo.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select ecs.edital_catalog_id, tc.id, null
from public.edital_catalog_subjects ecs
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
join public.editais_catalog e on e.id = ecs.edital_catalog_id
where e.slug in (
  'tj-go-analista-judiciario', 'tj-go-analista-apoio-administrativo',
  'tj-go-oficial-de-justica', 'tj-go-contador', 'tj-go-analista-sistemas'
)
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = ecs.edital_catalog_id and x.topic_catalog_id = tc.id
);

-- A descrição do órgão dizia "concurso de servidores autorizado em jun/2025",
-- que envelheceu: o certame de 2024 já foi homologado e o 4º só chegou à
-- minuta da resolução.
update public.orgaos_catalog
set descricao = 'Justiça estadual de Goiás. 59º concurso para Juiz Substituto em andamento (Edital 01/2025, FGV, 51 vagas), já na segunda etapa. '
             || 'Servidores: o 3º Concurso Unificado (Edital 01/2024, Instituto Verbena/UFG, 41 vagas) foi homologado em 20/12/2024 e o 4º está em preparação — '
             || 'a Comissão de Seleção e Treinamento aprovou em 25/03/2026 a minuta da resolução que o regulamenta, mas ainda não há edital.'
where slug = 'tj-go';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. PROVAS ANTERIORES
-- ═══════════════════════════════════════════════════════════════════════════
-- Cadernos e gabaritos oficiais das duas últimas edições, na origem. Ficam
-- indexados por concurso_key ('tj-go'), como as demais provas do banco.
-- Aqui os dois links apontam para a MESMA página porque a banca publica prova
-- e gabarito de todos os cargos num índice único — deep-link por cargo
-- quebraria a cada reorganização do site da UFG.

insert into public.edital_past_papers (concurso_key, ano, banca, prova_url, gabarito_url)
select v.concurso_key, v.ano, v.banca, v.prova_url, v.gabarito_url
from (values
  ('tj-go', 2024, 'Instituto Verbena/UFG',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/Provas_gabaritos_finais_TJ_UNIFICADO.html',
   'https://sistemas.institutoverbena.ufg.br/2024/concurso-tj-go/sistema/provas_gabaritos/Provas_gabaritos_finais_TJ_UNIFICADO.html'),
  ('tj-go', 2021, 'Centro de Seleção/UFG',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/provas_gabaritos_final_TJ-GO.html',
   'https://centrodeselecao.ufg.br/2021/tj-go/sistema/provas_gabaritos/provas_gabaritos_final_TJ-GO.html')
) as v(concurso_key, ano, banca, prova_url, gabarito_url)
where not exists (
  select 1 from public.edital_past_papers p
  where p.concurso_key = v.concurso_key and p.ano = v.ano
);
