// services/flashcardsCatalog.service.ts
// Banco de Flashcards: catálogo público de decks curados (read-only). Ativar em
// 1 clique copia os cards para os flashcards pessoais do usuário via RPC
// activate_catalog_flashcard_deck. Mesmo padrão do Banco de Editais
// (ver services/editaisCatalog.service.ts).
'use client';

import { createClient } from '@/lib/supabase/client';
import { rpcErrorMessage } from '@/lib/rpc-error';

// 'curadoria' = baralho montado à mão (Anki, etc.); 'lei_seca'/'jurisprudencia'
// = gerado a partir do texto oficial da lei ou de um julgado do banco — dá o
// selo de origem na aba Banco.
export type CatalogDeckOrigin = 'curadoria' | 'lei_seca' | 'jurisprudencia';

export interface CatalogFlashcardDeck {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  origin: CatalogDeckOrigin;
  cardCount: number;
  activatedCount: number; // quantos cards deste deck o usuário já tem
  isActivated: boolean;   // ativou ao menos uma vez (mesmo que incompleto)
}

interface DeckRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  origin: CatalogDeckOrigin;
  flashcard_catalog_cards: { count: number }[] | null;
}

export async function listCatalogFlashcardDecks(): Promise<CatalogFlashcardDeck[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [decksRes, minhasRes] = await Promise.all([
    supabase
      .from('flashcard_deck_catalog')
      .select('id, slug, name, description, origin, flashcard_catalog_cards(count)')
      .eq('is_active', true)
      .order('position', { ascending: true }),
    user
      ? supabase.from('flashcards').select('catalog_card_id').eq('user_id', user.id).not('catalog_card_id', 'is', null)
      : Promise.resolve({ data: [] as { catalog_card_id: string }[], error: null }),
  ]);

  if (decksRes.error) throw new Error('Erro ao listar banco de flashcards: ' + decksRes.error.message);
  if (minhasRes.error) throw new Error('Erro ao verificar flashcards ativados: ' + minhasRes.error.message);

  const meusCatalogCardIds = Array.from(new Set((minhasRes.data ?? []).map((r) => r.catalog_card_id)));

  // Conta quantos cards ativados pertencem a cada deck — busca só os cards que
  // o usuário já tem (não o catálogo inteiro), então escala com o progresso do
  // usuário, não com o tamanho total do catálogo.
  const countByDeck = new Map<string, number>();
  if (meusCatalogCardIds.length > 0) {
    const { data: cardsRes, error: cardsErr } = await supabase
      .from('flashcard_catalog_cards')
      .select('id, deck_catalog_id')
      .in('id', meusCatalogCardIds);
    if (cardsErr) throw new Error('Erro ao verificar progresso do banco: ' + cardsErr.message);
    for (const c of cardsRes ?? []) {
      countByDeck.set(c.deck_catalog_id, (countByDeck.get(c.deck_catalog_id) ?? 0) + 1);
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
      origin: d.origin,
      cardCount,
      activatedCount,
      isActivated: activatedCount > 0,
    };
  });
}

export interface ActivateDeckResult {
  inserted: number;         // cards novos copiados (0 se já tinha todos — idempotente)
  subjectId: string;
  subjectName: string;
  subjectWasNew: boolean;   // a matéria não existia antes desta ativação (criada ou adotada)
}

// Ativa um deck do banco. Por baixo, também ativa a matéria de catálogo do deck
// (activate_catalog_subject) — a UI precisa saber disso para não pegar o
// usuário de surpresa quando uma matéria nova aparece em Minhas Matérias.
export async function activateCatalogFlashcardDeck(deckId: string): Promise<ActivateDeckResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('activate_catalog_flashcard_deck', { p_deck_id: deckId });
  if (error) {
    throw new Error(rpcErrorMessage(
      error,
      'Não foi possível ativar este deck agora. Nenhum card foi copiado — tente de novo em instantes.',
      'activate_catalog_flashcard_deck',
    ));
  }
  const result = data as { inserted: number; subject_id: string; subject_name: string; subject_was_new: boolean };
  return {
    inserted: result.inserted,
    subjectId: result.subject_id,
    subjectName: result.subject_name,
    subjectWasNew: result.subject_was_new,
  };
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
