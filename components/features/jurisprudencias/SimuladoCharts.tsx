'use client';
// Auditoria de performance (02/08) — extraído de app/(app)/jurisprudencias/
// simulados/page.tsx: era o único ponto do app que importava `recharts`
// estático no topo da página (~200-285KB no JS inicial da rota, mesmo antes
// de rolar até o gráfico). Isolado aqui e consumido via next/dynamic
// ({ssr:false}) no page.tsx, mesmo padrão já usado em app/(app)/progresso/
// page.tsx (StudyTimeChart, AccuracyEvolutionChart, etc.).

import { theme } from '@/lib/theme';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';

export interface EvolucaoPonto {
  label: string;
  pct: number;
}

export interface DisciplinaPonto {
  name: string;
  pct: number;
  total: number;
}

export function SimuladoCharts({
  evolucao, disciplinas,
}: {
  evolucao: EvolucaoPonto[];
  disciplinas: DisciplinaPonto[];
}) {
  return (
    <>
      <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 14px' }}>
          Evolução de score (últimas {evolucao.length} sessões)
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={evolucao} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.line} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.inkFaint }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => [`${v}%`, 'Acerto']} contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, fontSize: 12 }} />
            <Line type="monotone" dataKey="pct" stroke={theme.teal} strokeWidth={2} dot={{ r: 3, fill: theme.teal }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {disciplinas.length > 0 && (
        <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 14px' }}>
            Acerto por disciplina (todas as sessões)
          </p>
          <ResponsiveContainer width="100%" height={Math.max(120, disciplinas.length * 30)}>
            <BarChart layout="vertical" data={disciplinas} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: theme.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: theme.ink }} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v) => [`${v}%`, 'Acerto']} contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, fontSize: 12 }} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}
                fill={theme.teal}
                label={{ position: 'right', formatter: (v: unknown) => `${v}%`, style: { fontSize: 11, fill: theme.inkSoft } }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

export default SimuladoCharts;
