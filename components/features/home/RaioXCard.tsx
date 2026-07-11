// components/features/home/RaioXCard.tsx
// Raio-X da Prontidão — a resposta a "se a prova fosse hoje, como eu estaria?".
// Score global (cobertura × saúde × acerto, ponderado pelo peso no edital) +
// a matéria que mais precisa de atenção agora. Mesmo padrão visual de
// CoberturaEdital (hero number + barra segmentada + legenda).
'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRaioX, NIVEL_LABEL, type RaioX, type NivelProntidao } from '@/services/raiox.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

const NIVEL_COR: Record<NivelProntidao, string> = {
  construcao: theme.danger,
  progresso: theme.warn,
  quase_la: theme.teal,
  pronto: theme.ok,
};
const NIVEL_BG: Record<NivelProntidao, string> = {
  construcao: theme.dangerBg,
  progresso: theme.warnBg,
  quase_la: theme.tealBg,
  pronto: theme.okBg,
};

export const RaioXCard = memo(function RaioXCard() {
  const router = useRouter();
  const [expandido, setExpandido] = useState(false);
  const { data, isLoading, isError } = useQuery<RaioX>({
    queryKey: ['raiox'],
    queryFn: getRaioX,
  });

  if (isLoading) {
    return (
      <div style={styles.card}>
        <Skeleton width={170} height={11} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width={90} height={30} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton height={10} borderRadius={999} />
      </div>
    );
  }

  if (isError || !data) return null;

  if (!data.hasTarget) {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Raio-X da prontidão</span>
        <p style={styles.emptyMsg}>Defina seu concurso-alvo para descobrir se você estaria pronto para a prova hoje.</p>
        <button style={styles.ctaBtn} onClick={() => router.push('/targets')}>Definir concurso-alvo →</button>
      </div>
    );
  }

  if (!data.hasBlueprint || data.materias.length === 0) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>Raio-X da prontidão</span>
          <span style={styles.targetName}>{data.targetName}</span>
        </div>
        <p style={styles.emptyMsg}>Monte o edital com pesos por matéria e vincule os tópicos para calcular sua prontidão.</p>
        <button style={styles.ctaBtn} onClick={() => router.push('/targets')}>Montar edital →</button>
      </div>
    );
  }

  const { score, nivel, materias, focoPrincipal, targetName } = data;
  const visiveis = expandido ? materias : materias.slice(0, 3);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Raio-X da prontidão</span>
        <span style={styles.targetName}>{targetName}</span>
      </div>

      <div style={styles.heroRow}>
        <span style={styles.heroPct}>{score}</span>
        <div>
          <span style={{ ...styles.nivelChip, color: NIVEL_COR[nivel], background: NIVEL_BG[nivel] }}>{NIVEL_LABEL[nivel]}</span>
          <p style={styles.heroLabel}>se a prova fosse hoje</p>
        </div>
      </div>

      {/* Barra segmentada — largura proporcional ao peso, cor pelo score da matéria */}
      <div style={styles.bar}>
        {materias.map((m) => (
          <div key={m.subjectId} style={{ flex: m.weight, background: NIVEL_COR[nivelDeLocal(m.score)] }} title={`${m.subjectName}: ${m.score}%`} />
        ))}
      </div>

      {focoPrincipal && (
        <div style={styles.focoBox}>
          <p style={styles.focoTitulo}>
            🎯 Foco agora: <b>{focoPrincipal.subjectName}</b>
          </p>
          <p style={styles.focoDetalhe}>
            {focoPrincipal.semTopicosVinculados
              ? 'peso alto no edital, mas nenhum tópico vinculado ainda'
              : `score ${focoPrincipal.score}% · ${focoPrincipal.topicosNaoIniciados} de ${focoPrincipal.topicosTotal} tópicos não iniciados`}
          </p>
          <Button size="sm" onClick={() => router.push(`/subjects/${focoPrincipal.subjectId}`)}>
            Estudar {focoPrincipal.subjectName} →
          </Button>
        </div>
      )}

      <div style={styles.lista}>
        {visiveis.map((m) => (
          <div key={m.subjectId} style={styles.listaItem}>
            <span style={{ ...styles.listaDot, background: NIVEL_COR[nivelDeLocal(m.score)] }} />
            <span style={styles.listaNome}>{m.subjectName}</span>
            <span style={styles.listaScore}>{m.score}%</span>
          </div>
        ))}
      </div>

      {materias.length > 3 && (
        <button style={styles.verMaisBtn} onClick={() => setExpandido((v) => !v)}>
          {expandido ? 'ver menos' : `ver todas as ${materias.length} matérias`}
        </button>
      )}
    </div>
  );
});

function nivelDeLocal(score: number): NivelProntidao {
  if (score >= 85) return 'pronto';
  if (score >= 70) return 'quase_la';
  if (score >= 40) return 'progresso';
  return 'construcao';
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: '16px 18px', fontFamily: theme.font, minWidth: 0,
  },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  targetName: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },

  heroRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroPct: { fontSize: 36, fontWeight: 800, color: theme.ink, letterSpacing: -1, lineHeight: 1 },
  nivelChip: { fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '3px 10px' },
  heroLabel: { fontSize: 12.5, color: theme.inkFaint, margin: '4px 0 0' },

  bar: { display: 'flex', height: 10, background: theme.muted, borderRadius: 999, overflow: 'hidden', marginBottom: 14, gap: 1.5 },

  focoBox: { background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '12px 14px', marginBottom: 12 },
  focoTitulo: { fontSize: 13.5, color: theme.ink, margin: '0 0 3px' },
  focoDetalhe: { fontSize: 12.5, color: theme.inkSoft, margin: '0 0 10px' },
  focoBtn: { border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, borderRadius: theme.radiusSm, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' },

  lista: { display: 'flex', flexDirection: 'column', gap: 6 },
  listaItem: { display: 'flex', alignItems: 'center', gap: 8 },
  listaDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  listaNome: { fontSize: 13, color: theme.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listaScore: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums' },
  verMaisBtn: { marginTop: 10, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  emptyMsg: { fontSize: 14, color: theme.inkSoft, margin: '4px 0 0', lineHeight: 1.5 },
  ctaBtn: { marginTop: 12, border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
