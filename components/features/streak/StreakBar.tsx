'use client';

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Trophy } from 'lucide-react';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { toLocalDateString } from '@/lib/local-date';
import { Skeleton } from '@/components/ui/Skeleton';

// "falhou" é uma sobreposição translúcida de --ink para distinguir de "vazio" (cinza) nos dois modos
const COR = {
  meta: theme.ok,
  estudou: theme.clay,
  escudo: theme.warn,   // folga perdoada pelo escudo semanal
  falhou: `color-mix(in srgb, ${theme.ink} 22%, transparent)`,
  vazio: theme.muted,
};

export const StreakBar = memo(function StreakBar() {
  const { isMobile, isTablet } = useUI();
  // Tablet é mais estreito que desktop mas não entra no isMobile — sem essa
  // distinção, 60 dias espremiam em células mais finas que as do mobile.
  const totalDias = isMobile ? 30 : isTablet ? 45 : 60;

  const { data: info, isError: loadError, refetch, isRefetching } = useQuery<StreakInfo>({
    queryKey: ['streak'],
    queryFn: () => getStreak(),
  });

  // H11 — o service que alimenta isto (studyTotals) antes engolia erro de rede
  // como "sem dados"; StreakBar já tratava isError, mas nunca disparava de
  // fato. Agora dispara de verdade — mantém o aviso e ganha um retry.
  if (loadError) {
    return (
      <p style={styles.muted}>
        Não foi possível carregar a constância.{' '}
        <button style={styles.retryLink} onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? 'tentando…' : 'tentar de novo'}
        </button>
      </p>
    );
  }

  // Skeleton com dimensões corretas enquanto carrega (P10)
  if (!info) {
    return (
      <div style={styles.wrap}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={200} height={14} borderRadius={4} />
          <Skeleton width={90} height={14} borderRadius={4} />
        </div>
        <div style={{ display: 'flex', gap: 3, width: '100%' }}>
          {Array.from({ length: totalDias }).map((_, i) => (
            <Skeleton key={i} height={isMobile ? 30 : 26} borderRadius={3} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </div>
      </div>
    );
  }

  const dias = info.lastDays.slice(-totalDias);

  const primeiroEstudo = dias.findIndex((d) => d.minutes > 0);

  // Sem nenhum estudo ainda (P3): mostrar estado inspiracional em vez de 60 barras cinzas
  if (primeiroEstudo === -1) {
    const semana = dias.slice(-7);
    return (
      <div style={styles.wrap}>
        <div style={styles.header}>
          <span style={styles.phrase}>Comece hoje a construir sua sequência de estudos! 🔥</span>
        </div>
        <div style={styles.bar}>
          {semana.map((d) => (
            <div
              key={d.date}
              style={{ ...styles.cell, height: isMobile ? 30 : 26, background: COR.vazio, flex: 1 }}
            />
          ))}
        </div>
        <div style={styles.legend}>
          <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.meta }} />bateu a meta</span>
          <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.estudou }} />estudou</span>
        </div>
      </div>
    );
  }

  function corDoDia(d: { minutes: number; metGoal: boolean; forgiven?: boolean }, idx: number): string {
    if (d.minutes > 0) return d.metGoal ? COR.meta : COR.estudou;
    if (d.forgiven) return COR.escudo;   // folga perdoada não conta como falha
    if (idx > primeiroEstudo) return COR.falhou;
    return COR.vazio;
  }

  const hojeStr = toLocalDateString();
  const novoRecorde = info.current > 0 && info.current >= info.longest;
  const temEscudo = dias.some((d) => d.forgiven);

  return (
    <div style={styles.wrap}>
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
          {info.shieldUsed && (
            <span style={{ ...styles.shield, display: 'inline-flex', alignItems: 'center', gap: 4 }}> <Shield size={13} strokeWidth={2} />uma folga foi perdoada — sua ofensiva continua de pé.</span>
          )}
        </span>
        {novoRecorde ? (
          <span style={{ ...styles.recordDestaque, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={13} strokeWidth={2} /> {info.current === info.longest ? 'recorde pessoal!' : `recorde: ${info.longest} dias`}
          </span>
        ) : (
          <span style={styles.record}>recorde: <b style={{ color: theme.ink }}>{info.longest} {info.longest === 1 ? 'dia' : 'dias'}</b></span>
        )}
      </div>

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

      <div style={styles.legend}>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.meta }} />bateu a meta</span>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.estudou }} /> estudou</span>
        {temEscudo && <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.escudo }} /> folga perdoada</span>}
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.falhou }} /> não estudou</span>
        <span style={styles.legendItem}><i style={{ ...styles.lDot, background: COR.vazio }} /> sem registro</span>
      </div>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  phrase: { fontSize: 15, color: theme.inkSoft },
  hi: { color: theme.teal, fontWeight: 700 },
  warn: { color: theme.clay, fontWeight: 500 },
  shield: { color: theme.warnDeep, fontWeight: 500 },
  record: { fontSize: 13, color: theme.inkSoft },
  recordDestaque: { fontSize: 13, color: theme.warn, fontWeight: 700 },
  bar: { display: 'flex', gap: 3, width: '100%', minWidth: 0 },
  cell: { flex: 1, minWidth: 0, height: 26, borderRadius: 3, transition: 'opacity .1s' },
  cellToday: { boxShadow: `inset 0 0 0 2px ${theme.card}, 0 0 0 1.5px ${theme.ink}` },
  legend: { display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.inkFaint },
  lDot: { width: 9, height: 9, borderRadius: 2, display: 'inline-block' },
  muted: { color: theme.inkFaint, fontSize: 14, margin: 0 },
  retryLink: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
