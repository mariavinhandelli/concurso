-- Achado no double-check pós-lançamento da auditoria de Flashcards (23/07/2026):
-- a RPC activate_catalog_flashcard_deck só evita duplicar cards via um
-- `WHERE NOT EXISTS (...)` no INSERT — sem um índice único, duas chamadas
-- concorrentes (2 abas abertas, ou um duplo clique que escape do `disabled`
-- do botão) passam ambas pelo NOT EXISTS antes de qualquer uma commitar
-- (comportamento padrão do READ COMMITTED do Postgres), resultando em cards
-- duplicados para o mesmo catalog_card_id do mesmo usuário. Não há nenhuma
-- duplicata em produção hoje (baixo uso ainda), mas é uma corrida real e
-- reprodutível — corrigindo antes do lançamento, não depois de um incidente.

-- Índice único parcial: só se aplica a cards vindos do catálogo (catalog_card_id
-- não nulo); cards manuais continuam podendo ter conteúdo duplicado à vontade.
create unique index if not exists flashcards_user_catalog_card_uniq
  on public.flashcards (user_id, catalog_card_id)
  where catalog_card_id is not null;

-- ON CONFLICT DO NOTHING é a rede de segurança real contra a corrida — o
-- NOT EXISTS continua evitando trabalho desnecessário no caso comum.
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
    )
  on conflict (user_id, catalog_card_id) where catalog_card_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;
