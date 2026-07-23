'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getJourneyStats, type JourneyStats as TJourneyStats } from '@/services/journey.service';
import { getEditalCoverage, type EditalCoverage } from '@/services/coverage.service';
import { fmtMin } from '@/lib/format/time';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { Skeleton } from '@/components/ui/Skeleton';

export const JourneyStats = memo(function JourneyStats() {
  const router = useRouter();
  const { isMobile, isTablet } = useUI();
  const { data: j, isLoading } = useQuery<TJourneyStats>({
    queryKey: ['journey-stats'],
    queryFn: getJourneyStats,
    staleTime: 5 * 60_000,
  });
  // Mesma key do card Cobertura do Edital (dedupe): o chip "edital coberto"
  // precisa mostrar o MESMO número do card vizinho — antes cada um media uma
  // coisa (tópicos do edital vs. todos os tópicos) e a Home se contradizia.
  const { data: cov } = useQuery<EditalCoverage>({
    queryKey: ['edital-coverage'],
    queryFn: getEditalCoverage,
  });

  if (isLoading) {
    return (
      <div style={styles.wrap}>
        <span style={styles.eyebrow}>Sua jornada</span>
        <div style={{ ...styles.grid, gridTemplateColumns: isMobile || isTablet ? '1fr 1fr' : 'repeat(4, 1fr)' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={styles.chip}>
              <Skeleton height={20} width={52} borderRadius={4} />
              <div style={{ marginTop: 5 }}>
                <Skeleton height={10} width={64} borderRadius={4} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!j || (j.totalMinutes === 0 && j.totalTopics === 0)) return null;

  const temEdital = !!cov?.hasTarget && (cov?.total ?? 0) > 0;
  const stats: { value: string; label: string }[] = [
    { value: fmtMin(j.totalMinutes), label: 'de estudo' },
    { value: String(j.sessionsThisMonth), label: 'sessões este mês' },
    temEdital
      ? { value: `${cov!.pct}%`, label: 'edital coberto' }
      : { value: j.totalTopics > 0 ? `${j.coveragePct}%` : '—', label: 'tópicos cobertos' },
    // H16 — vírgula decimal pt-BR ("0,3/sem"), não ponto ("0.3/sem").
    { value: j.avgTopicsPerWeek4w > 0 ? `${j.avgTopicsPerWeek4w.toString().replace('.', ',')}/sem` : '—', label: 'ritmo' },
  ];

  return (
    <div style={styles.wrap}>
      <span style={styles.eyebrow}>Sua jornada</span>
      <div style={{ ...styles.grid, gridTemplateColumns: isMobile || isTablet ? '1fr 1fr' : 'repeat(4, 1fr)' }}>
        {stats.map((s) => (
          <div key={s.label} style={styles.chip}>
            <span style={styles.val}>{s.value}</span>
            <span style={styles.lbl}>{s.label}</span>
          </div>
        ))}
      </div>
      <button style={styles.analiseLink} onClick={() => router.push('/performance')}>
        ver análise completa →
      </button>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    fontFamily: theme.font,
    background: theme.card,
    border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: '14px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 500,
    color: theme.inkFaint,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '10px 14px',
    background: theme.bg,
    borderRadius: theme.radiusSm,
    minWidth: 0,
  },
  val: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.ink,
    letterSpacing: -0.5,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
  lbl: {
    fontSize: 12,
    color: theme.inkFaint,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  analiseLink: {
    display: 'block', width: '100%', textAlign: 'center', marginTop: 2, border: 'none',
    background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
};
