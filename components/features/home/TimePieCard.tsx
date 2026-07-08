'use client';

import { memo, useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  getTimeByCategory, type PeriodView, type TimeByCategoryResult,
} from '@/services/timeByCategory.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
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

const ABAS: { key: PeriodView; label: string }[] = [
  { key: 'dia', label: 'Diário' },
  { key: 'semana', label: 'Semanal' },
  { key: 'mes', label: 'Mensal' },
  { key: 'total', label: 'Total' },
];

const VALID_VIEWS: PeriodView[] = ['dia', 'semana', 'mes', 'total'];
const parsePieView = (v: string | null): PeriodView =>
  VALID_VIEWS.includes(v as PeriodView) ? (v as PeriodView) : 'semana';

export const TimePieCard = memo(function TimePieCard() {
  const { isMobile } = useUI();
  // P20 — persistir última aba; default "semana". SSR-safe (sem mismatch de hidratação).
  const [view, setView] = usePersistedState<PeriodView>('pie:view', 'semana', parsePieView);
  const [offset, setOffset] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  const { data, isError: loadError } = useQuery<TimeByCategoryResult>({
    queryKey: ['time-by-category', view, offset],
    queryFn: () => getTimeByCategory(view, offset),
  });

  function trocarView(v: PeriodView) {
    setView(v); // usePersistedState já grava no localStorage
    setOffset(0);
  }

  const temDados = !loadError && data && data.slices.length > 0;

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Tempo de estudo</span>
      </div>

      <div style={styles.tabs}>
        {ABAS.map((a) => (
          <button
            className="touch-target"
            key={a.key}
            onClick={() => trocarView(a.key)}
            style={{
              ...styles.tab,
              padding: isMobile ? '7px 4px' : '7px 10px',
              fontSize: isMobile ? 12 : 13,
              ...(view === a.key ? styles.tabOn : {}),
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {view !== 'total' && (
        <div style={styles.nav}>
          <button style={styles.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Período anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span style={{ ...styles.navLabel, minWidth: isMobile ? 0 : 120, flex: isMobile ? 1 : undefined }}>{data?.periodLabel ?? '…'}</span>
          <button
            style={{ ...styles.navBtn, ...(data && !data.canGoForward ? styles.navBtnOff : {}) }}
            onClick={() => data?.canGoForward && setOffset((o) => o + 1)}
            disabled={!data?.canGoForward}
            aria-label="Próximo período"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      {loadError ? (
        <p style={{ ...styles.empty, color: theme.danger }}>Não foi possível carregar os dados. Tente novamente.</p>
      ) : !temDados ? (
        /* P11 — estado vazio com CTA */
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>Nenhum estudo registrado neste período.</p>
          <button className="touch-target" style={styles.emptyBtn} onClick={() => setLogOpen(true)}>
            Registrar estudo →
          </button>
        </div>
      ) : (
        <PieChartSection slices={data!.slices} totalMinutes={data!.totalMinutes} />
      )}

      {logOpen && (
        <ManualLogModal onClose={() => setLogOpen(false)} onSaved={() => setLogOpen(false)} />
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, fontFamily: theme.font, minWidth: 0 },
  head: { marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabs: { display: 'flex', gap: 4, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3, marginBottom: 14 },
  tab: { flex: 1, padding: '7px 10px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2, whiteSpace: 'nowrap' },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 6 },
  navBtn: { width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  navBtnOff: { opacity: 0.3, cursor: 'not-allowed' },
  navLabel: { fontSize: 14, fontWeight: 600, color: theme.ink, minWidth: 120, textAlign: 'center', textTransform: 'capitalize' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '30px 0' },
  empty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
  emptyBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
