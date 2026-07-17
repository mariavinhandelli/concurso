// components/features/reviews/ReviewsToday.tsx
// Card "Revisões de Hoje" do dashboard.
// Usa a mesma queryKey de useReviews → compartilha cache com a página /reviews.
// Quando o usuário conclui revisões, este card atualiza automaticamente.
'use client';

import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { listDueReviews } from '@/services/reviews.service';
import { REVIEWS_DUE_KEY } from '@/hooks/reviews.keys';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export function ReviewsToday() {
  const { data, isLoading } = useQuery({
    queryKey: REVIEWS_DUE_KEY,
    queryFn: listDueReviews,
    select: (items) => items.length, // deriva count sem expor o array completo
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const count = isLoading ? null : (data ?? 0);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Revisões de hoje</span>
        <a href="/reviews" style={styles.manage}>Ver todas</a>
      </div>

      {count === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <Skeleton width={64} height={38} />
          <Skeleton height={44} borderRadius={theme.radiusSm} style={{ marginTop: 'auto' }} />
        </div>
      ) : count === 0 ? (
        <div style={styles.allDone}>
          <span style={styles.checkDot}><Check size={12} strokeWidth={3} /></span> Nenhuma revisão pendente
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
  wrap:     { width: '100%', fontFamily: theme.font, display: 'flex', flexDirection: 'column', height: '100%' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  eyebrow:  { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  manage:   { fontSize: 13, color: theme.teal, fontWeight: 500, textDecoration: 'none' },
  muted:    { color: theme.inkFaint, fontSize: 14, margin: 0 },
  allDone:  { color: theme.ok, fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 },
  checkDot: { width: 20, height: 20, borderRadius: '50%', background: theme.okBg, color: theme.ok, display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 700 },
  body:     { display: 'flex', flexDirection: 'column', height: '100%' },
  metric:   { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'auto' },
  num:      { fontSize: 40, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  label:    { fontSize: 14, color: theme.inkSoft, fontWeight: 500 },
  startBtn: { display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 16, transition: 'all .15s' },
};
