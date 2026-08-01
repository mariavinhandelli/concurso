-- CORRIGE: "erro ao ativar edital: function unaccent(text) does not exist"
-- (reproduzido ao ativar o edital da PM-GO em 01/08/2026)
--
-- CAUSA RAIZ
-- A extensão unaccent vive no schema `extensions` (padrão do Supabase), mas
-- `activate_catalog_subject` roda com `search_path = public, pg_temp` — fixado
-- de propósito pelo hardening de SECURITY DEFINER — e chamava `unaccent(...)`
-- SEM qualificar o schema. Resolução de nome falha, função aborta, a ativação
-- inteira faz rollback. Reproduzível fora da função:
--   set search_path to 'public','pg_temp'; select unaccent('ação');
--   → ERROR 42883: function unaccent(unknown) does not exist
--
-- QUANDO QUEBROU
-- Na migration 20260729000811 (activate_catalog_subject_adopt_by_name, 29/07),
-- que introduziu a adoção de matéria por nome. Antes disso a função não citava
-- unaccent. ⚠️ Essa migration foi aplicada direto no banco e NUNCA virou arquivo
-- em supabase/migrations/ — por isso nenhuma busca no repositório encontrava o
-- `unaccent` cru. O corpo abaixo é o estado real do banco, já corrigido.
--
-- POR QUE NÃO FALHAVA SEMPRE
-- A função só chega no unaccent quando o usuário AINDA NÃO tem a matéria
-- vinculada ao catálogo — ou seja, exatamente ao ativar um edital novo com
-- matéria ainda não adotada. Ativar um edital já vinculado retornava antes.
--
-- CORREÇÃO
-- Usa `public.immutable_unaccent`, que já existe, é IMMUTABLE, qualifica o
-- schema internamente e — decisivo — é EXATAMENTE a expressão do índice único
-- `subjects_user_name_unique (user_id, lower(trim(immutable_unaccent(name))))`.
-- Com `unaccent` cru, mesmo que resolvesse, a comparação não casaria com o
-- índice (seq scan) nem com a regra de unicidade. É também o que
-- `activate_catalog_flashcard_deck` já usava — as duas rotas de ativação
-- passam a normalizar nome do mesmo jeito.

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

  -- Adoção por nome: reaproveita a matéria manual equivalente em vez de criar
  -- uma gêmea. immutable_unaccent (e não unaccent) — ver cabeçalho.
  select id into v_subject_id
  from subjects
  where user_id = v_user_id
    and catalog_id is null
    and lower(trim(public.immutable_unaccent(name))) = lower(trim(public.immutable_unaccent(v_catalog_name)))
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
      and lower(trim(public.immutable_unaccent(t.name))) = lower(trim(public.immutable_unaccent(r_parent.name)))
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
        and lower(trim(public.immutable_unaccent(t2.name))) = lower(trim(public.immutable_unaccent(tc.name)))
    );

  update topics t3 set catalog_id = tc.id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null
    and t3.subject_id = v_subject_id and t3.parent_id = m.new_topic_id
    and t3.catalog_id is null
    and lower(trim(public.immutable_unaccent(t3.name))) = lower(trim(public.immutable_unaccent(tc.name)));

  return v_subject_id;
end;
$function$;

-- Mantém a régua da migration 20260801120000: revogar de PUBLIC é o que vale.
revoke execute on function public.activate_catalog_subject(uuid) from public, anon;
grant  execute on function public.activate_catalog_subject(uuid) to authenticated;
