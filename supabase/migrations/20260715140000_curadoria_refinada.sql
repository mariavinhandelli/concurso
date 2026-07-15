-- Hub de Editais — curadoria refinada (15/07/2026).
-- 1) Tópicos ("linha mestra" real de cada disciplina/lei — mesma granularidade
--    do restante do topics_catalog; refinável pela usuária no Montar Edital)
--    para as 8 disciplinas que estavam com grade vazia. Química/Física/Biologia
--    fica sem tópicos (o escopo exato depende do texto do edital — não inventamos).
-- 2) Religa os tópicos novos aos editais PC-GO e TJ-GO Juiz.
-- 3) Histórico: inscritos REAIS de 2022 por cargo (fonte: MaxiEduca/AOCP) e
--    notas de corte REAIS de 2016 (fonte: Direção Concursos). Nota de corte de
--    2022 não foi publicada pelos portais → segue vazia ("—" na UI).

-- ── 1) Tópicos por disciplina ──
insert into public.topics_catalog (subject_catalog_id, name, position, slug)
select s.id, v.name, v.position, v.slug
from (values
  -- Direito do Consumidor (CDC)
  ('direito-consumidor', 'Princípios e conceitos: consumidor, fornecedor, produto e serviço', 1, 'cdc-conceitos'),
  ('direito-consumidor', 'Direitos básicos do consumidor', 2, 'cdc-direitos-basicos'),
  ('direito-consumidor', 'Responsabilidade pelo fato do produto e do serviço', 3, 'cdc-fato'),
  ('direito-consumidor', 'Responsabilidade por vício do produto e do serviço', 4, 'cdc-vicio'),
  ('direito-consumidor', 'Decadência e prescrição', 5, 'cdc-prazos'),
  ('direito-consumidor', 'Práticas comerciais e práticas abusivas', 6, 'cdc-praticas'),
  ('direito-consumidor', 'Oferta e publicidade', 7, 'cdc-publicidade'),
  ('direito-consumidor', 'Proteção contratual e cláusulas abusivas', 8, 'cdc-contratos'),
  ('direito-consumidor', 'Bancos de dados e cadastros de consumidores', 9, 'cdc-cadastros'),
  ('direito-consumidor', 'Sanções administrativas', 10, 'cdc-sancoes'),
  ('direito-consumidor', 'Defesa do consumidor em juízo e ações coletivas', 11, 'cdc-juizo'),
  ('direito-consumidor', 'Sistema Nacional de Defesa do Consumidor', 12, 'cdc-sndc'),
  -- Direito da Criança e do Adolescente (ECA)
  ('direito-crianca-adolescente', 'Proteção integral e prioridade absoluta', 1, 'eca-principios'),
  ('direito-crianca-adolescente', 'Direitos fundamentais da criança e do adolescente', 2, 'eca-direitos'),
  ('direito-crianca-adolescente', 'Prevenção', 3, 'eca-prevencao'),
  ('direito-crianca-adolescente', 'Política de atendimento e entidades', 4, 'eca-atendimento'),
  ('direito-crianca-adolescente', 'Medidas de proteção', 5, 'eca-medidas-protecao'),
  ('direito-crianca-adolescente', 'Família natural e família substituta: guarda, tutela e adoção', 6, 'eca-familia'),
  ('direito-crianca-adolescente', 'Conselho Tutelar', 7, 'eca-conselho'),
  ('direito-crianca-adolescente', 'Ato infracional e garantias processuais', 8, 'eca-ato-infracional'),
  ('direito-crianca-adolescente', 'Medidas socioeducativas e SINASE', 9, 'eca-socioeducativas'),
  ('direito-crianca-adolescente', 'Justiça da Infância e da Juventude: competência e procedimentos', 10, 'eca-justica'),
  ('direito-crianca-adolescente', 'Crimes e infrações administrativas em espécie', 11, 'eca-crimes'),
  -- Direito Eleitoral
  ('direito-eleitoral', 'Princípios e fontes do Direito Eleitoral', 1, 'eleitoral-principios'),
  ('direito-eleitoral', 'Direitos políticos e alistamento eleitoral', 2, 'eleitoral-direitos-politicos'),
  ('direito-eleitoral', 'Elegibilidade e inelegibilidades (LC 64/1990)', 3, 'eleitoral-inelegibilidades'),
  ('direito-eleitoral', 'Justiça Eleitoral e Ministério Público Eleitoral', 4, 'eleitoral-justica'),
  ('direito-eleitoral', 'Partidos políticos (Lei 9.096/1995)', 5, 'eleitoral-partidos'),
  ('direito-eleitoral', 'Sistemas eleitorais', 6, 'eleitoral-sistemas'),
  ('direito-eleitoral', 'Convenções partidárias e registro de candidaturas', 7, 'eleitoral-registro'),
  ('direito-eleitoral', 'Propaganda eleitoral', 8, 'eleitoral-propaganda'),
  ('direito-eleitoral', 'Financiamento de campanha e prestação de contas', 9, 'eleitoral-financiamento'),
  ('direito-eleitoral', 'Votação, apuração e diplomação', 10, 'eleitoral-votacao'),
  ('direito-eleitoral', 'Ações eleitorais: AIJE, AIME e RCED', 11, 'eleitoral-acoes'),
  ('direito-eleitoral', 'Crimes eleitorais', 12, 'eleitoral-crimes'),
  -- Direito Ambiental
  ('direito-ambiental', 'Princípios do Direito Ambiental', 1, 'ambiental-principios'),
  ('direito-ambiental', 'Meio ambiente na Constituição e competências ambientais', 2, 'ambiental-constituicao'),
  ('direito-ambiental', 'Política Nacional do Meio Ambiente e SISNAMA', 3, 'ambiental-pnma'),
  ('direito-ambiental', 'Licenciamento ambiental e EIA/RIMA', 4, 'ambiental-licenciamento'),
  ('direito-ambiental', 'Responsabilidade civil, administrativa e penal ambiental', 5, 'ambiental-responsabilidade'),
  ('direito-ambiental', 'Crimes ambientais (Lei 9.605/1998)', 6, 'ambiental-crimes'),
  ('direito-ambiental', 'Unidades de conservação (SNUC)', 7, 'ambiental-snuc'),
  ('direito-ambiental', 'Código Florestal: APP e Reserva Legal', 8, 'ambiental-florestal'),
  ('direito-ambiental', 'Recursos hídricos e saneamento', 9, 'ambiental-hidricos'),
  ('direito-ambiental', 'Tutela processual do meio ambiente (ação civil pública)', 10, 'ambiental-tutela'),
  -- Direito Empresarial
  ('direito-empresarial', 'Teoria da empresa e empresário', 1, 'empresarial-empresa'),
  ('direito-empresarial', 'Registro de empresa e estabelecimento empresarial', 2, 'empresarial-registro'),
  ('direito-empresarial', 'Nome empresarial e propriedade industrial', 3, 'empresarial-nome-pi'),
  ('direito-empresarial', 'Sociedades: teoria geral e tipos societários', 4, 'empresarial-sociedades'),
  ('direito-empresarial', 'Sociedade limitada', 5, 'empresarial-ltda'),
  ('direito-empresarial', 'Sociedade anônima', 6, 'empresarial-sa'),
  ('direito-empresarial', 'Títulos de crédito', 7, 'empresarial-titulos'),
  ('direito-empresarial', 'Contratos empresariais', 8, 'empresarial-contratos'),
  ('direito-empresarial', 'Recuperação judicial e extrajudicial', 9, 'empresarial-recuperacao'),
  ('direito-empresarial', 'Falência (Lei 11.101/2005)', 10, 'empresarial-falencia'),
  -- Formação Humanística (eixos da Res. CNJ 75/2009)
  ('formacao-humanistica', 'Sociologia do Direito', 1, 'humanistica-sociologia'),
  ('formacao-humanistica', 'Psicologia Judiciária', 2, 'humanistica-psicologia'),
  ('formacao-humanistica', 'Ética e Estatuto Jurídico da Magistratura Nacional (LOMAN e CNJ)', 3, 'humanistica-etica'),
  ('formacao-humanistica', 'Filosofia do Direito', 4, 'humanistica-filosofia'),
  ('formacao-humanistica', 'Teoria Geral do Direito e da Política', 5, 'humanistica-teoria'),
  -- Técnicas de Identificação (Papiloscopia)
  ('tecnicas-identificacao', 'Identificação humana: conceito, princípios e histórico', 1, 'ident-conceitos'),
  ('tecnicas-identificacao', 'Papiloscopia: datiloscopia, quiroscopia e podoscopia', 2, 'ident-papiloscopia'),
  ('tecnicas-identificacao', 'Classificação datiloscópica', 3, 'ident-classificacao'),
  ('tecnicas-identificacao', 'Levantamento, revelação e transporte de impressões papilares', 4, 'ident-levantamento'),
  ('tecnicas-identificacao', 'Confronto papiloscópico e laudos', 5, 'ident-confronto'),
  ('tecnicas-identificacao', 'Identificação civil e criminal', 6, 'ident-civil-criminal'),
  ('tecnicas-identificacao', 'Necropapiloscopia', 7, 'ident-necro'),
  ('tecnicas-identificacao', 'Representação facial humana (retrato falado)', 8, 'ident-facial'),
  -- Arquivologia
  ('arquivologia', 'Conceitos fundamentais de arquivologia', 1, 'arq-conceitos'),
  ('arquivologia', 'Gestão de documentos e ciclo vital', 2, 'arq-gestao'),
  ('arquivologia', 'Protocolo: recebimento, registro e tramitação', 3, 'arq-protocolo'),
  ('arquivologia', 'Classificação de documentos', 4, 'arq-classificacao'),
  ('arquivologia', 'Tabela de temporalidade e destinação', 5, 'arq-temporalidade'),
  ('arquivologia', 'Métodos de arquivamento', 6, 'arq-metodos'),
  ('arquivologia', 'Preservação e conservação de documentos', 7, 'arq-preservacao'),
  ('arquivologia', 'Documentos digitais e gestão eletrônica', 8, 'arq-digitais')
) as v(subject_slug, name, position, slug)
join public.subjects_catalog s on s.slug = v.subject_slug
where not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.slug = v.slug
);

