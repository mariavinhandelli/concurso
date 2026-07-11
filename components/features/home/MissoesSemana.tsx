// components/features/home/MissoesSemana.tsx
// 3 missões da semana atual — renovam sozinhas toda segunda-feira (rotação
// determinística no service, sem tabela nova). Diferente de badges (estoque,
// nunca reseta), missões são fluxo: dão motivo de voltar ESTA semana.
'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMissoesSemana, type MissoesSemana as MissoesSemanaData } from '@/services/missoes.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

// `bare`: renderiza sem o chrome de card próprio (para viver dentro do
// SemanaPanel, com o streak como laço central). Traz o próprio divisor no topo,
// então some por completo — sem divisor órfão — quando não há missões.
export const MissoesSemana = memo(function MissoesSemana({ bare = false }: { bare?: boolean } = {}) {
  const { data, isLoading, isError } = useQuery<MissoesSemanaData>({
    queryKey: ['missoes-semana'],
    queryFn: getMissoesSemana,
  });

  if (isLoading) {
    if (bare) return null; // dentro do painel, o streak já cobre o estado de carga
    return (
      <div style={styles.card}>
        <Skeleton width={150} height={11} borderRadius={4} style={{ marginBottom: 14 }} />
        {[0, 1, 2].map((i) => <Skeleton key={i} height={44} borderRadius={10} style={{ marginBottom: 8 }} />)}
      </div>
    );
  }

  if (isError || !data || data.missoes.length === 0) return null;

  const concluidas = data.missoes.filter((m) => m.concluida).length;
  const todasFeitas = concluidas === data.missoes.length;

  const Wrapper = bare
    ? ({ children }: { children: React.ReactNode }) => (
        <><div style={styles.divider} />{children}</>
      )
    : ({ children }: { children: React.ReactNode }) => <div style={styles.card}>{children}</div>;

  return (
    <Wrapper>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Missões da semana</span>
        <span style={styles.progressText}>{todasFeitas ? 'completas 🎉' : `${concluidas} de ${data.missoes.length}`}</span>
      </div>

      <div style={styles.lista}>
        {data.missoes.map((m) => (
          <div key={m.id} style={{ ...styles.item, ...(m.concluida ? styles.itemOn : {}) }}>
            <span style={{ ...styles.marker, ...(m.concluida ? styles.markerOn : {}) }}>
              {m.concluida ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.onOk} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : null}
            </span>
            <div style={styles.itemText}>
              <span style={{ ...styles.itemLabel, ...(m.concluida ? styles.itemLabelDone : {}) }}>{m.label}</span>
              <span style={styles.itemSub}>
                {m.concluida ? m.descricao : `${m.current}${m.unit ? '' : ''} de ${m.target}${m.unit ? ' ' + m.unit : ''}`}
              </span>
            </div>
            {!m.concluida && m.target > 1 && (
              <div style={styles.miniBarWrap}>
                <div style={{ ...styles.miniBarFill, width: `${Math.round(m.progress * 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Wrapper>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: '16px 18px', fontFamily: theme.font, minWidth: 0,
  },
  divider: { height: '0.5px', background: theme.line, margin: '16px 0' },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  progressText: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft },

  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg },
  itemOn: { borderColor: theme.tealSoft, background: theme.tealBg },
  marker: { width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', border: `1.5px solid ${theme.line}`, background: theme.card },
  markerOn: { background: theme.ok, borderColor: theme.ok },
  itemText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  itemLabel: { fontSize: 13.5, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemLabelDone: { color: theme.inkSoft },
  itemSub: { fontSize: 12, color: theme.inkFaint },
  miniBarWrap: { width: 50, height: 5, background: theme.muted, borderRadius: 999, overflow: 'hidden', flexShrink: 0 },
  miniBarFill: { height: '100%', background: theme.teal, borderRadius: 999 },
};
