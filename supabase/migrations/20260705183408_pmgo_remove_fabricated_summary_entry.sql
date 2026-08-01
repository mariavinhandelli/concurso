-- Remove a entrada anterior: não é uma notícia datada real, é um resumo de
-- status. O resumo de status já vive no campo aviso do edital (atualizado
-- na migração anterior); a linha do tempo deve conter só eventos com data real.
delete from public.edital_updates
where edital_catalog_id = 'e0000000-0000-4000-8000-000000000002'
  and titulo = 'Novo edital ainda sem data, banca ou nº de vagas definidos — previsão de estruturação ao longo de 2026';
