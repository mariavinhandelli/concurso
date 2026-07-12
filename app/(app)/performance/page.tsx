// app/(app)/performance/page.tsx
'use client';

import { StudyTimeChart } from '@/components/features/dashboard/StudyTimeChart';
import { AccuracyChart } from '@/components/features/dashboard/AccuracyChart';
import { AccuracyEvolutionChart } from '@/components/features/dashboard/AccuracyEvolutionChart';
import { ConstanciaResumo } from '@/components/features/dashboard/ConstanciaResumo';
import { EnergiaDesempenho } from '@/components/features/dashboard/EnergiaDesempenho';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { PageContainer, PageHeader } from '@/components/ui/Page';

export default function PerformancePage() {
  const { isMobile, isTablet } = useUI();

  return (
    <PageContainer width="wide" style={{ minWidth: 0 }}>
      <PageHeader title="Performance" subtitle="Sua evolução em números — tempo, acertos e ritmo." />

      <div style={{ ...styles.grid, gridTemplateColumns: isMobile || isTablet ? '1fr' : 'repeat(2, 1fr)' }}>
        {/* ritmo de estudo — largura cheia, no topo (visão geral) */}
        <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
          <ConstanciaResumo />
        </div>

        {/* tempo de estudo — largura cheia */}
        <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
          <StudyTimeChart />
        </div>

        {/* acerto por matéria + evolução — lado a lado no desktop, empilham no mobile */}
        <div style={{ ...styles.card, padding: isMobile ? 16 : 24 }}>
          <AccuracyChart />
        </div>
        <div style={{ ...styles.card, padding: isMobile ? 16 : 24 }}>
          <AccuracyEvolutionChart />
        </div>

        {/* energia × desempenho — largura cheia */}
        <div style={{ ...styles.card, gridColumn: '1 / -1', padding: isMobile ? 16 : 24 }}>
          <EnergiaDesempenho />
        </div>
      </div>
    </PageContainer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, minWidth: 0 },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, minWidth: 0, overflow: 'hidden' },
};
