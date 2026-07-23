'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getTimeByCategory, type TimeByCategoryResult,
} from '@/services/timeByCategory.service';
import { theme } from '@/lib/theme';
import { ManualLogModal } from '@/components/features/timer/ManualLogModal';

// Recharts (~200 KB) carregado sob demanda — fora do bundle inicial da Home.
const PieChartSection = dynamic(
  () => import('./PieChartSection').then((m) => ({ default: m.PieChartSection })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 230, display: 'grid', placeItems: 'center' }}>
        <p style={{ fontSize: 14, color: theme.inkFaint, margin: 0 }}>Carregando gráfico…</p>
      </div>
    ),
  },
);

// A navegação por período (dia/semana/mês/total + offset) foi removida daqui:
// é ferramenta de análise exploratória, e isso já existe melhor na Performance
// (StudyTimeChart). A Home mostra só a semana corrente — "quanto estudei e em
// quê" — com um link para quem quiser explorar o histórico completo.
export const TimePieCard = memo(function TimePieCard() {
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);

  const { data, isError: loadError } = useQuery<TimeByCategoryResult>({
    queryKey: ['time-by-category', 'semana', 0],
    queryFn: () => getTimeByCategory('semana', 0),
  });

  const temDados = !loadError && data && data.slices.length > 0;

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Tempo de estudo</span>
        <span style={styles.periodLabel}>{data?.periodLabel ?? '…'}</span>
      </div>

      {loadError ? (
        <p style={{ ...styles.empty, color: theme.danger }}>Não foi possível carregar os dados. Tente novamente.</p>
      ) : !temDados ? (
        /* P11 — estado vazio com CTA */
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>Nenhum estudo registrado nesta semana.</p>
          <button className="touch-target" style={styles.emptyBtn} onClick={() => setLogOpen(true)}>
            Registrar estudo →
          </button>
        </div>
      ) : (
        <PieChartSection slices={data!.slices} totalMinutes={data!.totalMinutes} />
      )}

      <button style={styles.analiseLink} onClick={() => router.push('/performance')}>
        ver análise completa
        <ChevronRight size={13} strokeWidth={2.2} />
      </button>

      {logOpen && (
        <ManualLogModal onClose={() => setLogOpen(false)} onSaved={() => setLogOpen(false)} />
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, fontFamily: theme.font, minWidth: 0 },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
  periodLabel: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, textTransform: 'capitalize' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '30px 0' },
  empty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
  emptyBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  analiseLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', marginTop: 14,
    paddingTop: 12, border: 'none', borderTop: `0.5px solid ${theme.line}`,
    background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
};
