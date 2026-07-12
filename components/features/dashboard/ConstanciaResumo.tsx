// components/features/dashboard/ConstanciaResumo.tsx
// Painel de ritmo de estudo: métricas do período (30 dias) + total geral.
'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { getConstanciaResumo, type ConstanciaResumo as Resumo } from '@/services/performance.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

function formataHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)}h`;
}

export function ConstanciaResumo() {
  const { isMobile } = useUI();
  const [data, setData] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConstanciaResumo(30).then((r) => { setData(r); setLoading(false); });
  }, []);

  if (loading) return <Skeleton height={64} borderRadius={12} />;
  if (!data) return <p style={styles.muted}>Sem dados de estudo ainda.</p>;

  const metricasPeriodo = [
    { valor: formataHoras(data.horasPeriodo), rotulo: 'horas em 30 dias' },
    { valor: formataHoras(data.mediaHorasDia), rotulo: 'média por dia' },
    { valor: data.sessoesPorSemana.toFixed(1), rotulo: 'sessões / semana' },
    { valor: `${data.sequenciaAtual}`, rotulo: data.sequenciaAtual === 1 ? 'dia seguido' : 'dias seguidos' },
  ];

  return (
    <div>
      <div style={styles.head}>
        <h2 style={styles.title}>Ritmo de estudo</h2>
        <span style={styles.period}>últimos 30 dias</span>
      </div>

      <div style={{ ...styles.metricsGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
        {metricasPeriodo.map((m) => (
          <div key={m.rotulo} style={styles.metric}>
            <span style={styles.metricValue}>{m.valor}</span>
            <span style={styles.metricLabel}>{m.rotulo}</span>
          </div>
        ))}
      </div>

      <div style={styles.totalRow}>
        <span style={styles.totalItem}>
          <b style={styles.totalNum}>{formataHoras(data.horasTotal)}</b> no total
        </span>
        <span style={styles.totalSep}>·</span>
        <span style={styles.totalItem}>
          <b style={styles.totalNum}>{data.sessoesTotal}</b> {data.sessoesTotal === 1 ? 'sessão' : 'sessões'}
        </span>
        <span style={styles.totalSep}>·</span>
        <span style={styles.totalItem}>
          recorde anual de <b style={styles.totalNum}>{data.recorde}</b> dias
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  muted: { color: theme.inkFaint, fontSize: 14 },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  period: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  metricsGrid: { display: 'grid', gap: 14, marginBottom: 18 },
  metric: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  metricValue: { fontSize: 24, fontWeight: 800, color: theme.teal, letterSpacing: -0.6 },
  metricLabel: { fontSize: 12, color: theme.inkSoft, fontWeight: 500 },
  totalRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 16, borderTop: `0.5px solid ${theme.line}` },
  totalItem: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  totalNum: { color: theme.ink, fontWeight: 700 },
  totalSep: { color: theme.inkFaint },
};
