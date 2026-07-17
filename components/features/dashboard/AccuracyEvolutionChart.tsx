// components/features/dashboard/AccuracyEvolutionChart.tsx
// Evolução semanal da taxa de acerto, com filtro por matéria.
'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  Line, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getAccuracyEvolution, listSubjectsWithQuestions,
  type EvolutionPoint, type SubjectOption,
} from '@/services/accuracyEvolution.service';
import { theme } from '@/lib/theme';
import { Select } from '@/components/ui/Select';

export function AccuracyEvolutionChart() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<EvolutionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listSubjectsWithQuestions().then(setSubjects).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar filtro de matérias.'));
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getAccuracyEvolution(selected || null)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selected]);

  const hasData = data.some((d) => d.total > 0);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Evolução nas questões</span>
          <span style={styles.subtitle}>Taxa de acerto semanal (últimas 12 semanas)</span>
        </div>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: 'min(220px, 100%)', maxWidth: '100%', fontSize: 13 }} aria-label="Filtrar por matéria">
          <option value="">Geral</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      {loading ? (
        <Skeleton height={220} borderRadius={12} />
      ) : error ? (
        <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar os dados. Tente novamente.</p>
      ) : !hasData ? (
        <p style={styles.muted}>
          Sem questões registradas ainda neste recorte. Faça sessões de questões com acertos.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="accEvo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.teal} stopOpacity={0.18} />
                <stop offset="100%" stopColor={theme.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line}
              tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, fontSize: 12, boxShadow: theme.shadow }}
              labelStyle={{ color: theme.ink, fontWeight: 600 }}
              formatter={(v, _n, item) => {
                const total = (item?.payload as EvolutionPoint)?.total ?? 0;
                return [`${v}% (${total} questões)`, 'Acerto'];
              }}
            />
            <Area type="monotone" dataKey="pct" stroke="none" fill="url(#accEvo)" />
            <Line type="monotone" dataKey="pct" name="Acerto"
              stroke={theme.teal} strokeWidth={2.5}
              dot={{ r: 3, fill: theme.teal, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: theme.teal, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  eyebrow: { display: 'block', fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { display: 'block', fontSize: 13, color: theme.inkSoft, marginTop: 6 },
  muted: { color: theme.inkFaint, fontSize: 14, padding: '30px 0', textAlign: 'center' },
};
