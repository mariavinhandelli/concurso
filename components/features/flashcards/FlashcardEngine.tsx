// components/features/flashcards/FlashcardEngine.tsx
// Engine de estudo: recebe uma fila de cards e gerencia o ciclo completo
// (mostrar → virar → avaliar → SM-2 → próximo) sem recarregar a página.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { submitCardReview, type ReviewRating } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';
import { useToast } from '@/components/ui/ToastProvider';

export interface QueueCard {
  id: string;
  front: string;
  back: string;
  subjectName?: string;
  subjectColor?: string;
  isNew?: boolean;
}

interface Props {
  queue: QueueCard[];
  onFinish: () => void;
}

const RATINGS: { key: ReviewRating; label: string; fg: string; bg: string }[] = [
  { key: 'dificil', label: 'Difícil', fg: theme.crit, bg: theme.critBg },
  { key: 'intermediario', label: 'Intermediário', fg: theme.warn, bg: theme.warnBg },
  { key: 'facil', label: 'Fácil', fg: theme.ok, bg: theme.okBg },
];

export function FlashcardEngine({ queue, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const total = queue.length;
  const current = queue[index];
  const remaining = total - index;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const pendingCount = queue.slice(index).filter((c) => !c.isNew).length;
  const newCount = queue.slice(index).filter((c) => c.isNew).length;

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!current || saving) return;
    setSaving(true);
    try {
      await submitCardReview(current.id, rating);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar avaliação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }, [current, saving]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (flipped) {
        if (e.key === '1') rate('dificil');
        if (e.key === '2') rate('intermediario');
        if (e.key === '3') rate('facil');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, flipped, rate]);


  if (!current) {
    return (
      <div style={styles.done}>
        <span style={styles.doneIcon}>✓</span>
        <p style={styles.doneText}>Sessão concluída!</p>
        <button onClick={onFinish} style={styles.finishBtn}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={styles.engine}>
      {/* Barra de progresso */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      {/* Contadores */}
      <div style={styles.counters}>
        <span style={styles.counterPending}>Revisões: {pendingCount}</span>
        <span style={styles.counterNew}>Novos: {newCount}</span>
      </div>

      {/* Card */}
      <div style={styles.card} onClick={() => setFlipped(!flipped)}>
        {current.subjectName && (
          <span style={{ ...styles.badge, background: current.subjectColor ?? theme.teal }}>
            {current.subjectName}{current.isNew ? ' · novo' : ''}
          </span>
        )}
        <div style={styles.cardContent}>
          <p style={styles.face}>{current.front}</p>
          {flipped && <><div style={styles.sep} /><p style={styles.faceBack}>{current.back}</p></>}
        </div>
        {!flipped && <p style={styles.flipHint}>clique ou pressione Espaço para ver a resposta</p>}
      </div>

      {/* Avaliação */}
      {flipped ? (
        <div style={styles.ratings}>
          {RATINGS.map((r, i) => (
            <button key={r.key} onClick={() => rate(r.key)} disabled={saving}
              style={{ ...styles.ratingBtn, color: r.fg, background: r.bg }}>
              <span style={styles.ratingKey}>{i + 1}</span> {r.label}
            </button>
          ))}
        </div>
      ) : (
        <p style={styles.remainingHint}>{remaining} {remaining === 1 ? 'card restante' : 'cards restantes'}</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  engine: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', fontFamily: theme.font },
  progressTrack: { width: '100%', height: 4, background: theme.line, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', background: theme.teal, borderRadius: 2, transition: 'width 0.3s ease' },
  ratingKey: { fontSize: 11, opacity: 0.6, marginRight: 3 },
  counters: { display: 'flex', gap: 16 },
  counterPending: { fontSize: 13, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  counterNew: { fontSize: 13, color: theme.tealDeep, background: theme.tealBg, padding: '4px 12px', borderRadius: 10, fontWeight: 500 },
  card: { width: '100%', minHeight: 260, background: theme.card, borderRadius: 20, border: `0.5px solid ${theme.line}`, padding: 32, cursor: 'pointer', display: 'flex', flexDirection: 'column', boxShadow: theme.shadow, minWidth: 0, boxSizing: 'border-box' },
  badge: { alignSelf: 'flex-start', fontSize: 12, color: '#fff', padding: '3px 10px', borderRadius: 8, fontWeight: 600 },
  cardContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  face: { fontSize: 20, color: theme.ink, textAlign: 'center', margin: 0, fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' },
  sep: { height: 1, background: theme.line, margin: '20px 0' },
  faceBack: { fontSize: 17, color: theme.inkSoft, textAlign: 'center', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' },
  flipHint: { fontSize: 12, color: theme.inkFaint, textAlign: 'center', margin: 0 },
  remainingHint: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  ratings: { display: 'flex', gap: 8, width: '100%' },
  ratingBtn: { flex: 1, minWidth: 0, padding: '16px 4px', borderRadius: 12, border: 'none', fontSize: 13.5, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
  done: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' },
  doneIcon: { fontSize: 48, color: theme.ok },
  doneText: { fontSize: 18, color: theme.ink, margin: 0, fontWeight: 600 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};