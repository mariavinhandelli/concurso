// components/features/dashboard/AccuracyChart.tsx
// Barras horizontais de % de acerto por matéria (pior no topo = onde focar).
// A cor reflete o desempenho: vermelho (crítico) → âmbar → verde.
'use client';

import { useEffect, useState } from 'react';
import {
  getAccuracyBySubject, type AccuracyPoint,
} from '@/services/accuracyReports.service';
import { theme, perfColor } from '@/lib/theme';

export function AccuracyChart() {
  const [data, setData] = useState<AccuracyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccuracyBySubject()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Acertos por matéria</span>
        <span style={styles.subtitle}>Da menor taxa — onde focar primeiro</span>
      </div>

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : data.length === 0 ? (
        <p style={styles.muted}>
          Ainda sem dados. Faça sessões de questões com matéria e acertos registrados.
        </p>
      ) : (
        <div style={styles.list}>
          {data.map((d) => {
            const c = perfColor(d.pct / 100);
            return (
              <div key={d.subjectName} style={styles.row}>
                <div style={styles.rowHeader}>
                  <span style={styles.name}>{d.subjectName}</span>
                  <span style={styles.stat}>
                    <b style={{ color: c.fg, fontWeight: 700 }}>{d.pct}%</b>
                    <span style={styles.frac}>{d.correct}/{d.total}</span>
                  </span>
                </div>
                <div style={styles.track}>
                  <div style={{ ...styles.fill, width: `${d.pct}%`, background: c.fg }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  head: { marginBottom: 20 },
  eyebrow: { display: 'block', fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { display: 'block', fontSize: 13, color: theme.inkSoft, marginTop: 6 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  row: {},
  rowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  name: { fontSize: 14, color: theme.ink, fontWeight: 500 },
  stat: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 },
  frac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  track: { height: 10, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
};