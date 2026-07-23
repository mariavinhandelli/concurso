'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Share } from 'lucide-react';
import { getEditalCoverage, type EditalCoverage } from '@/services/coverage.service';
import { ShareProgressCard } from './ShareProgressCard';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export const CoberturaEdital = memo(function CoberturaEdital() {
  const router = useRouter();
  const [sharing, setSharing] = useState(false);
  const { data, isLoading, isError, refetch, isRefetching } = useQuery<EditalCoverage>({
    queryKey: ['edital-coverage'],
    queryFn: getEditalCoverage,
  });

  if (isLoading) {
    return (
      <div style={styles.card}>
        <Skeleton width={150} height={11} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width={90} height={30} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton height={10} borderRadius={999} />
      </div>
    );
  }

  // H11 — antes sumia em silêncio (return null); agora avisa e oferece retry.
  if (isError || !data) {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Cobertura do edital</span>
        <p style={styles.emptyMsg}>Não foi possível carregar a cobertura agora.</p>
        <button style={styles.ctaBtn} onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? 'tentando…' : 'tentar de novo'}
        </button>
      </div>
    );
  }

  // Sem concurso-alvo → convite a definir um (destrava a métrica).
  if (!data.hasTarget) {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Cobertura do edital</span>
        <p style={styles.emptyMsg}>Defina seu concurso-alvo para acompanhar quanto do edital você já cobriu.</p>
        <button style={styles.ctaBtn} onClick={() => router.push('/targets')}>Definir concurso-alvo →</button>
      </div>
    );
  }

  // Alvo existe, mas sem tópicos vinculados → convite a montar o edital.
  if (data.total === 0) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>Cobertura do edital</span>
          <span style={styles.targetName}>{data.targetName}</span>
        </div>
        <p style={styles.emptyMsg}>Vincule os tópicos do edital ao seu concurso-alvo para ver a cobertura.</p>
        <button style={styles.ctaBtn} onClick={() => router.push('/targets')}>Montar edital →</button>
      </div>
    );
  }

  const { pct, mastered, inProgress, notStarted, covered, total, targetName } = data;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Cobertura do edital</span>
        <span style={styles.targetName}>{targetName}</span>
      </div>

      <div style={styles.heroRow}>
        <span style={styles.heroPct}>{pct}%</span>
        <span style={styles.heroLabel}>do edital coberto · {covered} de {total} tópicos</span>
      </div>

      {/* Barra segmentada — flex proporcional às contagens (sem falhas de arredondamento) */}
      <div
        style={styles.bar}
        role="progressbar"
        aria-label="Cobertura do edital"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% do edital coberto — ${covered} de ${total} tópicos`}
      >
        {mastered > 0 && <div style={{ flex: mastered, background: theme.teal }} />}
        {inProgress > 0 && <div style={{ flex: inProgress, background: theme.warn }} />}
        {notStarted > 0 && <div style={{ flex: notStarted, background: theme.muted }} />}
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: theme.teal }} />Dominados {mastered}</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: theme.warn }} />Em progresso {inProgress}</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: theme.muted }} />Não iniciados {notStarted}</span>
      </div>

      <button style={styles.shareBtn} onClick={() => setSharing(true)}>
        <Share size={15} color={theme.teal} strokeWidth={1.9} />
        Compartilhar meu progresso
      </button>

      <button style={styles.analiseLink} onClick={() => router.push('/performance')}>
        ver análise completa →
      </button>

      {sharing && <ShareProgressCard onClose={() => setSharing(false)} />}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card,
    border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: '16px 18px',
    fontFamily: theme.font,
    minWidth: 0,
  },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  targetName: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },

  heroRow: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  heroPct: { fontSize: 32, fontWeight: 800, color: theme.ink, letterSpacing: -1, lineHeight: 1 },
  heroLabel: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },

  bar: { display: 'flex', height: 10, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginBottom: 12 },

  legend: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },

  emptyMsg: { fontSize: 14, color: theme.inkSoft, margin: '4px 0 0', lineHeight: 1.5 },
  ctaBtn: { marginTop: 12, border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  shareBtn: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px',
    borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg,
    color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
    justifyContent: 'center',
  },
  analiseLink: {
    display: 'block', width: '100%', textAlign: 'center', marginTop: 10, border: 'none',
    background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
};
