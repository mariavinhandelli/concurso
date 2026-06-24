// app/(app)/performance/page.tsx
'use client';

import { StudyTimeChart } from '@/components/features/dashboard/StudyTimeChart';
import { AccuracyChart } from '@/components/features/dashboard/AccuracyChart';
import { AccuracyEvolutionChart } from '@/components/features/dashboard/AccuracyEvolutionChart';
import { ConstanciaResumo } from '@/components/features/dashboard/ConstanciaResumo';
import { EnergiaDesempenho } from '@/components/features/dashboard/EnergiaDesempenho';
import { theme } from '@/lib/theme';

export default function PerformancePage() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Performance</h1>
        <p style={styles.sub}>Sua evolução em números — tempo, acertos e ritmo.</p>
      </div>

      <div style={styles.grid}>
        {/* ritmo de estudo — largura cheia, no topo (visão geral) */}
        <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <ConstanciaResumo />
        </div>

        {/* tempo de estudo — largura cheia */}
        <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <StudyTimeChart />
        </div>

        {/* acerto por matéria + evolução — lado a lado */}
        <div style={styles.card}>
          <AccuracyChart />
        </div>
        <div style={styles.card}>
          <AccuracyEvolutionChart />
        </div>

        {/* energia × desempenho — largura cheia */}
        <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <EnergiaDesempenho />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font },
  header: { marginBottom: 24 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24 },
};