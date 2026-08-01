-- ⚠️ ESTADO HISTÓRICO — NÃO COPIE O `unaccent(...)` CRU DAQUI.
-- Esta é a migration, tal como foi aplicada em 29/07/2026, que introduziu a
-- adoção de matéria por nome. Ela chama `unaccent(...)` sem qualificar o schema
-- dentro de uma função com `search_path = public, pg_temp`. Funcionava enquanto a
-- extensão unaccent morava em `public`; 15 minutos depois a migration
-- 20260729002329_move_unaccent_out_of_public a moveu para `extensions` e as três
-- rotas de ativação (edital, deck de flashcards, matéria de catálogo) passaram a
-- falhar com "function unaccent(text) does not exist".
-- Corrigido em 20260802090000_fix_activate_catalog_subject_unaccent.sql, que usa
-- public.immutable_unaccent (também a expressão do índice subjects_user_name_unique).

create extension if not exists unaccent;

-- Antes de criar uma matéria nova a partir do catálogo, adota uma matéria própria
-- já existente com nome equivalente (ignorando acento/caixa) em vez de duplicar.
-- Mesma lógica aplicada aos tópicos de topo e de 2º nível: reaproveita por nome,
-- só cria os que realmente faltam. Sem isso, cada ativação de edital/deck criava
-- uma matéria+árvore de tópicos paralela sempre que o usuário já tinha a matéria manual.
create or replace function public.activate_catalog_subject(p_catalog_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_subject_id uuid;
  v_pos        integer;
  v_catalog_name text;
  r_parent     record;
  v_new_parent uuid;
  v_existing_child uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select id into v_subject_id
  from subjects
  where user_id = v_user_id and catalog_id = p_catalog_id
  limit 1;

  if v_subject_id is not null then
    update subjects set status = 'ativo'
    where id = v_subject_id and status = 'arquivado';
    return v_subject_id;
  end if;

  select sc.name into v_catalog_name from subjects_catalog sc where sc.id = p_catalog_id;
  if v_catalog_name is null then
    raise exception 'Matéria de catálogo não encontrada: %', p_catalog_id;
  end if;

  select id into v_subject_id
  from subjects
  where user_id = v_user_id
    and catalog_id is null
    and lower(trim(unaccent(name))) = lower(trim(unaccent(v_catalog_name)))
  order by created_at
  limit 1;

  if v_subject_id is not null then
    update subjects set catalog_id = p_catalog_id, status = 'ativo'
    where id = v_subject_id;
  else
    select coalesce(max(position), 0) + 1 into v_pos
    from subjects where user_id = v_user_id;

    insert into subjects (user_id, name, position, catalog_id, status)
    values (v_user_id, v_catalog_name, v_pos, p_catalog_id, 'ativo')
    returning id into v_subject_id;
  end if;

  create temp table if not exists _map (catalog_topic_id uuid, new_topic_id uuid) on commit drop;
  truncate _map;

  for r_parent in
    select id, name, position
    from topics_catalog
    where subject_catalog_id = p_catalog_id and parent_id is null
    order by position
  loop
    select t.id into v_existing_child
    from topics t
    where t.subject_id = v_subject_id and t.parent_id is null
      and lower(trim(unaccent(t.name))) = lower(trim(unaccent(r_parent.name)))
    limit 1;

    if v_existing_child is not null then
      update topics set catalog_id = r_parent.id where id = v_existing_child and catalog_id is null;
      v_new_parent := v_existing_child;
    else
      insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
      values (v_user_id, v_subject_id, r_parent.name, r_parent.position, r_parent.id, null)
      returning id into v_new_parent;
    end if;

    insert into _map values (r_parent.id, v_new_parent);
  end loop;

  insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
  select v_user_id, v_subject_id, tc.name, tc.position, tc.id, m.new_topic_id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null
    and not exists (
      select 1 from topics t2
      where t2.subject_id = v_subject_id and t2.parent_id = m.new_topic_id
        and lower(trim(unaccent(t2.name))) = lower(trim(unaccent(tc.name)))
    );

  update topics t3 set catalog_id = tc.id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null
    and t3.subject_id = v_subject_id and t3.parent_id = m.new_topic_id
    and t3.catalog_id is null
    and lower(trim(unaccent(t3.name))) = lower(trim(unaccent(tc.name)));

  return v_subject_id;
end;
$function$;
