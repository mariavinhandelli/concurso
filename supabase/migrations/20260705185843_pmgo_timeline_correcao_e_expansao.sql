-- Correção e expansão da linha do tempo PM-GO com base na página real
-- (blog.grancursosonline.com.br/concurso-pm-go/, fornecida pela usuária) +
-- verificação cruzada via busca. Dois erros meus corrigidos:
-- (1) reajuste salarial datado 19/01/2026 — na verdade a Assembleia aprovou
--     em 16/01/2025 (confirmado por al.go.leg.br);
-- (2) "planejamento fase inicial" datado 01/02/2024 — a data real e mais
--     específica é 04/03/2024 ("estudos em andamento").
-- Homologação do resultado final também estava com a data do cronograma
-- ORIGINAL do edital (13/03/2023), que foi adiada por retificações reais
-- (confirmado: SEAD publicou resultado final 31/03/2023, edital de
-- homologação 26/04/2023; a fonte fornecida cita 12/04/2023 — usamos essa
-- por ser a mais granular, dentro da mesma janela confirmada por outra fonte).
--
-- ⚠️ Os ids abaixo são de linhas geradas por gen_random_uuid() na execução
-- original desta migration — reproduzir do zero em outro banco não encontra
-- essas linhas e o delete simplesmente não afeta nada (no-op seguro).

delete from public.edital_updates where id in (
  '59f91b78-2c13-4dc4-bfa7-81fcf4a18a08', -- Soldado: planejamento fase inicial (data errada)
  '85d8f8a1-9a36-4846-b000-2926b7480ecd', -- Soldado: reajuste (ano errado)
  'ffbcaaa5-e31f-4835-a220-e421263e22af', -- Oficial: planejamento fase inicial (data errada)
  'f4b9209b-8fc3-4ae2-9231-9f77509f3bb1', -- Oficial: reajuste (ano errado)
  '4e93110f-ba5b-412d-904e-d633f8365d6f'  -- Oficial: homologação com data do cronograma original, substituída abaixo
);

-- Eventos comuns às duas edições (retificações, MP, STF, resultado final,
-- reajuste, próximo edital) — inseridos nos dois catálogos.
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select id, tipo, titulo, url, published_at
from (values
  ('retificacao', 'Edital retificado (1ª retificação)', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-04-17'),
  ('retificacao', 'Publicada a 2ª retificação do edital', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-05-30'),
  ('aviso',       'Ministério Público recomenda retificação no edital', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-07-05'),
  ('aviso',       'SEAD confirma que as provas não serão anuladas', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-07-14'),
  ('aviso',       'Ministério Público pede suspensão do concurso por desrespeito às vagas de PCD', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-08-05'),
  ('retificacao', 'Retificação traz nova previsão de datas para nomeação', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2022-11-17'),
  ('resultado',   'Resultado e classificação (preliminar)', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2023-03-08'),
  ('resultado',   'Resultado final: candidatos classificados e cadastro de reserva', 'https://goias.gov.br/administracao/publicado-resultado-final-para-soldado-da-pmgo/', date '2023-04-04'),
  ('resultado',   'Homologação do resultado final', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2023-04-12'),
  ('aviso',       'STF suspende convocações por limitação no número de vagas para mulheres', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2023-12-15'),
  ('noticia',     'Novo concurso da PM-GO é anunciado', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2023-10-09'),
  ('noticia',     'Comando confirma que estudos para o novo edital estão em andamento', 'https://blog.grancursosonline.com.br/concurso-pm-go/', date '2024-03-04'),
  ('noticia',     'Assembleia Legislativa de Goiás aprova reajuste salarial da PM-GO', 'https://portal.al.go.leg.br/noticias/151168/casa-aprova-data-base-e-mudancas-em-carreiras-do-executivo', date '2025-01-16')
) as ev(tipo, titulo, url, published_at)
cross join (values ('e0000000-0000-4000-8000-000000000002'::uuid), ('e0000000-0000-4000-8000-000000000003'::uuid)) as e(id);

-- Eventos específicos do cargo de Soldado (002)
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at) values
  ('e0000000-0000-4000-8000-000000000002', 'noticia',   'Divulgado o deferimento das inscrições do cargo de Soldado', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2022-06-15'),
  ('e0000000-0000-4000-8000-000000000002', 'resultado', 'Gabarito preliminar do cargo de Soldado', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2022-07-11'),
  ('e0000000-0000-4000-8000-000000000002', 'resultado', 'Resultado preliminar das provas de Soldado', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2022-08-04'),
  ('e0000000-0000-4000-8000-000000000002', 'noticia',   'Anunciada a nomeação de 299 soldados de 2ª classe (cadastro de reserva de 2022)', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2025-03-06');

-- Eventos específicos do cargo de Cadete/2º Tenente (003)
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at) values
  ('e0000000-0000-4000-8000-000000000003', 'resultado', 'Gabarito preliminar do cargo de Cadete', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2022-07-18'),
  ('e0000000-0000-4000-8000-000000000003', 'resultado', 'Gabarito preliminar do cargo de 2º Tenente QOS', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2022-07-26'),
  ('e0000000-0000-4000-8000-000000000003', 'aviso',     'Cadastro de reserva do 2º Tenente QOS (Médico/Odontológico) prorrogado até 2027 — NÃO se aplica ao cargo de Cadete', 'https://blog.grancursosonline.com.br/concurso-pm-go/', '2025-04-23');

-- Atualiza o resumo (aviso) de cada edital com os fatos reais mais recentes.
update public.editais_catalog set aviso =
  'Última edição (2022): dados oficiais do Edital nº 002/2022. O cadastro de reserva ainda gerou nomeações em 2025 (299 soldados em março/2025), mas o concurso segue com convocações suspensas pelo STF desde dez/2023 por limitação de vagas femininas. Novo edital em discussão desde 2023 — ASSOF pediu 180 vagas para Oficial (mar/2025) e a Assembleia aprovou reajuste salarial da corporação (jan/2025). Sem banca, vagas ou data definidas para a próxima edição.'
where id = 'e0000000-0000-4000-8000-000000000002';

update public.editais_catalog set aviso =
  'Edital nº 003/2022 (distinto do de Soldado). Vagas e conteúdo aqui referem-se ao cargo de Cadete (bacharel em Direito) — não inclui as 50 vagas de 2º Tenente QOS (Médico/Odontológico/Psicólogo), fora do escopo de disciplinas do catálogo. Remuneração progressiva: Cadete 1º ano R$ 8.433,73 → 2º ano R$ 9.136,54 → 3º ano R$ 10.542,16 → Aspirante R$ 12.052,99 → 2º Tenente R$ 13.901,60. Em abr/2025 o cadastro de reserva do 2º Tenente QOS (Médico/Odontológico) foi prorrogado até 2027 — não há confirmação de prorrogação equivalente para o cadastro de Cadete, provavelmente já encerrado. Novo edital em discussão desde 2023 — ASSOF pediu 180 vagas para Oficial (mar/2025), sem banca, vagas ou data definidas para a próxima edição.'
where id = 'e0000000-0000-4000-8000-000000000003';
