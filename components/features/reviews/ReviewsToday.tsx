// components/features/reviews/ReviewsToday.tsx
// Card "Revisões de Hoje" para a tela inicial: mostra tópicos pendentes e leva
// para a central de revisões.
'use client';

import { useEffect, useState } from 'react';
import { countDueReviews } from '@/services/reviews.service';
import { theme } from '@/lib/theme';

export function ReviewsToday() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    countDueReviews().then(setCount).catch(() => setCount(0));
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Revisões de hoje</span>
        <a href="/reviews" style={styles.manage}>Ver todas</a>
      </div>

      {count === null ? (
        <p style={styles.muted}>Carregando…</p>
      ) : count === 0 ? (
        <div style={styles.allDone}>
          <span style={styles.checkDot}>✓</span> Nenhuma revisão pendente
        </div>
      ) : (
        <div style={styles.body}>
          <div style={styles.metric}>
            <span style={styles.num}>{count}</span>
            <span style={styles.label}>{count === 1 ? 'tópico pendente' : 'tópicos pendentes'}</span>
          </div>
          <a href="/reviews" style={styles.startBtn}>Revisar agora</a>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', fontFamily: theme.font, display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  manage: { fontSize: 13, color: theme.teal, fontWeight: 500, textDecoration: 'none' },
  muted: { color: theme.inkFaint, fontSize: 14, margin: 0 },
  allDone: { color: theme.ok, fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 },
  checkDot: {
    width: 20, height: 20, borderRadius: '50%', background: theme.okBg, color: theme.ok,
    display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
  },
  body: { display: 'flex', flexDirection: 'column', height: '100%' },
  metric: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'auto' },
  num: { fontSize: 40, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  label: { fontSize: 14, color: theme.inkSoft, fontWeight: 500 },
  startBtn: {
    display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px 0',
    borderRadius: 12, border: 'none', background: theme.teal, color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
    marginTop: 16, transition: 'all .15s',
  },
};