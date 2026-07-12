// components/features/history/YearHeatmap.tsx
// Mapa de constância anual no estilo GitHub Contributions: 12 meses (6 no
// mobile) de células dia-a-dia, intensidade proporcional aos minutos estudados.
// É o artefato de IDENTIDADE do hábito (Atomic Habits): a pessoa não vê "uma
// meta de hoje", vê o retrato de quem ela está se tornando. Dados da mesma RPC
// agregada do streak (get_study_day_totals) — nenhuma query nova no banco.
'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudyDayTotals, type DayTotal } from '@/services/studyTotals.service';
import { toLocalDateString } from '@/lib/local-date';
import { useUI } from '@/components/layout/UIContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { theme } from '@/lib/theme';

// Intensidade por minutos no dia. O degrau de 30 min espelha o piso do streak.
const NIVEIS = [
  { min: 60, cor: 'var(--teal)' },
  { min: 30, cor: 'color-mix(in srgb, var(--teal) 70%, transparent)' },
  { min: 15, cor: 'color-mix(in srgb, var(--teal) 45%, transparent)' },
  { min: 1,  cor: 'color-mix(in srgb, var(--teal) 25%, transparent)' },
  { min: 0,  cor: 'var(--muted)' },
];

function corDoDia(minutos: number): string {
  for (const n of NIVEIS) if (minutos >= n.min) return n.cor;
  return 'var(--muted)';
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface Cell {
  date: string;
  minutes: number;
}

// Monta as colunas (semanas, domingo→sábado) terminando na semana atual.
function buildWeeks(byDay: Map<string, number>, numWeeks: number): { weeks: Cell[][]; monthLabels: { col: number; label: string }[] } {
  const hoje = new Date();
  // fim = sábado da semana atual
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + (6 - fim.getDay()));

  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - numWeeks * 7 + 1);

  const hojeStr = toLocalDateString(hoje);
  const weeks: Cell[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;

  const cursor = new Date(inicio);
  for (let w = 0; w < numWeeks; w++) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = toLocalDateString(cursor);
      // dias futuros ficam vazios (minutes: -1 sinaliza "não renderizar cor de falha")
      week.push({ date: dateStr, minutes: dateStr > hojeStr ? -1 : (byDay.get(dateStr) ?? 0) });
      cursor.setDate(cursor.getDate() + 1);
    }
    // rótulo do mês na coluna que contém o dia 1º (aparece uma vez por mês)
    const primeiroDia = new Date(week[0].date + 'T00:00:00');
    if (primeiroDia.getMonth() !== lastMonth) {
      // evita rótulos colados no início
      if (monthLabels.length === 0 || w - monthLabels[monthLabels.length - 1].col >= 3) {
        monthLabels.push({ col: w, label: MESES[primeiroDia.getMonth()] });
      }
      lastMonth = primeiroDia.getMonth();
    }
    weeks.push(week);
  }
  return { weeks, monthLabels };
}

export function YearHeatmap() {
  const { isMobile } = useUI();
  const numWeeks = isMobile ? 26 : 52;

  const { data: totals } = useQuery<DayTotal[]>({
    queryKey: ['study-day-totals-heatmap'],
    queryFn: () => getStudyDayTotals(),
    staleTime: 5 * 60_000,
  });

  const { weeks, monthLabels, diasAtivos, horasTotal } = useMemo(() => {
    const byDay = new Map<string, number>();
    const corte = new Date();
    corte.setDate(corte.getDate() - numWeeks * 7);
    const corteStr = toLocalDateString(corte);

    let diasAtivos = 0;
    let segundos = 0;
    for (const t of totals ?? []) {
      const min = Math.round(t.seconds / 60);
      byDay.set(t.day, min);
      if (t.day >= corteStr && min > 0) {
        diasAtivos++;
        segundos += t.seconds;
      }
    }
    const { weeks, monthLabels } = buildWeeks(byDay, numWeeks);
    return { weeks, monthLabels, diasAtivos, horasTotal: Math.round(segundos / 3600) };
  }, [totals, numWeeks]);

  if (!totals) {
    return (
      <div style={s.card}>
        <Skeleton width={240} height={14} borderRadius={4} />
        <div style={{ marginTop: 12 }}><Skeleton width="100%" height={isMobile ? 96 : 110} borderRadius={6} /></div>
      </div>
    );
  }

  const periodo = isMobile ? '6 meses' : '12 meses';
  const cell = isMobile ? 10 : 11;
  const gap = 2.5;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <span style={s.title}>Constância</span>
        <span style={s.stats}>
          <b style={s.statHi}>{diasAtivos}</b> {diasAtivos === 1 ? 'dia' : 'dias'} de estudo
          {horasTotal > 0 && <> · <b style={s.statHi}>{horasTotal}h</b></>} nos últimos {periodo}
        </span>
      </div>

      <div style={s.gridWrap}>
        {/* rótulos dos dias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 6, paddingTop: 16 }}>
          {['', 'seg', '', 'qua', '', 'sex', ''].map((l, i) => (
            <span key={i} style={{ ...s.dowLabel, height: cell, lineHeight: `${cell}px` }}>{l}</span>
          ))}
        </div>

        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          {/* rótulos dos meses */}
          <div style={{ position: 'relative', height: 14, marginBottom: 2 }}>
            {monthLabels.map((m) => (
              <span key={`${m.label}-${m.col}`} style={{ ...s.monthLabel, left: m.col * (cell + gap) }}>{m.label}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                {week.map((d) => (
                  <div
                    key={d.date}
                    title={d.minutes >= 0 ? `${new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')} · ${d.minutes} min` : undefined}
                    style={{
                      width: cell, height: cell, borderRadius: 2.5,
                      background: d.minutes < 0 ? 'transparent' : corDoDia(d.minutes),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.legend}>
        <span style={s.legendText}>menos</span>
        {[...NIVEIS].reverse().map((n) => (
          <i key={n.min} style={{ ...s.legendCell, background: n.cor }} />
        ))}
        <span style={s.legendText}>mais</span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: 18, marginBottom: 20, fontFamily: theme.font, minWidth: 0,
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.inkSoft },
  stats: { fontSize: 13, color: theme.inkSoft },
  statHi: { color: theme.ink, fontWeight: 700 },
  gridWrap: { display: 'flex', minWidth: 0 },
  dowLabel: { fontSize: 10, color: theme.inkFaint, display: 'block' },
  monthLabel: { position: 'absolute', top: 0, fontSize: 10, color: theme.inkFaint, whiteSpace: 'nowrap' },
  legend: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  legendCell: { width: 10, height: 10, borderRadius: 2.5, display: 'inline-block' },
  legendText: { fontSize: 11, color: theme.inkFaint, margin: '0 3px' },
};
