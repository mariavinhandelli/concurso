// components/features/dashboard/StudyTimeChart.tsx
// Evolução: minutos estudados (teal) vs meta (terracota tracejada).
// Transparente — herda a superfície de quem o contém. Filtros dia/semana/mês/ano.
'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { theme } from '@/lib/theme';
import {
  getTimeSeries, type Granularity, type TimePoint,
} from '@/services/timeReports.service';

const FILTERS: { key: Granularity; label: string }[] = [
  { key: 'dia', label: 'Dia' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'ano', label: 'Ano' },
];

export function StudyTimeChart() {
  const [granularity, setGranularity] = useState<Granularity>('dia');
  const [data, setData] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTimeSeries(granularity).then(setData).finally(() => setLoading(false));
  }, [granularity]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h2 style={styles.title}>Evolução do tempo de estudo</h2>
        <div style={styles.filters}>
          {FILTERS.map((f) => {
            const active = granularity === f.key;
            return (
              <button
                className="touch-target"
                key={f.key}
                onClick={() => setGranularity(f.key)}
                style={{ ...styles.filterBtn, ...(active ? styles.filterBtnActive : {}) }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Skeleton height={220} borderRadius={12} />
      ) : (
        <ResponsiveContainer width="100%" height={260} minWidth={0}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: theme.card, border: `0.5px solid ${theme.line}`,
                borderRadius: theme.radiusSm, fontSize: 12, boxShadow: theme.shadow,
              }}
              labelStyle={{ color: theme.ink, fontWeight: 600 }}
              formatter={(v) => [`${v} min`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: theme.inkSoft }} />
            <Line
              type="monotone" dataKey="minutes" name="Estudado"
              stroke={theme.teal} strokeWidth={2.5}
              dot={{ r: 3, fill: theme.teal, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: theme.teal, strokeWidth: 0 }}
            />
            <Line
              type="monotone" dataKey="targetMinutes" name="Meta"
              stroke={theme.clay} strokeWidth={2} strokeDasharray="5 4" dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { margin: 0, fontSize: 16, color: theme.ink, fontWeight: 600, letterSpacing: -0.2 },
  filters: { display: 'flex', gap: 4, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm },
  filterBtn: {
    padding: '5px 13px', borderRadius: 9, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all .15s',
  },
  filterBtnActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
};
