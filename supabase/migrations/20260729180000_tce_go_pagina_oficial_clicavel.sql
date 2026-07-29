-- A migration editais_official_sources_only zerou edital_url do TCE-GO com a
-- justificativa correta: "sem PDF real, o botão 'Baixar edital' não deve
-- renderizar". Agora o rótulo é condicional (PDF → "Baixar edital (PDF)";
-- página → "Página oficial do concurso"), então a objeção está resolvida e o
-- link volta — deixar a URL só como texto no aviso obrigava o usuário a
-- copiar e colar para chegar na única ação útil de um concurso em expectativa.
update public.editais_catalog
set edital_url = 'https://portal.tce.go.gov.br/concursos'
where slug = 'tce-go-tecnico-controle-externo'
  and edital_url is null;
