-- FIX: a função tinha SET search_path TO '' mas o corpo usa nomes não-qualificados,
-- resultando em 'relation "subjects" does not exist'. Trocado para um search_path
-- explícito e fixo (public, pg_temp) — seguro (não-mutável) e resolve tabelas + temp.
-- Também torna a _map re-chamável na mesma transação (necessário para o loop do edital).
--
-- ⚠️ NOTA (01/08/2026): esta linhagem de correção é a origem da armadilha que
-- quebrou a ativação de edital em 29/07 — search_path fixo em 'public' + corpo
-- não-qualificado funciona até alguém mover uma extensão para fora de `public`.
-- Ver 20260729002329_move_unaccent_out_of_public.sql e a correção final em
-- 20260802090000_fix_activate_catalog_subject_unaccent.sql.
create or replace function public.activate_catalog_subject(p_catalog_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public, pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_subject_id uuid;
  v_pos        integer;
  r_parent     record;
  v_new_parent uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- idempotência: já ativou? retorna (e reativa se estava arquivada)
  select id into v_subject_id
  from subjects
  where user_id = v_user_id and catalog_id = p_catalog_id
  limit 1;

  if v_subject_id is not null then
    update subjects set status = 'ativo'
    where id = v_subject_id and status = 'arquivado';
    return v_subject_id;
  end if;

  select coalesce(max(position), 0) + 1 into v_pos
  from subjects where user_id = v_user_id;

  insert into subjects (user_id, name, position, catalog_id, status)
  select v_user_id, sc.name, v_pos, sc.id, 'ativo'
  from subjects_catalog sc
  where sc.id = p_catalog_id
  returning id into v_subject_id;

  if v_subject_id is null then
    raise exception 'Matéria de catálogo não encontrada: %', p_catalog_id;
  end if;

  -- mapa catálogo->novo para religar filhos aos pais recém-criados
  create temp table if not exists _map (catalog_topic_id uuid, new_topic_id uuid) on commit drop;
  truncate _map;

  for r_parent in
    select id, name, position
    from topics_catalog
    where subject_catalog_id = p_catalog_id and parent_id is null
    order by position
  loop
    insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
    values (v_user_id, v_subject_id, r_parent.name, r_parent.position, r_parent.id, null)
    returning id into v_new_parent;

    insert into _map values (r_parent.id, v_new_parent);
  end loop;

  insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
  select v_user_id, v_subject_id, tc.name, tc.position, tc.id, m.new_topic_id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null;

  return v_subject_id;
end;
$function$;
