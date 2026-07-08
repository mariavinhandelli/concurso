// components/features/dashboard/EnergiaDesempenho.tsx
// Cruza nível de energia (1–5) com acerto médio das sessões. Responde:
// "eu rendo mais quando estou com mais energia?".
'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { getEnergiaDesempenho, type EnergiaPonto } from '@/services/performance.service';
import { theme } from '@/lib/theme';
import { PerfInsight } from './PerfInsight';

const ENERGIA_LABEL: Record<number, string> = {
  1: 'Muito baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Muito alta',
};

export function EnergiaDesempenho() {
  const [pontos, setPontos] = useState<EnergiaPonto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEnergiaDesempenho().then((p) => { setPontos(p); setLoading(false); });
  }, []);

  const dados = pontos.map((p) => ({
    nome: ENERGIA_LABEL[p.energia] ?? `Nível ${p.energia}`,
    acerto: p.acertoMedio,
    sessoes: p.sessoes,
  }));

  // Leitura acionável: compara onde você mais e menos rende (níveis com sinal
  // suficiente) e vira uma recomendação de quando encarar o conteúdo difícil.
  const comSinal = pontos.filter((p) => p.sessoes >= 2);
  const melhor = comSinal.reduce<EnergiaPonto | null>((a, p) => (!a || p.acertoMedio > a.acertoMedio ? p : a), null);
  const pior = comSinal.reduce<EnergiaPonto | null>((a, p) => (!a || p.acertoMedio < a.acertoMedio ? p : a), null);
  const insight = melhor && pior && melhor.energia !== pior.energia && (melhor.acertoMedio - pior.acertoMedio) >= 8
    ? { melhor, pior, gap: melhor.acertoMedio - pior.acertoMedio }
    : null;

  return (
    <div>
      <div style={styles.head}>
        <h2 style={styles.title}>Energia × desempenho</h2>
        <span style={styles.hint}>acerto médio por nível de energia</span>
      </div>

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : dados.length === 0 ? (
        <p style={styles.muted}>
          Ainda não há sessões com energia e questões registradas. Conforme você
          registrar mais sessões, este gráfico se preenche.
        </p>
      ) : (
        <>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 11.5, fill: theme.inkSoft }}
                  axisLine={{ stroke: theme.line }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: theme.inkFaint }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: theme.muted, opacity: 0.4 }}
                  contentStyle={{
                    background: theme.card,
                    border: `0.5px solid ${theme.line}`,
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: theme.ink,
                    boxShadow: theme.shadow,
                  }}
                  formatter={(value, _name, props) => {
                    const sessoes = props?.payload?.sessoes ?? 0;
                    return [`${value}% de acerto · ${sessoes} ${sessoes === 1 ? 'sessão' : 'sessões'}`, ''];
                  }}
                />
                <Bar dataKey="acerto" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {dados.map((d, i) => (
                    <Cell key={i} fill={corPorAcerto(d.acerto)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dados.length < 2 && (
            <p style={styles.poucos}>
              Com mais níveis de energia registrados, dá pra comparar onde você rende melhor.
            </p>
          )}
          {insight && (
            <PerfInsight tone="info">
              Você acerta <b>{insight.melhor.acertoMedio}%</b> com energia {(ENERGIA_LABEL[insight.melhor.energia] ?? '').toLowerCase()},
              contra <b>{insight.pior.acertoMedio}%</b> com {(ENERGIA_LABEL[insight.pior.energia] ?? '').toLowerCase()}.
              Deixe as matérias mais difíceis para os seus horários de pico.
            </PerfInsight>
          )}
        </>
      )}
    </div>
  );
}

// Cor por faixa de acerto alinhada a benchmarks de concurso:
// ≥75% = zona de conforto pré-aprovação, <55% = abaixo de qualquer limiar de aprovação.
function corPorAcerto(acerto: number): string {
  if (acerto >= 75) return theme.ok;
  if (acerto >= 55) return theme.warn;
  return theme.crit;
}

const styles: Record<string, React.CSSProperties> = {
  muted: { color: theme.inkFaint, fontSize: 14, lineHeight: 1.5 },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  hint: { fontSize: 12.5, color: theme.inkFaint, fontWeight: 500 },
  poucos: { fontSize: 12, color: theme.inkFaint, fontStyle: 'italic', margin: '12px 0 0' },
};
