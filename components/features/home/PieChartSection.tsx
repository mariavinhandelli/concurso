'use client';

// Carregado com dynamic() em TimePieCard — mantém Recharts fora do bundle inicial.
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { CategorySlice } from '@/services/timeByCategory.service';
import { fmtMin } from '@/lib/format/time';
import { theme } from '@/lib/theme';

interface Props {
  slices: CategorySlice[];
  totalMinutes: number;
}

export function PieChartSection({ slices, totalMinutes }: Props) {
  return (
    <>
      <div style={styles.pieWrap}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="minutes"
              nameKey="subjectName"
              cx="50%" cy="50%"
              innerRadius={58} outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => <Cell key={s.subjectId} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={styles.centerLabel}>
          <div style={styles.centerValue}>{fmtMin(totalMinutes)}</div>
          <div style={styles.centerSub}>total</div>
        </div>
      </div>

      <div style={styles.list}>
        {slices.map((s) => (
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  pieWrap: { position: 'relative', margin: '8px 0 16px' },
  centerLabel: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' },
  centerValue: { fontSize: 22, fontWeight: 700, color: theme.ink, letterSpacing: -0.5 },
  centerSub: { fontSize: 12, color: theme.inkFaint },
  list: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: `0.5px solid ${theme.line}`, paddingTop: 14 },
  listRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, gap: 12 },
  listLeft: { display: 'flex', alignItems: 'center', gap: 9, color: theme.ink, minWidth: 0 },
  dot: { width: 11, height: 11, borderRadius: 3, flexShrink: 0 },
  listTime: { color: theme.inkSoft, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
};
