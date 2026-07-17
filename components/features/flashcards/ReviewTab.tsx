'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { countDailyQueue } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
  onStart: () => void;
  loading?: boolean;
}

const SKEL: React.CSSProperties = {
  background: 'rgba(15,23,42,.07)',
  borderRadius: 10,
  animationName: 'skeleton-pulse',
  animationDuration: '1.5s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
};

export function ReviewTab({ onStart, loading }: Props) {
  const [counts, setCounts] = useState<{ pending: number; news: number } | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    countDailyQueue()
      .then(setCounts)
      .catch(() => {
        setHasError(true);
        setCounts({ pending: 0, news: 0 });
      });
  }, []);

  const total = counts ? counts.pending + counts.news : 0;
  const estMin = total > 0 ? Math.ceil(total * 0.5) : 0;

  return (
    <div style={styles.wrap}>
      {counts === null ? (
        <div style={styles.skeleton}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <div style={{ ...SKEL, width: 80, height: 52, borderRadius: theme.radiusSm }} />
            <div style={{ ...SKEL, width: 1, height: 40, borderRadius: 1 }} />
            <div style={{ ...SKEL, width: 80, height: 52, borderRadius: theme.radiusSm }} />
          </div>
          <div style={{ ...SKEL, width: 220, height: 46, borderRadius: theme.radiusSm }} />
        </div>
      ) : hasError ? (
        <div style={styles.empty}>
          <p style={{ ...styles.muted, color: theme.danger }}>Erro ao carregar flashcards. Recarregue a página.</p>
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<Check size={26} color={theme.teal} strokeWidth={1.8} />}
          title="Revisão em dia"
          body="Nenhum flashcard para revisar hoje. Crie novos cards na aba Meus Cards ou volte amanhã."
        />
      ) : (
        <>
          <div style={styles.counts}>
            <div style={styles.countBox}>
              <span style={styles.num}>{counts.pending}</span>
              <span style={styles.label}>revisões</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.countBox}>
              <span style={{ ...styles.num, color: theme.teal }}>{counts.news}</span>
              <span style={styles.label}>novos</span>
            </div>
          </div>
          {estMin > 0 && <p style={styles.estTime}>~{estMin} min de estudo</p>}
          <Button onClick={onStart} disabled={loading} style={{ padding: '13px 30px', fontSize: 15 }}>
            {loading ? 'Carregando…' : 'Iniciar sessão de estudo'}
          </Button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '40px 0' },
  skeleton: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' },
  muted: { color: theme.inkFaint, fontSize: 14, margin: 0 },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyIcon: { fontSize: 36, color: theme.ok, display: 'block', marginBottom: 12 },
  counts: { display: 'flex', gap: 28, alignItems: 'center' },
  countBox: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  divider: { width: 1, height: 40, background: theme.line },
  num: { fontSize: 40, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' },
  label: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  estTime: { fontSize: 13, color: theme.inkFaint, margin: '-8px 0 0' },
};
