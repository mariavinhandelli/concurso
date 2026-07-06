'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJourneyStats, type JourneyStats as TJourneyStats } from '@/services/journey.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { Skeleton } from '@/components/ui/Skeleton';

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export const JourneyStats = memo(function JourneyStats() {
  const { isMobile, isTablet } = useUI();
  const { data: j, isLoading } = useQuery<TJourneyStats>({
    queryKey: ['journey-stats'],
    queryFn: getJourneyStats,
    staleTime: 5 * 60_000,
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

  const stats: { value: string; label: string }[] = [
    { value: fmtHours(j.totalMinutes), label: 'de estudo' },
    { value: String(j.sessionsThisMonth), label: 'sessões este mês' },
    { value: j.totalTopics > 0 ? `${j.coveragePct}%` : '—', label: 'edital coberto' },
    { value: j.avgTopicsPerWeek4w > 0 ? `${j.avgTopicsPerWeek4w}/sem` : '—', label: 'ritmo' },
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
    fontSize: 11.5,
    color: theme.inkFaint,
    fontWeight: 500,
    lineHeight: 1.3,
  },
};
