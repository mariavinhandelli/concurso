-- Banco de Flashcards: catálogo público de decks curados, com ativação idempotente
-- para os flashcards pessoais do usuário. Mesmo padrão do Hub de Editais
-- (subjects_catalog/topics_catalog + activate_catalog_subject), ver
-- supabase/migrations/20260714150000_hub_editais.sql.

create table public.flashcard_deck_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  subject_catalog_id uuid references public.subjects_catalog(id),
  name text not null,
  description text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.flashcard_catalog_cards (
  id uuid primary key default gen_random_uuid(),
  deck_catalog_id uuid not null references public.flashcard_deck_catalog(id) on delete cascade,
  topic_catalog_id uuid references public.topics_catalog(id),
  front text not null,
  back text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.flashcards add column catalog_card_id uuid references public.flashcard_catalog_cards(id);

create index idx_flashcard_catalog_cards_deck on public.flashcard_catalog_cards(deck_catalog_id);
create index idx_flashcards_catalog_card on public.flashcards(catalog_card_id) where catalog_card_id is not null;

alter table public.flashcard_deck_catalog enable row level security;
alter table public.flashcard_catalog_cards enable row level security;

create policy "catalog_read_deck" on public.flashcard_deck_catalog
  for select to authenticated using (true);

create policy "catalog_read_cards" on public.flashcard_catalog_cards
  for select to authenticated using (true);

-- Ativação idempotente: garante matéria+tópicos pessoais (via activate_catalog_subject
-- já existente) e copia os cards do deck que o usuário ainda não tem.
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

  insert into flashcards (user_id, subject_id, topic_id, front, back, catalog_card_id)
  select v_user_id, v_subject_id, t.id, cc.front, cc.back, cc.id
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
