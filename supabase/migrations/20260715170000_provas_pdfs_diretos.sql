-- Auditoria de dados (parte 2, 15/07/2026): páginas do Qconcursos retornam
-- 403 para robôs (Cloudflare) — troca por PDFs diretos de
-- arquivos.qconcursos.com, todos verificados com HTTP 200 em 15/07/2026.
-- A prova do TJ-GO Juiz 2026 permanece como página (não há PDF direto
-- público localizável); a do Escrivão PC-GO segue ausente (nenhuma URL
-- verificável encontrada — conteúdo era idêntico ao de Agente).

update public.edital_past_papers set
  prova_url = 'https://arquivos.qconcursos.com/prova/arquivo_prova/89883/instituto-aocp-2022-pc-go-agente-de-policia-prova.pdf'
where concurso_key = 'pc-go-agente' and ano = 2022;

update public.edital_past_papers set
  prova_url = 'https://arquivos.qconcursos.com/prova/arquivo_prova/90355/instituto-aocp-2022-pc-go-papiloscopista-policial-da-3-classe-prova.pdf',
  gabarito_url = 'https://arquivos.qconcursos.com/prova/arquivo_gabarito/90355/instituto-aocp-2022-pc-go-papiloscopista-policial-da-3-classe-gabarito.pdf'
where concurso_key = 'pc-go-papiloscopista' and ano = 2022;

update public.edital_past_papers set
  prova_url = 'https://arquivos.qconcursos.com/prova/arquivo_prova/88985/instituto-aocp-2022-pm-go-aspirante-da-policia-militar-prova.pdf',
  gabarito_url = 'https://arquivos.qconcursos.com/prova/arquivo_gabarito/88985/instituto-aocp-2022-pm-go-aspirante-da-policia-militar-gabarito.pdf'
where concurso_key = 'pm-go-oficial' and ano = 2022;
