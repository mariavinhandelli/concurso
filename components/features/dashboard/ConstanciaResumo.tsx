// components/features/dashboard/ConstanciaResumo.tsx
// Painel de ritmo de estudo: métricas do período (30 dias) + total geral.
'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { getConstanciaResumo, type ConstanciaResumo as Resumo } from '@/services/performance.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

function formataHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1).replace('.', ',')}h`;
}

// M5 — delta "você vs. você" (janela atual vs. a mesma janela imediatamente
// anterior). Subir é verde; descer é neutro (informar sem punir).
function Delta({ atual, anterior, fmt, dias }: {
  atual: number; anterior: number; fmt: (diff: number) => string; dias: number;
}) {
  const diff = atual - anterior;
  if (diff === 0) return null;
  const sobe = diff > 0;
  return (
    <span style={{ ...styles.delta, color: sobe ? theme.okDeep : theme.inkFaint }}>
      {sobe ? '▲' : '▼'} {fmt(Math.abs(diff))} vs. {dias} anteriores
    </span>
  );
}

const PERIODOS = [
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
];

export function ConstanciaResumo() {
  const { isMobile } = useUI();
  const [dias, setDias] = useState(30);
  // React Query: cache entre navegações, dedupe com a Home e invalidação por
  // refreshHomeAfterSession — antes era useEffect cru, refazia tudo a cada visita.
  const { data, isLoading } = useQuery<Resumo | null>({
    queryKey: ['constancia-resumo', dias],
    queryFn: () => getConstanciaResumo(dias),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <Skeleton height={64} borderRadius={12} />;
  if (!data) return <p style={styles.muted}>Sem dados de estudo ainda.</p>;

  // Deltas só quando a janela anterior teve QUALQUER atividade — comparar com
  // o vazio ("+2h vs. nada") é ruído, não leitura.
  const temJanelaAnterior = data.prevHorasPeriodo > 0 || data.prevDiasAtivos > 0;

  const metricasPeriodo: { valor: string; rotulo: string; delta?: React.ReactNode }[] = [
    // "tempo", não "horas": com pouco volume o valor renderiza em minutos
    // ("2 min") e o rótulo antigo contradizia o número.
    {
      valor: formataHoras(data.horasPeriodo), rotulo: `tempo em ${dias} dias`,
      delta: temJanelaAnterior && <Delta atual={data.horasPeriodo} anterior={data.prevHorasPeriodo} fmt={formataHoras} dias={dias} />,
    },
    // "dias ativos" em vez de média diluída em N dias corridos: é o número que
    // o usuário reconhece como o próprio ritmo.
    {
      valor: `${data.diasAtivosPeriodo}`, rotulo: data.diasAtivosPeriodo === 1 ? 'dia estudado' : 'dias estudados',
      delta: temJanelaAnterior && <Delta atual={data.diasAtivosPeriodo} anterior={data.prevDiasAtivos} fmt={(d) => `${d} ${d === 1 ? 'dia' : 'dias'}`} dias={dias} />,
    },
    // Acerto entrou no lugar de "média por dia estudado" (derivada de tempo ÷
    // dias — decorativa). Acerto é a métrica que muda decisão.
    {
      valor: data.acertoPct !== null ? `${data.acertoPct}%` : '—',
      rotulo: 'acerto em questões',
      delta: data.acertoPct !== null && data.prevAcertoPct !== null
        && <Delta atual={data.acertoPct} anterior={data.prevAcertoPct} fmt={(d) => `${d} pp`} dias={dias} />,
    },
    { valor: `${data.sequenciaAtual}`, rotulo: data.sequenciaAtual === 1 ? 'dia seguido' : 'dias seguidos' },
  ];

  return (
    <div>
      <div style={styles.head}>
        <h2 style={styles.title}>Ritmo de estudo</h2>
        <div style={styles.filtros}>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              className="touch-target"
              onClick={() => setDias(p.dias)}
              style={{ ...styles.filtroBtn, ...(dias === p.dias ? styles.filtroBtnAtivo : {}) }}
              aria-pressed={dias === p.dias}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...styles.metricsGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
        {metricasPeriodo.map((m) => (
          <div key={m.rotulo} style={styles.metric}>
            <span style={styles.metricValue}>{m.valor}</span>
            <span style={styles.metricLabel}>{m.rotulo}</span>
            {m.delta || null}
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
          {/* "recorde anual" era falso: getStreak calcula sobre ~3 anos. */}
          recorde de <b style={styles.totalNum}>{data.recorde}</b> {data.recorde === 1 ? 'dia' : 'dias'}
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
  filtros: { display: 'flex', gap: 4, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, flexShrink: 0 },
  filtroBtn: { padding: '5px 11px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  filtroBtnAtivo: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  metricsGrid: { display: 'grid', gap: 14, marginBottom: 18 },
  metric: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  metricValue: { fontSize: 24, fontWeight: 800, color: theme.teal, letterSpacing: -0.6 },
  metricLabel: { fontSize: 12, color: theme.inkSoft, fontWeight: 500 },
  delta: { fontSize: 11, fontWeight: 600, lineHeight: 1.3 },
  totalRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 16, borderTop: `0.5px solid ${theme.line}` },
  totalItem: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  totalNum: { color: theme.ink, fontWeight: 700 },
  totalSep: { color: theme.inkFaint },
};
