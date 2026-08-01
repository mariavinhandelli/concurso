-- Atualiza a linha do tempo do PM-GO com a situação REAL mais recente
-- (fontes: Direção Concursos, Gran Cursos, Estratégia Concursos — jul/2026).
-- Mantém o histórico da edição 2022 e adiciona os marcos de 2024-2026 sobre
-- o próximo edital em discussão.
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at) values
  ('e0000000-0000-4000-8000-000000000002', 'noticia', 'Coronel Durvalino Câmara indica planejamento em fase inicial para novo concurso', 'https://www.estrategiaconcursos.com.br/blog/concurso-pm-go/', '2024-02-01'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia', 'ASSOF solicita, em caráter de urgência, 180 vagas para Oficial em novo edital', 'https://blog.grancursosonline.com.br/concurso-pm-go-solicitacao-180-vagas/', '2025-03-20'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia', 'Comandante-geral confirma discussões para novo certame ("a PM tem que estar presente nos 246 municípios")', 'https://www.direcaoconcursos.com.br/noticias/concurso-pmgo-novo-edital-previsao-2026', '2025-10-10'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia', 'Governo anuncia reajuste salarial de 25,6% para a corporação', 'https://www.direcaoconcursos.com.br/noticias/concurso-pm-go-reajuste-anunciado', '2026-01-19'),
  ('e0000000-0000-4000-8000-000000000002', 'aviso', 'Novo edital ainda sem data, banca ou nº de vagas definidos — previsão de estruturação ao longo de 2026', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2026-07-05')
on conflict do nothing;

update public.editais_catalog set
  aviso = 'Última edição (2022): dados oficiais do Edital nº 002/2022. Novo edital em discussão desde 2025 — ASSOF pediu 180 vagas para Oficial (mar/2025), comando confirmou estudos (out/2025) e o governo anunciou reajuste de 25,6% (jan/2026). Sem banca, vagas ou data definidas para a próxima edição.'
where id = 'e0000000-0000-4000-8000-000000000002';
