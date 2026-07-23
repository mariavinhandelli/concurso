'use client';

// Banco de Flashcards: catálogo público de decks curados. Ativar em 1 clique
// copia os cards do deck para "Meus Cards" (mesmo padrão do Banco de
// Editais — ver BancoEditaisTab.tsx).

import { useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Layers } from 'lucide-react';
import {
  listCatalogFlashcardDecks, activateCatalogFlashcardDeck,
  type CatalogFlashcardDeck,
} from '@/services/flashcardsCatalog.service';
import { FlashcardBankPreviewModal } from '@/components/features/flashcards/FlashcardBankPreviewModal';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

export function BancoFlashcardsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [previewDeck, setPreviewDeck] = useState<CatalogFlashcardDeck | null>(null);

  const { data: decks, isLoading, isError } = useQuery<CatalogFlashcardDeck[]>({
    queryKey: ['catalog-flashcard-decks'],
    queryFn: listCatalogFlashcardDecks,
  });

  async function handleActivate(deck: CatalogFlashcardDeck) {
    setActivatingId(deck.id);
    try {
      const inserted = await activateCatalogFlashcardDeck(deck.id);
      await queryClient.invalidateQueries({ queryKey: ['catalog-flashcard-decks'] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      if (inserted > 0) {
        toast.success(`${inserted} card${inserted === 1 ? '' : 's'} adicionado${inserted === 1 ? '' : 's'} a "${deck.name}" em Meus Cards.`);
      } else {
        toast.success('Você já tinha todos os cards deste deck.');
      }
      // Só fecha a amostra em caso de sucesso — em erro, o usuário mantém o
      // contexto do deck que estava vendo e pode tentar de novo.
      setPreviewDeck(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ativar o deck. Tente novamente.');
    } finally {
      setActivatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div style={s.list}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p style={s.muted}>Não foi possível carregar o banco de flashcards. Tente de novo.</p>;
  }

  if ((decks?.length ?? 0) === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyTitle}>Banco de flashcards em construção</p>
        <p style={s.emptyHint}>Em breve, decks prontos aqui. Por ora, crie seus cards manualmente em &quot;Meus Cards&quot;.</p>
      </div>
    );
  }

  return (
    <div style={s.list}>
      {decks!.map((d) => {
        const complete = d.cardCount > 0 && d.activatedCount >= d.cardCount;
        const partial = d.activatedCount > 0 && !complete;
        return (
          <div key={d.id} style={s.card}>
            <div style={s.iconWrap}><Layers size={18} color={theme.teal} strokeWidth={1.8} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.titleRow}>
                <span style={s.title}>{d.name}</span>
                {complete && <span style={s.activatedTag}>Ativado <Check size={12} strokeWidth={2.5} /></span>}
                {partial && <span style={s.partialTag}>{d.activatedCount}/{d.cardCount} adicionados</span>}
              </div>
              {d.description && <div style={s.description}>{d.description}</div>}
              <div style={s.meta}>{d.cardCount} card{d.cardCount === 1 ? '' : 's'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="outline" onClick={() => setPreviewDeck(d)}>Ver amostra</Button>
              <Button
                variant={complete ? 'outline' : 'primary'}
                onClick={() => handleActivate(d)}
                disabled={activatingId === d.id}
              >
                {activatingId === d.id ? 'Ativando…' : complete ? 'Ativado' : partial ? 'Completar' : 'Ativar'}
              </Button>
            </div>
          </div>
        );
      })}

      {previewDeck && (
        <FlashcardBankPreviewModal
          deck={previewDeck}
          onClose={() => setPreviewDeck(null)}
          onActivate={() => handleActivate(previewDeck)}
          activating={activatingId === previewDeck.id}
        />
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 14, color: theme.inkSoft, padding: '12px 0' },
  skeleton: { height: 84, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },

  empty: { textAlign: 'center', padding: '40px 12px' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, boxShadow: theme.shadow },
  iconWrap: { width: 36, height: 36, borderRadius: theme.radiusSm, background: theme.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: 600, color: theme.ink },
  description: { fontSize: 13, color: theme.inkSoft, marginTop: 3 },
  meta: { fontSize: 12, color: theme.inkFaint, marginTop: 4 },
  activatedTag: { fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 },
  partialTag: { fontSize: 11, fontWeight: 700, color: theme.warn, background: theme.warnBg, borderRadius: theme.radiusXs, padding: '2px 8px' },
};
