'use client';

import { memo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getTimeByCategory, type TimeByCategoryResult, type PeriodView, type DateRange,
} from '@/services/timeByCategory.service';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { theme } from '@/lib/theme';
import { toLocalDateString } from '@/lib/local-date';
import { ManualLogModal } from '@/components/features/timer/ManualLogModal';

// Recharts (~200 KB) carregado sob demanda — fora do bundle inicial da Home.
const PieChartSection = dynamic(
  () => import('./PieChartSection').then((m) => ({ default: m.PieChartSection })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 230, display: 'grid', placeItems: 'center' }}>
        <p style={{ fontSize: 14, color: theme.inkFaint, margin: 0 }}>Carregando gráfico…</p>
      </div>
    ),
  },
);

const FILTROS: { key: PeriodView; label: string }[] = [
  { key: 'dia', label: 'Dia' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'custom', label: 'Escolher' },
];

// O card nasceu na Home fixo na semana corrente ("quanto estudei e em quê").
// Agora ele mora em /progresso, onde a pergunta é outra — comparar períodos —
// então voltou a navegação por dia/semana/mês e ganhou intervalo livre por
// calendário, que nenhum outro gráfico da página oferece.
export const TimePieCard = memo(function TimePieCard() {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [view, setView] = useState<PeriodView>('semana');
  const [offset, setOffset] = useState(0);
  const hoje = toLocalDateString();
  const [range, setRange] = useState<DateRange>({ start: hoje, end: hoje });

  const isCustom = view === 'custom';
  const rangeKey = isCustom ? `${range.start}:${range.end}` : '';

  const { data, isError: loadError, isFetching } = useQuery<TimeByCategoryResult>({
    queryKey: ['time-by-category', view, offset, rangeKey],
    queryFn: () => getTimeByCategory(view, offset, isCustom ? range : undefined),
    // Mantém o gráfico anterior na tela enquanto o novo período carrega, em vez
    // de piscar o estado vazio a cada clique na seta.
    placeholderData: (prev) => prev,
  });

  const temDados = !loadError && data && data.slices.length > 0;

  function trocaView(v: PeriodView) {
    setView(v);
    setOffset(0); // trocar de granularidade sempre volta para o período atual
  }

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.eyebrow}>Tempo de estudo</span>
        <div style={styles.filtros}>
          {FILTROS.map((f) => (
            <button
              key={f.key}
              className="touch-target"
              onClick={() => trocaView(f.key)}
              style={{ ...styles.filtroBtn, ...(view === f.key ? styles.filtroBtnAtivo : {}) }}
              aria-pressed={view === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isCustom ? (
        <div style={styles.rangeRow}>
          <label style={styles.rangeLabel}>
            <span style={styles.rangeCaption}>De</span>
            <input
              type="date"
              value={range.start}
              max={hoje}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))}
              style={styles.dateInput}
              aria-label="Data inicial"
            />
          </label>
          <label style={styles.rangeLabel}>
            <span style={styles.rangeCaption}>Até</span>
            <input
              type="date"
              value={range.end}
              max={hoje}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))}
              style={styles.dateInput}
              aria-label="Data final"
            />
          </label>
        </div>
      ) : (
        <div style={styles.navRow}>
          <button
            className="icon-touch-target"
            style={styles.navBtn}
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Período anterior"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>
          <span style={styles.periodLabel}>{data?.periodLabel ?? '…'}</span>
          <button
            className="icon-touch-target"
            style={{ ...styles.navBtn, opacity: data?.canGoForward ? 1 : 0.35 }}
            onClick={() => setOffset((o) => o + 1)}
            disabled={!data?.canGoForward}
            aria-label="Próximo período"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {loadError ? (
        <p style={{ ...styles.empty, color: theme.danger }}>Não foi possível carregar os dados. Tente novamente.</p>
      ) : !data && isFetching ? (
        <p style={{ ...styles.empty, padding: '30px 0' }}>Carregando…</p>
      ) : !temDados ? (
        /* P11 — estado vazio com CTA */
        <div style={styles.emptyWrap}>
          <p style={styles.empty}>
            {isCustom || offset !== 0
              ? 'Nenhum estudo registrado neste período.'
              : 'Nenhum estudo registrado ainda.'}
          </p>
          <button className="touch-target" style={styles.emptyBtn} onClick={() => setLogOpen(true)}>
            Registrar estudo →
          </button>
        </div>
      ) : (
        <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity .15s' }}>
          <PieChartSection slices={data!.slices} totalMinutes={data!.totalMinutes} />
        </div>
      )}

      {/* onSaved antes só fechava o modal: quem registrava estudo pelo CTA do
          estado vazio deste card via o card continuar vazio, e nem streak,
          metas ou Plano de Hoje se mexiam. Mesmo refresh usado no Topbar. */}
      {logOpen && (
        <ManualLogModal
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); refreshHomeAfterSession(queryClient); }}
        />
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, fontFamily: theme.font, minWidth: 0 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
  filtros: { display: 'flex', gap: 4, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, flexWrap: 'wrap' },
  filtroBtn: {
    padding: '5px 12px', borderRadius: 9, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all .15s',
  },
  filtroBtnAtivo: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  navRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  navBtn: { width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  periodLabel: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, textTransform: 'capitalize', minWidth: 120, textAlign: 'center' },
  rangeRow: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  rangeLabel: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 140px' },
  rangeCaption: { fontSize: 12, color: theme.inkFaint, fontWeight: 600, flexShrink: 0 },
  dateInput: { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontFamily: 'inherit' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '30px 0' },
  empty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', margin: 0 },
  emptyBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
