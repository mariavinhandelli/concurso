// components/features/streak/StreakBar.tsx
// Constância: barra horizontal de dias, colunas finas de ponta a ponta.
// Verde-escuro = bateu meta · verde-claro = estudou · cinza = falhou (quebrou
// sequência) · muted = ainda não comecei. Frase + recorde em cima, legenda embaixo.
// No mobile mostra 30 dias (em vez de 60) para manter as células legíveis.
'use client';

import { useEffect, useState } from 'react';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { toLocalDateString } from '@/lib/local-date';

const COR = {
  meta: '#22c55e',        // bateu a meta
  estudou: '#6366F1', // estudou (sem bater meta)
  falhou: '#e5e7e2',       // cinza — quebrou sequência
  vazio: theme.muted,      // ainda não comecei
};

export function StreakBar() {
  const { isMobile } = useUI();
  const [info, setInfo] = useState<StreakInfo | null>(null);

  useEffect(() => {
    getStreak().then(setInfo).catch(() => {});
  }, []);

  if (!info) {
    return <p style={styles.muted}>Carregando…</p>;
  }

  // Mostra menos dias no mobile pra cada célula não virar um fio de 2px.
  const totalDias = isMobile ? 30 : 60;
  const dias = info.lastDays.slice(-totalDias);

  // Descobre o primeiro dia com estudo: antes dele, vazio = "não comecei" (cinza);
  // depois dele, vazio = "falhou" (cinza-escuro).
  const primeiroEstudo = dias.findIndex((d) => d.minutes > 0);

  function corDoDia(d: { minutes: number; metGoal: boolean }, idx: number): string {
    if (d.minutes > 0) return d.metGoal ? COR.meta : COR.estudou;
    // dia vazio: falha só se já tinha começado antes
    if (primeiroEstudo !== -1 && idx > primeiroEstudo) return COR.falhou;
    return COR.vazio;
  }

  const hojeStr = toLocalDateString();

  return (
    <div style={styles.wrap}>
      {/* Linha de cima: frase + recorde */}
      <div style={styles.header}>
        <span style={styles.phrase}>
          {info.current > 0 ? (
            <>Você está há <b style={styles.hi}>{info.current} {info.current === 1 ? 'dia' : 'dias'}</b> sem falhar!</>
          ) : (
            <>Comece hoje uma nova sequência de estudos.</>
          )}
          {!info.studiedToday && info.current > 0 && (
            <span style={styles.warn}> Estude hoje para manter.</span>
          )}
        </span>
        <span style={styles.record}>recorde anual: <b style={{ color: theme.ink }}>{info.longest} dias</b></span>
      </div>

      {/* Barra de colunas finas, de ponta a ponta */}
      <div style={styles.bar}>
        {dias.map((d, idx) => (
          <div
            key={d.date}
            title={`${new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')} · ${d.minutes} min`}
            style={{
              ...styles.cell,
              height: isMobile ? 30 : 26,
              background: corDoDia(d, idx),
              ...(d.date === hojeStr ? styles.cellToday : {}),
            }}
          />
        ))}
      </div>

      {/* Legenda discreta embaixo */}
      <div style={styles.legend}>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.meta }} />bateu a meta</span>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.estudou }} /> estudou</span>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.falhou }} /> falhou</span>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.vazio }} /> sem registro</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  phrase: { fontSize: 14.5, color: theme.inkSoft },
  hi: { color: theme.teal, fontWeight: 700 },
  warn: { color: theme.clay, fontWeight: 500 },
  record: { fontSize: 13, color: theme.inkSoft },
  bar: { display: 'flex', gap: 3, width: '100%', minWidth: 0 },
  cell: { flex: 1, minWidth: 0, height: 26, borderRadius: 3, transition: 'opacity .1s' },
  cellToday: { boxShadow: `inset 0 0 0 2px ${theme.card}, 0 0 0 1.5px ${theme.ink}` },
  legend: { display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.inkFaint },
  lDot: { width: 9, height: 9, borderRadius: 2, display: 'inline-block' },
};
