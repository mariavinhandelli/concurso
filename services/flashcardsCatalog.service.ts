// services/flashcardsCatalog.service.ts
// Banco de Flashcards: catálogo público de decks curados (read-only). Ativar em
// 1 clique copia os cards para os flashcards pessoais do usuário via RPC
// activate_catalog_flashcard_deck. Mesmo padrão do Banco de Editais
// (ver services/editaisCatalog.service.ts).
'use client';

import { createClient } from '@/lib/supabase/client';

export interface CatalogFlashcardDeck {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cardCount: number;
  activatedCount: number; // quantos cards deste deck o usuário já tem
  isActivated: boolean;   // ativou ao menos uma vez (mesmo que incompleto)
}

interface DeckRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  flashcard_catalog_cards: { count: number }[] | null;
}

export async function listCatalogFlashcardDecks(): Promise<CatalogFlashcardDeck[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [decksRes, minhasRes] = await Promise.all([
    supabase
      .from('flashcard_deck_catalog')
      .select('id, slug, name, description, flashcard_catalog_cards(count)')
      .eq('is_active', true)
      .order('position', { ascending: true }),
    user
      ? supabase.from('flashcards').select('catalog_card_id').eq('user_id', user.id).not('catalog_card_id', 'is', null)
      : Promise.resolve({ data: [] as { catalog_card_id: string }[], error: null }),
  ]);

  if (decksRes.error) throw new Error('Erro ao listar banco de flashcards: ' + decksRes.error.message);
  if (minhasRes.error) throw new Error('Erro ao verificar flashcards ativados: ' + minhasRes.error.message);

  const meusCatalogCardIds = new Set((minhasRes.data ?? []).map((r) => r.catalog_card_id));

  // conta quantos cards ativados pertencem a cada deck (join client-side, o
  // catálogo inteiro cabe fácil em memória — poucas centenas de linhas)
  let countByDeck = new Map<string, number>();
  if (meusCatalogCardIds.size > 0) {
    const { data: cardsRes, error: cardsErr } = await supabase
      .from('flashcard_catalog_cards')
      .select('id, deck_catalog_id');
    if (cardsErr) throw new Error('Erro ao verificar progresso do banco: ' + cardsErr.message);
    countByDeck = new Map();
    for (const c of cardsRes ?? []) {
      if (meusCatalogCardIds.has(c.id)) {
        countByDeck.set(c.deck_catalog_id, (countByDeck.get(c.deck_catalog_id) ?? 0) + 1);
      }
    }
  }

  return ((decksRes.data ?? []) as DeckRow[]).map((d) => {
    const cardCount = d.flashcard_catalog_cards?.[0]?.count ?? 0;
    const activatedCount = countByDeck.get(d.id) ?? 0;
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      description: d.description,
      cardCount,
      activatedCount,
      isActivated: activatedCount > 0,
    };
  });
}

// Ativa um deck do banco. Retorna quantos cards novos foram copiados para
// os flashcards pessoais do usuário (0 se já tinha todos — idempotente).
export async function activateCatalogFlashcardDeck(deckId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('activate_catalog_flashcard_deck', { p_deck_id: deckId });
  if (error) throw new Error('Erro ao ativar deck de flashcards: ' + error.message);
  return data as number;
}

export interface CatalogFlashcardSample {
  front: string;
  back: string;
}

// Amostra de cards do deck — para o usuário decidir se vale a pena ativar
// antes de copiar tudo para "Meus Cards".
export async function getCatalogDeckSample(deckId: string, limit = 5): Promise<CatalogFlashcardSample[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('flashcard_catalog_cards')
    .select('front, back')
    .eq('deck_catalog_id', deckId)
    .order('position', { ascending: true })
    .limit(limit);
  if (error) throw new Error('Erro ao carregar amostra do deck: ' + error.message);
  return data ?? [];
}
