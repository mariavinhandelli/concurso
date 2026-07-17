'use client';

// Amostra de cards de um deck do Banco de Flashcards — mostrada antes de
// ativar, para o usuário decidir se vale a pena copiar o deck inteiro.

import { useEffect, useState, type CSSProperties } from 'react';
import { getCatalogDeckSample, type CatalogFlashcardDeck } from '@/services/flashcardsCatalog.service';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface Props {
  deck: CatalogFlashcardDeck;
  onClose: () => void;
  onActivate: () => void;
  activating: boolean;
}

export function FlashcardBankPreviewModal({ deck, onClose, onActivate, activating }: Props) {
  const [sample, setSample] = useState<{ front: string; back: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCatalogDeckSample(deck.id, 5)
      .then((rows) => { if (!cancelled) setSample(rows); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar amostra.'); });
    return () => { cancelled = true; };
  }, [deck.id]);

  return (
    <Overlay onClose={onClose} labelledBy="banco-preview-title" maxWidth={560}>
      <h2 id="banco-preview-title" style={s.title}>{deck.name}</h2>
      {deck.description && <p style={s.description}>{deck.description}</p>}
      <p style={s.count}>{deck.cardCount} card{deck.cardCount === 1 ? '' : 's'} neste deck — amostra abaixo:</p>

      {error && <p style={s.error}>{error}</p>}
      {!error && !sample && (
        <div style={s.list}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={72} borderRadius={theme.radius} />)}
        </div>
      )}

      {sample && (
        <div style={s.list}>
          {sample.map((c, i) => (
            <div key={i} style={s.card}>
              <div style={s.front}>{c.front}</div>
              <div style={s.divider} />
              <div style={s.back}>{c.back}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.actions}>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button variant="primary" onClick={onActivate} disabled={activating}>
          {activating ? 'Ativando…' : 'Ativar este deck'}
        </Button>
      </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  title: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  description: { fontSize: 13, color: theme.inkSoft, margin: '0 0 4px', lineHeight: 1.5 },
  count: { fontSize: 12, color: theme.inkFaint, margin: '0 0 16px' },
  muted: { fontSize: 13, color: theme.inkFaint, padding: '12px 0' },
  error: { fontSize: 13, color: theme.danger, padding: '12px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50dvh', overflowY: 'auto' },
  card: { border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '12px 14px', background: theme.muted },
  front: { fontSize: 14, fontWeight: 600, color: theme.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  divider: { height: 1, background: theme.line, margin: '10px 0' },
  back: { fontSize: 13, color: theme.inkSoft, whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
};
