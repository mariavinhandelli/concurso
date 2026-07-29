-- Banco de Editais: tira concorrentes (Gran/Estratégia/Direção/cloudfront de
-- cursinho) das fontes citadas na UI. Achado da 2ª auditoria de Concursos
-- (28/07): editais_catalog.edital_url do TCE-GO e dos 2 cargos da PM-GO
-- apontava para material de terceiro, e 36/55 edital_updates.url (34 Gran +
-- 2 Direção Concursos) linkavam blog de concorrente sob o rótulo "Abrir fonte
-- oficial". Cada URL trocada abaixo foi conferida (HTTP 200, domínio oficial)
-- antes de entrar na migration — nada de link de cursinho novo.

-- 1) TCE-GO: edital de Técnico ainda não foi publicado (FCC contratada em
-- 09/06/2026, Contrato nº 14/2026 — só a comissão organizadora existe até
-- agora). Sem PDF real, o botão "Baixar edital" não deve renderizar; o aviso
-- da ficha passa a apontar para a página oficial de concursos do órgão.
update public.editais_catalog
set edital_url = null,
    aviso = aviso || ' Edital ainda não publicado — acompanhe a divulgação oficial em portal.tce.go.gov.br/concursos.'
where slug = 'tce-go-tecnico-controle-externo'
  and edital_url is distinct from null
  and aviso not like '%portal.tce.go.gov.br%';

-- A única notícia curada do TCE-GO ("FCC contratada como banca") não tem
-- cobertura no site do próprio órgão ainda (o processo interno de contratação
-- não passou pelo portal de notícias) — remove o link de cursinho sem repor
-- (regra do item 3: sem fonte primária confirmada, a linha some sem link em
-- vez de apontar pra concorrente).
update public.edital_updates
set url = null
where id = '230a3b68-944f-4b6d-8cb1-18837ce2ef1e'  -- TCE-GO: FCC contratada como banca
  and url = 'https://blog.grancursosonline.com.br/concurso-tce-go/';

-- 2) PM-GO: os dois editais de 2022 apontavam pro CDN de blog de cursinho
-- (dhg1h5j42swfq.cloudfront.net). PDFs oficiais retificados, hospedados em
-- goias.gov.br/administracao (SEAD), confirmados 27 e 28 páginas / HTTP 200.
update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/04/171122-EdPM002Retificado-61c.pdf'
where slug = 'pm-go-soldado'
  and edital_url = 'https://dhg1h5j42swfq.cloudfront.net/2022/04/08090621/edital_abertura_policia_militar_do_estado_de_goias.pdf';

update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/04/171122-EdPM003Retificado-ade.pdf'
where slug = 'pm-go-oficial'
  and edital_url = 'https://dhg1h5j42swfq.cloudfront.net/2022/04/08090626/edital-abertura-003-2022cadete-tentente-pmgo.pdf';