-- ── 2) Religa os tópicos novos aos editais que usam essas disciplinas ──
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select ecs.edital_catalog_id, t.id
from public.edital_catalog_subjects ecs
join public.editais_catalog e on e.id = ecs.edital_catalog_id
  and (e.slug like 'pc-go-%' or e.slug = 'tj-go-juiz-substituto')
join public.topics_catalog t on t.subject_catalog_id = ecs.subject_catalog_id
on conflict do nothing;

-- ── 3) Histórico: inscritos 2022 (dado oficial por cargo) ──
update public.edital_concurso_stats set inscritos = 55029
where concurso_key = 'pc-go-agente' and ano = 2022 and inscritos is null;
update public.edital_concurso_stats set inscritos = 38584
where concurso_key = 'pc-go-escrivao' and ano = 2022 and inscritos is null;
update public.edital_concurso_stats set inscritos = 11980
where concurso_key = 'pc-go-papiloscopista' and ano = 2022 and inscritos is null;
update public.edital_concurso_stats set inscritos = 17294
where concurso_key = 'pc-go-delegado' and ano = 2022 and inscritos is null;

-- Notas de corte reais de 2016 (edição anterior — Agente e Escrivão)
insert into public.edital_concurso_stats (concurso_key, ano, nota_corte, fonte_url)
select v.* from (values
  ('pc-go-agente', 2016, 47.3, 'https://www.direcaoconcursos.com.br/noticias/concurso-pc-go-nota-de-corte'),
  ('pc-go-escrivao', 2016, 48.27, 'https://www.direcaoconcursos.com.br/noticias/concurso-pc-go-nota-de-corte')
) as v(concurso_key, ano, nota_corte, fonte_url)
on conflict (concurso_key, ano) do nothing;

-- ── 4) Nova rodada de verificação da PC-GO ──
update public.editais_catalog set verificado_em = '2026-07-15' where slug like 'pc-go-%';
