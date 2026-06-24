// components/features/home/TimePieCard.tsx
// Tempo de estudo por disciplina: pizza + lista, com abas (dia/semana/mês/total)
// e navegação < > entre períodos (livre pro passado, bloqueando o futuro).
'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  getTimeByCategory, type PeriodView, type TimeByCategoryResult,
} from '@/services/timeByCategory.service';
import { theme } from '@/lib/theme';

const ABAS: { key: PeriodView; label: string }[] = [
  { key: 'dia', label: 'Diário' },
  { key: 'semana', label: 'Semanal' },
  { key: 'mes', label: 'Mensal' },
  { key: 'total', label: 'Total' },
];

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${h}h`;
}

export function TimePieCard() {
  const [view, setView] = useState<PeriodView>('dia');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<TimeByCategoryResult | null>(null);

  useEffect(() => {
    getTimeByCategory(view, offset).then(setData).catch(() => setData(null));
  }, [view, offset]);

  // Ao trocar de aba, volta pro período atual.
  function trocarView(v: PeriodView) {
    setView(v);
    setOffset(0);
  }

  const temDados = data && data.slices.length > 0;

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Tempo de estudo</span>
      </div>

      {/* Abas de visualização */}
      <div style={styles.tabs}>
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => trocarView(a.key)}
            style={{ ...styles.tab, ...(view === a.key ? styles.tabOn : {}) }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Navegação de período (some no Total) */}
      {view !== 'total' && (
        <div style={styles.nav}>
          <button style={styles.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Período anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span style={styles.navLabel}>{data?.periodLabel ?? '…'}</span>
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

      {!temDados ? (
        <p style={styles.empty}>Nenhum estudo registrado neste período.</p>
      ) : (
        <>
          {/* Pizza com total no centro */}
          <div style={styles.pieWrap}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data!.slices}
                  dataKey="minutes"
                  nameKey="subjectName"
                  cx="50%" cy="50%"
                  innerRadius={58} outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data!.slices.map((s) => <Cell key={s.subjectId} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={styles.centerLabel}>
              <div style={styles.centerValue}>{fmtMin(data!.totalMinutes)}</div>
              <div style={styles.centerSub}>total</div>
            </div>
          </div>

          {/* Lista de disciplinas */}
          <div style={styles.list}>
            {data!.slices.map((s) => (
              <div key={s.subjectId} style={styles.listRow}>
                <span style={styles.listLeft}>
                  <span style={{ ...styles.dot, background: s.color }} />
                  {s.subjectName}
                </span>
                <span style={styles.listTime}>{fmtMin(s.minutes)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, fontFamily: theme.font },
  head: { marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabs: { display: 'flex', gap: 4, background: theme.muted, borderRadius: theme.radiusSm, padding: 3, marginBottom: 14 },
  tab: { flex: 1, padding: '7px 10px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  tabOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 6 },
  navBtn: { width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  navBtnOff: { opacity: 0.3, cursor: 'not-allowed' },
  navLabel: { fontSize: 14, fontWeight: 600, color: theme.ink, minWidth: 120, textAlign: 'center', textTransform: 'capitalize' },
  empty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },
  pieWrap: { position: 'relative', margin: '8px 0 16px' },
  centerLabel: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' },
  centerValue: { fontSize: 22, fontWeight: 700, color: theme.ink, letterSpacing: -0.5 },
  centerSub: { fontSize: 12, color: theme.inkFaint },
  list: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: `0.5px solid ${theme.line}`, paddingTop: 14 },
  listRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 },
  listLeft: { display: 'flex', alignItems: 'center', gap: 9, color: theme.ink },
  dot: { width: 11, height: 11, borderRadius: 3, flexShrink: 0 },
  listTime: { color: theme.inkSoft, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
};