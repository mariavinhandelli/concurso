-- Corrige BUG-01 da auditoria do módulo Flashcards (22/07/2026): a RPC de
-- ativação do Banco de Flashcards (20260715120000_flashcard_bank_catalog.sql)
-- inseria os cards do catálogo sem `is_review_active = true`. Toda leitura de
-- fila (fetchPendingCards/fetchNewCards/fetchTopicCards/countDueFlashcards/
-- countNewFlashcards) filtra `is_review_active = true` — então nenhum card
-- ativado pelo Banco jamais aparecia para estudo, revisão ou nas contagens.
--
-- Esta migração:
--   1. corrige a função para os próximos cards ativados já entrarem como
--      "novos" na fila (is_review_active=true, next_review_date=null — os
--      defaults de ease_factor/interval_days/repetitions já são corretos
--      para um card nunca revisado);
--   2. faz o backfill dos cards já ativados por usuários reais antes da
--      correção (catalog_card_id preenchido e is_review_active=false).

create or replace function public.activate_catalog_flashcard_deck(p_deck_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_deck       record;
  v_subject_id uuid;
  v_inserted   integer := 0;
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

  v_subject_id := activate_catalog_subject(v_deck.subject_catalog_id);

  insert into flashcards (user_id, subject_id, topic_id, front, back, catalog_card_id, is_review_active)
  select v_user_id, v_subject_id, t.id, cc.front, cc.back, cc.id, true
  from flashcard_catalog_cards cc
  left join topics t on t.user_id = v_user_id and t.catalog_id = cc.topic_catalog_id
  where cc.deck_catalog_id = p_deck_id
    and not exists (
      select 1 from flashcards f
      where f.user_id = v_user_id and f.catalog_card_id = cc.id
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;

-- Backfill: cards já ativados antes da correção, hoje invisíveis para estudo.
update public.flashcards
set is_review_active = true
where catalog_card_id is not null
  and is_review_active = false;
