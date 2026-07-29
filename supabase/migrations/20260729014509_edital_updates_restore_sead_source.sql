-- Corrige uma corrida com outra migration concorrente (fontes_oficiais_editais,
-- aplicada segundos antes desta por outra sessão): ela zerou url em TODAS as
-- linhas de cursinho, inclusive as 21 que esta migration ia trocar pela
-- página viva da SEAD (não por null) — a condição "and url = '...grancurso...'"
-- não bateu mais porque a outra migration já tinha limpado o valor. Repara
-- por id, sem depender do valor anterior.
update public.edital_updates
set url = 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/'
where id in (
  '4935ba98-0cc5-4cb1-aa88-eb49cacfc8ba',
  '50c189c1-07f9-4c3b-a445-40f5ec9b6724',
  'b8fd5b72-4db7-48e0-b40e-9811aeb23154',
  'a9c5420b-159d-406f-9c53-78eb42abb15e',
  '1e52f8d5-907f-487a-bbaa-4554afb31687',
  'afca5e36-d930-4188-89f3-714b1320ca9d',
  '8d30f1ff-7352-4a11-879f-b3c03f968d7e',
  '36160eb8-cca7-4bc7-914b-e23c110c9790',
  'c423e952-c59f-4470-9bfc-1a3b296592c8',
  '2f0df4a9-26b0-478c-b582-44792be1ca62'
)
and url is null;

update public.edital_updates
set url = 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/'
where id in (
  'f99f25e6-cbfe-4058-95e6-c497f07eae26',
  '8a1876fd-d1bd-4715-9469-622960da1c29',
  '5bdd7d60-5141-4296-9469-6d253238e773',
  '33d5225f-e5a6-44f3-9622-7a1871926c05',
  '65b5a69b-ad49-4887-8f61-2f3537d3880c',
  '1638efca-330d-429c-a00f-5294dca6c5ef',
  '4b2115da-0a0f-49cc-96f0-eddb451ca84b',
  '85975c45-4891-41f3-b389-6147b02c2c7c',
  '5d613ecb-ea8e-41e4-b28d-b9e5f0281e2b',
  '986523a5-1348-4fe8-8bb9-64684dadced9',
  '8fe8f53a-a110-4fa1-8fab-f89807f80847'
)
and url is null;
