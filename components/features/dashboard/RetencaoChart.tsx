// components/features/dashboard/RetencaoChart.tsx
// M3 — a métrica que separa ESTUDAR de APRENDER: evolução diária da saúde
// média dos tópicos (SRS + acerto + decaimento) e da cobertura do edital.
// Alimentado por snapshots reais (progress_snapshots); com poucos pontos o
// card diz honestamente que a curva está começando — nunca desenha passado.
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getRetentionCurve, type RetentionPoint } from '@/services/retention.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export function RetencaoChart() {
  const { data, isLoading, isError } = useQuery<RetentionPoint[]>({
    queryKey: ['retention-curve'],
    queryFn: () => getRetentionCurve(90),
    staleTime: 60 * 60_000, // snapshots mudam 1x/dia — cache generoso
  });

  const pontos = data ?? [];
  const comSaude = pontos.filter((p) => p.saudeMedia !== null);
  const poucosPontos = comSaude.length > 0 && comSaude.length < 3;

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Retenção ao longo do tempo</span>
        <span style={styles.subtitle}>Saúde média dos tópicos e cobertura do edital, dia a dia</span>
      </div>

      {isLoading ? (
        <Skeleton height={220} borderRadius={12} />
      ) : isError ? (
        <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar a curva. Tente novamente.</p>
      ) : comSaude.length === 0 ? (
        <p style={styles.muted}>
          A curva de retenção nasce dos seus estudos: estude tópicos e responda
          questões para o primeiro ponto aparecer no próximo registro diário.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240} minWidth={0}>
            <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.inkFaint }} stroke={theme.line}
                tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip
                contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, fontSize: 12, boxShadow: theme.shadow }}
                labelStyle={{ color: theme.ink, fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: theme.inkSoft }} />
              <Line type="monotone" dataKey="saudeMedia" name="Saúde média" connectNulls
                stroke={theme.teal} strokeWidth={2.5}
                dot={{ r: 3, fill: theme.teal, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: theme.teal, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="coveragePct" name="Cobertura do edital" connectNulls
                stroke={theme.clay} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          {poucosPontos && (
            <p style={styles.coletando}>
              A curva começou a ser registrada em {pontos[0].label} — cada dia
              acrescenta um ponto. Em algumas semanas ela conta a história inteira.
            </p>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  head: { marginBottom: 20 },
  eyebrow: { display: 'block', fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { display: 'block', fontSize: 13, color: theme.inkSoft, marginTop: 6 },
  muted: { color: theme.inkFaint, fontSize: 14, lineHeight: 1.5, padding: '30px 0', textAlign: 'center' },
  coletando: { fontSize: 12, color: theme.inkFaint, fontStyle: 'italic', margin: '12px 0 0' },
};
