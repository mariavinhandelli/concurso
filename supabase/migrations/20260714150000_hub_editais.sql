-- Hub de Editais (Fases 1+2)
-- O catálogo de editais vira entidade inteligente: edições agrupadas por
-- concurso (concurso_key), UF, diff estruturado de retificações, estatísticas
-- históricas (nota de corte / nomeações), provas anteriores e incidência
-- curada por tópico. Tudo aditivo — nenhuma tabela existente muda de shape
-- de forma incompatível. Regra de dados: colunas novas são NULLABLE e a UI
-- só mostra o que foi curado com dado real (nunca inventa número).

-- 1) editais_catalog: UF e agrupador de edições do mesmo concurso
alter table public.editais_catalog
  add column if not exists uf text,
  add column if not exists concurso_key text;

-- Toda linha existente é a (única) edição do próprio concurso.
update public.editais_catalog set concurso_key = slug where concurso_key is null;

-- Curadoria factual: os 3 editais atuais são de órgãos de Goiás.
update public.editais_catalog set uf = 'GO' where uf is null and orgao in ('TCE-GO', 'PM-GO');

-- 2) edital_updates: diff estruturado e curado de retificações.
-- Formato: {"campos": [{"campo","antes","depois"}], "conteudo": [{"disciplina","adicionados":[],"removidos":[]}]}
alter table public.edital_updates
  add column if not exists changes jsonb;

-- 3) edital_catalog_topics: incidência curada (nº de cobranças em provas reais).
-- NULL = sem dado de banca; a UI não mostra nada (nunca finge frequência).
alter table public.edital_catalog_topics
  add column if not exists incidencia int;

-- 4) Estatísticas históricas do concurso, por ano (quando disponíveis)
create table if not exists public.edital_concurso_stats (
  id uuid primary key default gen_random_uuid(),
  concurso_key text not null,
  ano int not null,
  inscritos int,
  vagas int,
  nota_corte numeric,
  nomeados int,
  fonte_url text,
  created_at timestamptz not null default now(),
  unique (concurso_key, ano)
);
alter table public.edital_concurso_stats enable row level security;
drop policy if exists "read edital_concurso_stats" on public.edital_concurso_stats;
create policy "read edital_concurso_stats" on public.edital_concurso_stats
  for select to authenticated using (true);
create index if not exists idx_edital_concurso_stats_key
  on public.edital_concurso_stats (concurso_key, ano desc);

-- 5) Provas anteriores (links oficiais — nada de questão inventada)
create table if not exists public.edital_past_papers (
  id uuid primary key default gen_random_uuid(),
  concurso_key text not null,
  ano int not null,
  banca text,
  prova_url text not null,
  gabarito_url text,
  created_at timestamptz not null default now()
);
alter table public.edital_past_papers enable row level security;
drop policy if exists "read edital_past_papers" on public.edital_past_papers;
create policy "read edital_past_papers" on public.edital_past_papers
  for select to authenticated using (true);
create index if not exists idx_edital_past_papers_key
  on public.edital_past_papers (concurso_key, ano desc);

-- 6) activate_catalog_edital v3: além de matérias/pesos/tópicos, copia a
-- incidência curada do catálogo para topic_target_exams.incidencia (que
-- existia desde a v1, mas nunca era preenchida).
create or replace function public.activate_catalog_edital(p_edital_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_edital  record;
  v_target_id uuid;
  v_board_id uuid;
  v_phase exam_phase := 'pre';
  r_subj record;
  v_subject_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_edital from editais_catalog where id = p_edital_id and is_active;
  if v_edital is null then
    raise exception 'Edital não encontrado: %', p_edital_id;
  end if;

  -- idempotência: já ativou este edital? retorna o alvo existente (unique user_id, slug)
  select id into v_target_id from target_exams
  where user_id = v_user_id and slug = v_edital.slug limit 1;
  if v_target_id is not null then
    -- garante o vínculo com o catálogo em alvos criados antes da v2
    update target_exams set catalog_edital_id = p_edital_id
    where id = v_target_id and catalog_edital_id is null;
    return v_target_id;
  end if;

  -- edital vigente: a banca do catálogo vira exam_board do usuário (find-or-create)
  if v_edital.situacao = 'vigente' and v_edital.banca is not null then
    select id into v_board_id from exam_boards
    where user_id = v_user_id and lower(name) = lower(v_edital.banca) limit 1;
    if v_board_id is null then
      insert into exam_boards (user_id, name)
      values (v_user_id, v_edital.banca)
      returning id into v_board_id;
    end if;
    v_phase := 'pos';
  end if;

  insert into target_exams (user_id, orgao, cargo, ano_alvo, exam_date, slug, phase, board_id, catalog_edital_id)
  values (v_user_id, v_edital.orgao, v_edital.cargo, v_edital.ano, v_edital.exam_date, v_edital.slug, v_phase, v_board_id, p_edital_id)
  returning id into v_target_id;

  -- ativa cada matéria do edital e grava o peso da disciplina
  for r_subj in
    select subject_catalog_id, weight, num_questions_expected
    from edital_catalog_subjects
    where edital_catalog_id = p_edital_id
    order by position
  loop
    v_subject_id := activate_catalog_subject(r_subj.subject_catalog_id);

    insert into exam_blueprints (user_id, target_exam_id, subject_id, weight, num_questions_expected)
    values (v_user_id, v_target_id, v_subject_id, r_subj.weight, r_subj.num_questions_expected)
    on conflict (target_exam_id, subject_id)
    do update set weight = excluded.weight, num_questions_expected = excluded.num_questions_expected;
  end loop;

  -- vincula ao alvo somente os tópicos fiéis do edital (subconjunto oficial),
  -- levando junto a incidência curada quando existir
  insert into topic_target_exams (topic_id, target_exam_id, incidencia)
  select t.id, v_target_id, coalesce(ect.incidencia, 0)
  from edital_catalog_topics ect
  join topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = v_user_id
  where ect.edital_catalog_id = p_edital_id
  on conflict do nothing;

  return v_target_id;
end;
$function$;
