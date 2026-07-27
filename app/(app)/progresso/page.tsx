// app/(app)/progresso/page.tsx — aba EVOLUÇÃO (M1)
// Ordem deliberada: identidade (heatmap) → ritmo → prontidão/cobertura →
// tempo → acerto → energia → distribuição. O heatmap abre a página porque é o
// retrato do hábito (Atomic Habits): antes vivia escondido em /historico.
'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { YearHeatmap } from '@/components/features/history/YearHeatmap';
import { ConstanciaResumo } from '@/components/features/dashboard/ConstanciaResumo';
import { AccuracyChart } from '@/components/features/dashboard/AccuracyChart';
import { RaioXCard } from '@/components/features/home/RaioXCard';
import { CoberturaEdital } from '@/components/features/home/CoberturaEdital';
import { TimePieCard } from '@/components/features/home/TimePieCard';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { track, EV } from '@/lib/analytics';

// Recharts fora do payload inicial — mesmo padrão da antiga /performance.
const chartLoading = () => <Skeleton height={260} borderRadius={12} />;
const StudyTimeChart = dynamic(
  () => import('@/components/features/dashboard/StudyTimeChart').then((m) => ({ default: m.StudyTimeChart })),
  { ssr: false, loading: chartLoading },
);
const AccuracyEvolutionChart = dynamic(
  () => import('@/components/features/dashboard/AccuracyEvolutionChart').then((m) => ({ default: m.AccuracyEvolutionChart })),
  { ssr: false, loading: chartLoading },
);
const EnergiaDesempenho = dynamic(
  () => import('@/components/features/dashboard/EnergiaDesempenho').then((m) => ({ default: m.EnergiaDesempenho })),
  { ssr: false, loading: chartLoading },
);

export default function EvolucaoPage() {
  const { isMobile, isTablet } = useUI();
  const umaColuna = isMobile || isTablet;

  useEffect(() => { track(EV.performanceViewed); }, []);

  return (
    <div style={{ ...styles.grid, gridTemplateColumns: umaColuna ? '1fr' : 'repeat(2, 1fr)' }}>
      {/* identidade do hábito — largura cheia, no topo */}
      <div style={{ gridColumn: '1 / -1' }}>
        <YearHeatmap />
      </div>

      {/* ritmo de estudo */}
      <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
        <ConstanciaResumo />
      </div>

      {/* prontidão + cobertura do edital — lado a lado no desktop */}
      <RaioXCard />
      <CoberturaEdital />

      {/* tempo de estudo */}
      <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
        <StudyTimeChart />
      </div>

      {/* acerto por matéria + evolução */}
      <div style={{ ...styles.card, padding: isMobile ? 16 : 24 }}>
        <AccuracyChart />
      </div>
      <div style={{ ...styles.card, padding: isMobile ? 16 : 24 }}>
        <AccuracyEvolutionChart />
      </div>

      {/* energia × desempenho */}
      <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
        <EnergiaDesempenho />
      </div>

      {/* distribuição da semana por matéria */}
      <div style={{ gridColumn: '1 / -1' }}>
        <TimePieCard />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, minWidth: 0 },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, minWidth: 0, overflow: 'hidden' },
};
