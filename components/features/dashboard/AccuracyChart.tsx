// components/features/dashboard/AccuracyChart.tsx
// Barras horizontais de % de acerto por matéria (pior no topo = onde focar).
// A cor reflete o desempenho: vermelho (crítico) → âmbar → verde.
'use client';

import { Skeleton } from '@/components/ui/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  getAccuracyBySubject, type AccuracyPoint,
} from '@/services/accuracyReports.service';
import { theme, perfColor } from '@/lib/theme';
import { PerfInsight } from './PerfInsight';

// Abaixo disso a matéria precisa de atenção (mesma régua do perfColor: <65%).
const LIMIAR_ATENCAO = 65;
// Amostra mínima para RECOMENDAR uma matéria. Sem isso, uma única questão
// errada colocava a matéria no topo da lista (ordenada por % asc) e virava o
// insight principal da plataforma: "Reforçar X — é sua menor taxa (0%)".
// Mesmo limiar de metrics.service (<30 questões → margem de erro ±16%).
const MIN_QUESTOES_CONFIAVEL = 30;

export function AccuracyChart() {
  const router = useRouter();
  const { data = [], isLoading: loading, isError: error } = useQuery<AccuracyPoint[]>({
    queryKey: ['accuracy-by-subject'],
    queryFn: getAccuracyBySubject,
    staleTime: 5 * 60_000,
  });

  // data já vem ordenada da menor taxa para a maior, mas só matérias com
  // amostra suficiente podem virar recomendação.
  const confiaveis = data.filter((d) => d.total >= MIN_QUESTOES_CONFIAVEL);
  const pior = confiaveis[0] ?? null;
  const temAmostraCurta = data.length > 0 && confiaveis.length === 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>Acertos por matéria</h2>
        <span style={styles.subtitle}>da menor taxa — onde focar primeiro</span>
      </div>

      {loading ? (
        <Skeleton height={220} borderRadius={12} />
      ) : error ? (
        <p style={{ ...styles.muted, color: theme.danger }}>Não foi possível carregar os dados. Tente novamente.</p>
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

      {/* Amostra insuficiente em todas as matérias: dizer isso é mais honesto
          que apontar uma "pior matéria" baseada em meia dúzia de questões. */}
      {!loading && !error && temAmostraCurta && (
        <PerfInsight tone="info">
          Ainda são poucas questões por matéria para uma leitura confiável.
          A partir de {MIN_QUESTOES_CONFIAVEL} questões numa matéria, apontamos onde focar.
        </PerfInsight>
      )}

      {/* Insight acionável: aponta a matéria mais fraca e leva direto a ela. */}
      {!loading && !error && pior && (
        pior.pct < LIMIAR_ATENCAO ? (
          <PerfInsight
            tone="warn"
            cta={{ label: `Reforçar ${pior.subjectName}`, onClick: () => router.push(`/subjects/${pior.subjectId}`) }}
          >
            <b>{pior.subjectName}</b> é sua menor taxa ({pior.pct}%). Reforçar aqui rende
            mais que praticar o que você já domina.
          </PerfInsight>
        ) : (
          <PerfInsight tone="ok">
            Nenhuma matéria crítica — a menor está em {pior.pct}%. Bom equilíbrio, siga mantendo.
          </PerfInsight>
        )
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', boxSizing: 'border-box' },
  // Mesma gramática de cabeçalho dos demais cards da Evolução (Ritmo, Tempo,
  // Energia): h2 16px + hint — o eyebrow maiúsculo destoava lado a lado.
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  row: {},
  rowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  name: { fontSize: 14, color: theme.ink, fontWeight: 500 },
  stat: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 },
  frac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  track: { height: 10, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: theme.radiusPill, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
};