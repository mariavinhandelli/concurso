// components/features/dashboard/AccuracyEvolutionChart.tsx
// Evolução semanal da taxa de acerto, com filtro por matéria.
'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [selected, setSelected] = useState<string>('');

  // React Query: a key inclui o filtro, então trocar de matéria não tem race
  // (cada resposta cai na sua key) e voltar a um filtro já visto é instantâneo.
  const { data: subjects = [], isError: subjectsError } = useQuery<SubjectOption[]>({
    queryKey: ['subjects-with-questions'],
    queryFn: listSubjectsWithQuestions,
    staleTime: 5 * 60_000,
  });
  // Filtro é acessório: se falhar, o gráfico "Geral" continua funcionando —
  // avisa uma vez em vez de quebrar o card.
  useEffect(() => {
    if (subjectsError) toast.error('Erro ao carregar filtro de matérias.');
  }, [subjectsError, toast]);

  const { data = [], isLoading: loading, isError: error } = useQuery<EvolutionPoint[]>({
    queryKey: ['accuracy-evolution', selected || 'geral'],
    queryFn: () => getAccuracyEvolution(selected || null),
    staleTime: 5 * 60_000,
  });

  const hasData = data.some((d) => d.total > 0);
  // Semana com pouca amostra: 2 questões certas viram "100%" e a linha mente.
  // O ponto fica VAZADO (anel) e uma nota explica — o dado aparece, mas com o
  // peso visual que merece. Mesmo espírito do MIN_QUESTOES_CONFIAVEL do insight.
  const MIN_QUESTOES_SEMANA = 10;
  const temSemanaFraca = data.some((d) => d.total > 0 && d.total < MIN_QUESTOES_SEMANA);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Evolução nas questões</h2>
          <span style={styles.subtitle}>taxa de acerto semanal (últimas 12 semanas)</span>
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
            {/* connectNulls: semanas sem questões são lacuna (null), não zero —
                a linha atravessa por cima em vez de mergulhar até o eixo. */}
            <Area type="monotone" dataKey="pct" stroke="none" fill="url(#accEvo)" connectNulls />
            <Line type="monotone" dataKey="pct" name="Acerto" connectNulls
              stroke={theme.teal} strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; value?: number | null; payload?: EvolutionPoint; index?: number }) => {
                const { cx, cy, value, payload, index } = props;
                if (cx == null || cy == null || value == null) return <g key={`d-${index}`} />;
                const fraca = (payload?.total ?? 0) < MIN_QUESTOES_SEMANA;
                return fraca
                  ? <circle key={`d-${index}`} cx={cx} cy={cy} r={3.5} fill={theme.card} stroke={theme.teal} strokeWidth={1.5} />
                  : <circle key={`d-${index}`} cx={cx} cy={cy} r={3} fill={theme.teal} />;
              }}
              activeDot={{ r: 5, fill: theme.teal, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {!loading && !error && hasData && temSemanaFraca && (
        <p style={styles.amostra}>
          Pontos vazados = semanas com menos de {MIN_QUESTOES_SEMANA} questões — leitura só indicativa.
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  // Gramática única dos cards da Evolução: h2 16px + hint (sem eyebrow maiúsculo).
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  subtitle: { display: 'block', fontSize: 13, color: theme.inkFaint, fontWeight: 500, marginTop: 4 },
  muted: { color: theme.inkFaint, fontSize: 14, padding: '30px 0', textAlign: 'center' },
  amostra: { fontSize: 12, color: theme.inkFaint, fontStyle: 'italic', margin: '10px 0 0' },
};
