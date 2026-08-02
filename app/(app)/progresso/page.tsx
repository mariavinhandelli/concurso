// app/(app)/progresso/page.tsx — aba EVOLUÇÃO (M1)
// Ordem deliberada: identidade (heatmap) → ritmo → prontidão/cobertura →
// tempo → acerto → retenção → energia → distribuição. O heatmap abre a página
// porque é o retrato do hábito (Atomic Habits): antes vivia escondido em
// /historico. Retenção (M3) vem depois do acerto: primeiro "quanto acerto",
// depois "quanto ESTOU RETENDO do que estudei".
'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { YearHeatmap } from '@/components/features/history/YearHeatmap';
import { NarrativaMes } from '@/components/features/dashboard/NarrativaMes';
import { ConstanciaResumo } from '@/components/features/dashboard/ConstanciaResumo';
import { AccuracyChart } from '@/components/features/dashboard/AccuracyChart';
import { RaioXCard } from '@/components/features/home/RaioXCard';
import { CoberturaEdital } from '@/components/features/home/CoberturaEdital';
import { TimePieCard } from '@/components/features/home/TimePieCard';
import { useUI } from '@/components/layout/UIContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
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
const RetencaoChart = dynamic(
  () => import('@/components/features/dashboard/RetencaoChart').then((m) => ({ default: m.RetencaoChart })),
  { ssr: false, loading: chartLoading },
);

export default function EvolucaoPage() {
  const { isMobile, isTablet } = useUI();
  const umaColuna = isMobile || isTablet;

  useEffect(() => { track(EV.performanceViewed); }, []);

  return (
    <div style={{ ...styles.grid, gridTemplateColumns: umaColuna ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
      {/* identidade do hábito — largura cheia, no topo */}
      <div style={{ gridColumn: '1 / -1' }}>
        <YearHeatmap />
      </div>

      {/* leitura do mês (M6) — só existe quando há narrativa gravada */}
      <div style={{ gridColumn: '1 / -1' }}>
        <NarrativaMes />
      </div>

      {/* ritmo de estudo */}
      <Card style={{ gridColumn: '1 / -1', padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <ConstanciaResumo />
      </Card>

      {/* prontidão + cobertura do edital — lado a lado no desktop */}
      <RaioXCard />
      <CoberturaEdital />

      {/* tempo de estudo */}
      <Card style={{ gridColumn: '1 / -1', padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <StudyTimeChart />
      </Card>

      {/* acerto por matéria + evolução */}
      <Card style={{ padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <AccuracyChart />
      </Card>
      <Card style={{ padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <AccuracyEvolutionChart />
      </Card>

      {/* retenção — estudar ≠ aprender (M3) */}
      <Card style={{ gridColumn: '1 / -1', padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <RetencaoChart />
      </Card>

      {/* energia × desempenho */}
      <Card style={{ gridColumn: '1 / -1', padding: isMobile ? 16 : 24, minWidth: 0, overflow: 'hidden' }}>
        <EnergiaDesempenho />
      </Card>

      {/* distribuição da semana por matéria */}
      <div style={{ gridColumn: '1 / -1' }}>
        <TimePieCard />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // minmax(0, 1fr) e não 1fr: o mínimo automático de `1fr` é `auto`, então um
  // filho com min-content largo (o YearHeatmap, 52 semanas ≈ 763px) esticava a
  // trilha além do container e a página inteira rolava na horizontal em tablet
  // portrait (768–914px). Com minmax(0,…) o heatmap rola dentro do próprio card.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, minWidth: 0 },
};
