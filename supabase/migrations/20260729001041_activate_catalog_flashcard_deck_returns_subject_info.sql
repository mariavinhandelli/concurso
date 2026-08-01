-- A UI precisa saber que a ativação de um deck também ativou/adotou uma matéria,
-- para não pegar o usuário de surpresa quando uma matéria nova aparece em
-- "Minhas Matérias". A RPC passa a devolver jsonb com subject_id/name e a flag
-- subject_was_new (a matéria não existia antes desta ativação).
drop function public.activate_catalog_flashcard_deck(uuid);

create function public.activate_catalog_flashcard_deck(p_deck_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_deck       record;
  v_subject_id uuid;
  v_inserted   integer := 0;
  v_subject_catalog_name text;
  v_subject_name text;
  v_pre_existing boolean;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_deck from flashcard_deck_catalog where id = p_deck_id and is_active;
  if v_deck is null then
    raise exception 'Deck de catálogo não encontrado: %', p_deck_id;
  end if;

  if v_deck.subject_catalog_id is null then
    raise exception 'Deck sem matéria de catálogo associada';
  end if;

  select sc.name into v_subject_catalog_name from subjects_catalog sc where sc.id = v_deck.subject_catalog_id;

  select exists(
    select 1 from subjects s
    where s.user_id = v_user_id
      and (
        s.catalog_id = v_deck.subject_catalog_id
        or (s.catalog_id is null and lower(trim(immutable_unaccent(s.name))) = lower(trim(immutable_unaccent(v_subject_catalog_name))))
      )
  ) into v_pre_existing;

  v_subject_id := activate_catalog_subject(v_deck.subject_catalog_id);

  insert into flashcards (user_id, subject_id, topic_id, front, back, catalog_card_id, is_review_active)
  select v_user_id, v_subject_id, t.id, cc.front, cc.back, cc.id, true
  from flashcard_catalog_cards cc
  left join topics t on t.user_id = v_user_id and t.catalog_id = cc.topic_catalog_id
  where cc.deck_catalog_id = p_deck_id
    and not exists (
      select 1 from flashcards f
      where f.user_id = v_user_id and f.catalog_card_id = cc.id
    )
  on conflict (user_id, catalog_card_id) where catalog_card_id is not null do nothing;

  get diagnostics v_inserted = row_count;

  select name into v_subject_name from subjects where id = v_subject_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'subject_id', v_subject_id,
    'subject_name', v_subject_name,
    'subject_was_new', not v_pre_existing
  );
end;
$function$;
