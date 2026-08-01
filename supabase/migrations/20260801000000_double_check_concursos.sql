-- Double check do módulo Concursos (31/07 → 01/08). Corrige o que a auditoria
-- ponta a ponta encontrou.

-- ── 1. Ativação duplicada quando o slug do alvo não bate com o do edital ───
-- `activate_catalog_edital` checava idempotência só por slug. Um alvo criado
-- por importação/legado (ex.: slug 'pmgo-oficialcadetecfo-2022') já vinculado
-- ao edital 'pm-go-oficial' passava batido: a página mostrava "Ativar edital"
-- em vez de "Abrir meu concurso" e o clique criava um SEGUNDO concurso do
-- mesmo cargo, com os tópicos duplicados na biblioteca do usuário.
-- Agora o vínculo explícito (catalog_edital_id) também conta.
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

  -- Idempotência: mesmo slug OU já vinculado a este edital do catálogo.
  select id into v_target_id from target_exams
  where user_id = v_user_id
    and (slug = v_edital.slug or catalog_edital_id = p_edital_id)
  order by (slug = v_edital.slug) desc
  limit 1;
  if v_target_id is not null then
    update target_exams set catalog_edital_id = p_edital_id
    where id = v_target_id and catalog_edital_id is null;
    return v_target_id;
  end if;

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

  -- Só os tópicos fiéis do edital (respeita a curadoria por edital).
  insert into topic_target_exams (topic_id, target_exam_id, incidencia)
  select t.id, v_target_id, coalesce(ect.incidencia, 0)
  from edital_catalog_topics ect
  join topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = v_user_id
  where ect.edital_catalog_id = p_edital_id
  on conflict do nothing;

  return v_target_id;
end;
$function$;

-- ── 2. Segurança das funções criadas hoje ──────────────────────────────────
-- search_path fixo: sem isso, um schema no caminho de busca do chamador pode
-- sequestrar a resolução de nomes dentro da função.
create or replace function public.is_official_edital_domain(url text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select url is null
    or url ~* '^https://([a-z0-9-]+\.)*(gov\.br|jus\.br|leg\.br|tc\.br|fgv\.br|fcc\.org\.br|institutoaocp\.org\.br|aocp\.com\.br|cebraspe\.org\.br|vunesp\.com\.br|fundatec\.org\.br|ibfc\.org\.br|iades\.com\.br|fepese\.org\.br|fumarc\.com\.br|idecan\.org\.br|quadrix\.org\.br|ibade\.org\.br|cesgranrio\.org\.br|bb\.com\.br|correios\.com\.br|ufg\.br)(/.*)?$'
$$;

create or replace function public.check_edital_request_quota()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select count(*) from public.edital_requests
      where user_id = new.user_id and status = 'pendente') >= 10 then
    raise exception 'Você já tem 10 pedidos aguardando — assim que atendermos algum, pode pedir mais.';
  end if;
  return new;
end $$;

create or replace function public.follow_on_request_atendido()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status = 'atendido'
     and new.atendido_edital_id is not null
     and (old.status is distinct from 'atendido' or old.atendido_edital_id is distinct from new.atendido_edital_id) then
    insert into public.edital_follows (user_id, edital_catalog_id)
    values (new.user_id, new.atendido_edital_id)
    on conflict (user_id, edital_catalog_id) do nothing;
  end if;
  return new;
end;
$$;

-- Funções de gatilho não são API: ninguém deve poder chamá-las via /rpc.
revoke execute on function public.follow_on_request_atendido() from anon, authenticated;
revoke execute on function public.check_edital_request_quota() from anon, authenticated;

-- ── 3. Bucket dos editais: servir sim, listar não ──────────────────────────
-- A policy ampla de SELECT em storage.objects deixava qualquer cliente LISTAR
-- todos os arquivos do bucket. Bucket público não precisa dela para servir o
-- objeto por URL — verificado após a remoção: os PDFs seguem respondendo 200
-- com assinatura %PDF-, e a API de list passou a exigir autorização.
drop policy if exists "editais oficiais leitura publica" on storage.objects;