-- 3) edital_updates de cursinho (blog.grancursosonline.com.br e
-- direcaoconcursos.com.br), 36 linhas. Duas categorias:
--
-- a) Eventos do PROCESSO do edital 2022 (retificação/resultado/gabarito/
--    homologação, abr/2022–abr/2023): a própria página da SEAD
--    (goias.gov.br/administracao/edital-00X-2022-...) é um índice vivo que
--    acumula os anexos de cada etapa — confirmado ao vivo (HTTP 200, "contém
--    diversas atualizações e documentos até jul/2026"). Vira a fonte de cada
--    linha do respectivo cargo.
update public.edital_updates
set url = 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/'
where id in (
  '4935ba98-0cc5-4cb1-aa88-eb49cacfc8ba', -- 1ª retificação
  '50c189c1-07f9-4c3b-a445-40f5ec9b6724', -- 2ª retificação
  'b8fd5b72-4db7-48e0-b40e-9811aeb23154', -- MP recomenda retificação
  'a9c5420b-159d-406f-9c53-78eb42abb15e', -- SEAD confirma que provas não serão anuladas
  '1e52f8d5-907f-487a-bbaa-4554afb31687', -- gabarito preliminar (Cadete)
  'afca5e36-d930-4188-89f3-714b1320ca9d', -- gabarito preliminar (2º Tenente QOS)
  '8d30f1ff-7352-4a11-879f-b3c03f968d7e', -- MP pede suspensão por vagas PCD
  '36160eb8-cca7-4bc7-914b-e23c110c9790', -- retificação com nova previsão de nomeação
  'c423e952-c59f-4470-9bfc-1a3b296592c8', -- resultado e classificação (preliminar)
  '2f0df4a9-26b0-478c-b582-44792be1ca62'  -- homologação do resultado final
)
and url = 'https://blog.grancursosonline.com.br/concurso-pm-go/';

update public.edital_updates
set url = 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/'
where id in (
  'f99f25e6-cbfe-4058-95e6-c497f07eae26', -- 1ª retificação
  '8a1876fd-d1bd-4715-9469-622960da1c29', -- 2ª retificação
  '5bdd7d60-5141-4296-9469-6d253238e773', -- deferimento das inscrições
  '33d5225f-e5a6-44f3-9622-7a1871926c05', -- MP recomenda retificação
  '65b5a69b-ad49-4887-8f61-2f3537d3880c', -- gabarito preliminar
  '1638efca-330d-429c-a00f-5294dca6c5ef', -- SEAD confirma que provas não serão anuladas
  '4b2115da-0a0f-49cc-96f0-eddb451ca84b', -- resultado preliminar das provas
  '85975c45-4891-41f3-b389-6147b02c2c7c', -- MP pede suspensão por vagas PCD
  '5d613ecb-ea8e-41e4-b28d-b9e5f0281e2b', -- retificação com nova previsão de nomeação
  '986523a5-1348-4fe8-8bb9-64684dadced9', -- resultado e classificação (preliminar)
  '8fe8f53a-a110-4fa1-8fab-f89807f80847'  -- homologação do resultado final
)
and url = 'https://blog.grancursosonline.com.br/concurso-pm-go/';

-- b) Notícias políticas posteriores (STF, ASSOF, nomeações, "novo edital em
-- estudo"…), 2023–2025: sem página oficial única e estável para citar — a
-- página da SEAD é só do processo de 2022, e as fontes .gov.br candidatas
-- (Casa Civil, TJGO, STF) devolveram 403/redirect para o aviso eleitoral ao
-- conferir ao vivo. Sem fonte primária verificada, a regra do item 3 manda
-- remover o link em vez de arriscar um cursinho ou um 404 em produção — a
-- linha continua na timeline, só sem link clicável.
update public.edital_updates
set url = null
where id in (
  -- PM-GO Oficial
  'd912f72a-c167-4883-8ced-9deef0f72b53', -- novo concurso é anunciado
  '15a96633-872f-4968-890c-71cdf27c0ba6', -- STF suspende convocações
  '8739d081-5759-443b-8feb-cff8d0727333', -- comando confirma estudos em andamento
  '83bc8700-89f7-4454-8dc3-4f9ce60fea01', -- ASSOF solicita 180 vagas (urgência)
  '9168985e-a9e6-4a64-a340-e24b64a26a62', -- ASSOF solicita novo edital 180 vagas
  'df632a0e-d165-4b78-8c5d-21f56c6c6739', -- cadastro de reserva 2º Ten QOS prorrogado
  -- PM-GO Soldado
  '8bd48d3e-ae5c-4c13-906b-8bfd3d8d5392', -- novo concurso é anunciado
  '54a4d813-e64e-46d6-9825-de453291278d', -- STF suspende convocações
  'dcd3f204-d1ba-4029-912f-5ab0f45c1b44', -- comando confirma estudos em andamento
  '77151fe8-14aa-4049-b501-a7a4711c3dad', -- nomeação de 299 soldados
  'd6381872-d173-416b-90d3-267061e57384', -- ASSOF solicita 180 vagas (urgência)
  -- TJ-GO Analista
  'fbe0c660-36f6-42e7-8d43-e43a04cd3b93', -- presidência autoriza tratativas
  -- Direção Concursos (PM-GO, os 2 cargos)
  'd90eac5c-5835-4ff5-bb82-9550911e8400', -- comandante-geral confirma discussões
  '7a5731e3-bfdb-4bda-81a4-ebf4a289fa1f'  -- comandante-geral confirma discussões
)
and url in (
  'https://blog.grancursosonline.com.br/concurso-pm-go/',
  'https://blog.grancursosonline.com.br/concurso-pm-go-solicitacao-180-vagas/',
  'https://blog.grancursosonline.com.br/concurso-tj-go/',
  'https://www.direcaoconcursos.com.br/noticias/concurso-pmgo-novo-edital-previsao-2026'
);

-- 4) Trava: edital_url só aceita domínio oficial (governo/judiciário/
-- legislativo/tribunal de contas ou banca organizadora). Vale para INSERT e
-- UPDATE, venham de onde vierem — a curadoria manual foi a primeira linha de
-- defesa, isto é o enforcement.
create or replace function public.is_official_edital_domain(url text)
returns boolean
language sql
immutable
as $$
  select url is null
    or url ~* '^https://([a-z0-9-]+\.)*(gov\.br|jus\.br|leg\.br|tc\.br|fgv\.br|fcc\.org\.br|institutoaocp\.org\.br|aocp\.com\.br|cebraspe\.org\.br|vunesp\.com\.br|fundatec\.org\.br|ibfc\.org\.br|iades\.com\.br|fepese\.org\.br|fumarc\.com\.br|idecan\.org\.br|quadrix\.org\.br|ibade\.org\.br)(/.*)?$'
$$;

alter table public.editais_catalog
  drop constraint if exists editais_catalog_edital_url_official_ck;
alter table public.editais_catalog
  add constraint editais_catalog_edital_url_official_ck
  check (public.is_official_edital_domain(edital_url));
