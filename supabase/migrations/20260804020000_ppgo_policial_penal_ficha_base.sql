-- Polícia Penal-GO — Policial Penal (Edital 02/2024, IBFC). Bootstrap
-- completo: o registro em editais_catalog existia como placeholder (zero
-- matéria vinculada). Fontes: edital retificado (CDN oficial selecao.net),
-- Anexo IV — Conteúdos Programáticos, prova objetiva 15/09/2024 (qconcursos,
-- verificado HTTP 200), gabarito definitivo.
--
-- Estrutura da prova (item 9.1.1 do edital):
--   Conhecimentos Gerais (25q): Língua Portuguesa(10), Conhecimentos
--   Regionais(5), Raciocínio Lógico(5), Ética no Serviço Público(5),
--   Informática(5).
--   Conhecimentos Específicos (50q, SEM split divulgado por matéria):
--   Direito Administrativo, Direito Constitucional, Direito Penal, Direito
--   Processual Penal, Direitos Humanos, Legislação Penal Especial
--   ("Legislação Penal Extravagante" no edital — mesmo conteúdo já
--   catalogado), Legislação Específica (matéria nova: LEP + lei estadual).
--
-- "Legislação Penal Extravagante" do PP-GO cita as MESMAS 8 leis já em
-- Legislação Penal Especial (racismo, hediondos, tortura, desarmamento,
-- Maria da Penha, drogas, org. criminosa, abuso de autoridade) — reaproveita
-- a matéria em vez de duplicar.
update public.editais_catalog
set
  edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2024/07/020724-Edital00224-PP.pdf',
  vagas = 1600,
  remuneracao = 5971.42,
  ano = 2024,
  verificado_em = '2026-08-03',
  aviso = 'Concurso 2024 (1.600 vagas, IBFC) em fase de convocações — mais 400 aprovados chamados em 2026. Novo edital sem previsão oficial; acompanhe o site da Polícia Penal.'
where slug = 'policia-penal-go-policial';

do $$
declare
  v_edital uuid;
  v_lp uuid; v_regionais uuid; v_raciocinio uuid; v_etica uuid; v_info uuid;
  v_dadm uuid; v_dconst uuid; v_dpenal uuid; v_dpp uuid; v_dh uuid; v_lpe uuid;
  v_legesp uuid;
begin
  select id into v_edital from public.editais_catalog where slug = 'policia-penal-go-policial';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  select id into v_lp from public.subjects_catalog where name = 'Língua Portuguesa';
  select id into v_regionais from public.subjects_catalog where name = 'Conhecimentos Regionais';
  select id into v_raciocinio from public.subjects_catalog where name = 'Raciocínio Lógico-Matemático';
  select id into v_etica from public.subjects_catalog where name = 'Ética no Serviço Público';
  select id into v_info from public.subjects_catalog where name = 'Informática';
  select id into v_dadm from public.subjects_catalog where name = 'Direito Administrativo';
  select id into v_dconst from public.subjects_catalog where name = 'Direito Constitucional';
  select id into v_dpenal from public.subjects_catalog where name = 'Direito Penal';
  select id into v_dpp from public.subjects_catalog where name = 'Direito Processual Penal';
  select id into v_dh from public.subjects_catalog where name = 'Direitos Humanos';
  select id into v_lpe from public.subjects_catalog where name = 'Legislação Penal Especial';

  -- Matéria nova: Legislação Específica (LEP + lei estadual de faltas disciplinares)
  insert into public.subjects_catalog (name)
  select 'Legislação Específica'
  where not exists (select 1 from public.subjects_catalog where name = 'Legislação Específica')
  returning id into v_legesp;
  if v_legesp is null then
    select id into v_legesp from public.subjects_catalog where name = 'Legislação Específica';
  end if;

  insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, num_questions_expected)
  values
    (v_edital, v_lp, 10),
    (v_edital, v_regionais, 5),
    (v_edital, v_raciocinio, 5),
    (v_edital, v_etica, 5),
    (v_edital, v_info, 5),
    (v_edital, v_dadm, null),
    (v_edital, v_dconst, null),
    (v_edital, v_dpenal, null),
    (v_edital, v_dpp, null),
    (v_edital, v_dh, null),
    (v_edital, v_lpe, null),
    (v_edital, v_legesp, null)
  on conflict (edital_catalog_id, subject_catalog_id) do update set num_questions_expected = excluded.num_questions_expected;
end $$;

do $$
declare v int;
begin
  select count(*) into v from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'policia-penal-go-policial';
  if v <> 12 then raise exception 'esperado 12 matérias vinculadas, achei %', v; end if;

  select count(*) into v from public.edital_catalog_subjects ecs
  join public.editais_catalog e on e.id = ecs.edital_catalog_id and e.slug = 'policia-penal-go-policial'
  where ecs.num_questions_expected is not null;
  if v <> 5 then raise exception 'esperado 5 matérias com contagem fixa (Conhecimentos Gerais), achei %', v; end if;

  select count(*) into v from public.subjects_catalog where name = 'Legislação Específica';
  if v <> 1 then raise exception 'Legislação Específica deveria existir uma única vez, achei %', v; end if;
end $$;
