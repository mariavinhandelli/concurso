// components/features/home/MetaSugeridaHint.tsx
// N3 — Metas adaptativas + "parede de zeros" → projeção. Fica logo abaixo da
// régua de metas (TodayBlock) e faz três coisas, em ordem de prioridade:
//   1. Sem meta definida → convida a começar leve, com uma sugestão concreta.
//   2. Meta heroica raramente batida → propõe uma meta ALCANÇÁVEL (a filosofia é
//      "começar pequeno e crescer": bater a meta quase todo dia sustenta a sequência).
//   3. Ainda não estudou hoje → reenquadra o "0 / meta" como projeção do possível
//      ("1 bloco de 25 min = X% da meta") em vez de uma parede de zeros.
// Nunca grava a meta sem o toque do usuário; dispensável por hoje.
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Zap } from 'lucide-react';
import {
  getGoalsSummary, getSuggestedDailyTarget, setDailyTarget,
  type GoalsSummary, type SuggestedTarget,
} from '@/services/goals.service';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useToast } from '@/components/ui/ToastProvider';
import { toLocalDateString } from '@/lib/local-date';
import { fmtMin } from '@/lib/format/time';
import { theme } from '@/lib/theme';

const BLOCO_MIN = 25; // bloco de referência para a projeção (pomodoro-ish)

// Só propõe reduzir uma meta quando ela é raramente batida e há sinal suficiente.
const MET_RATE_LIMITE = 0.34;
const MIN_DIAS_SINAL = 3;

export function MetaSugeridaHint() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hoje = toLocalDateString();
  const [dismissedOn, setDismissedOn] = usePersistedState<string>(
    'metahint:dismissed', '', (v) => v ?? '',
  );

  const { data: goals } = useQuery<GoalsSummary>({ queryKey: ['goals-summary'], queryFn: getGoalsSummary });
  const { data: sug } = useQuery<SuggestedTarget>({ queryKey: ['suggested-target'], queryFn: getSuggestedDailyTarget });

  if (!goals || !sug) return null;

  const target = goals.targetMinutesPerDay;
  const semMeta = target === 0;
  const heroica = target > 0
    && sug.metRate !== null && sug.metRate < MET_RATE_LIMITE
    && sug.activeDays >= MIN_DIAS_SINAL
    && sug.suggestedMinutes < target;
  const zeroHoje = target > 0 && goals.todayMinutes === 0;

  // Estados 1 e 2 são "nudges" acionáveis (aplicam a sugestão); dispensáveis por hoje.
  const mostrarNudge = (semMeta || heroica) && dismissedOn !== hoje;
  // Estado 3 é microcopy de projeção; também dispensável por hoje.
  const mostrarProjecao = !mostrarNudge && zeroHoje && dismissedOn !== hoje;

  if (!mostrarNudge && !mostrarProjecao) return null;

  async function aplicar(minutes: number) {
    try {
      await setDailyTarget(minutes);
      queryClient.invalidateQueries({ queryKey: ['goals-summary'] });
      queryClient.invalidateQueries({ queryKey: ['questions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['suggested-target'] });
      toast.success(`Meta ajustada para ${fmtMin(minutes)}/dia. Bora manter a sequência. 🎯`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível ajustar a meta.');
    }
  }

  // ── Estado 3: projeção (reenquadra os zeros) ──
  if (mostrarProjecao) {
    const pct = Math.min(100, Math.round((BLOCO_MIN / target) * 100));
    return (
      <div style={s.proj}>
        <Zap size={15} color={theme.teal} strokeWidth={1.9} style={{ flexShrink: 0 }} />
        <span style={s.projText}>
          {pct >= 100
            ? <>Ainda não estudou hoje — <b style={s.strong}>1 bloco de {BLOCO_MIN} min já bate a meta.</b> Todo começo conta.</>
            : <>Ainda não estudou hoje — <b style={s.strong}>1 bloco de {BLOCO_MIN} min = {pct}% da meta.</b> Todo começo conta.</>}
        </span>
        <button onClick={() => setDismissedOn(hoje)} style={s.dismissX} aria-label="Dispensar por hoje">
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    );
  }

  // ── Estados 1 e 2: nudge de meta adaptativa ──
  const s2 = sug.suggestedMinutes;
  const titulo = semMeta
    ? 'Comece leve — defina sua meta de hoje'
    : 'Sua meta parece alta demais';
  const corpo = semMeta
    ? <>Uma meta pequena que você bate todo dia vale mais que uma grande que trava. Sugestão: <b style={s.strong}>{fmtMin(s2)} por dia.</b></>
    : <>Você bateu a meta de <b style={s.strong}>{fmtMin(target)}</b> em só {Math.round((sug.metRate ?? 0) * 100)}% dos dias que estudou. Que tal <b style={s.strong}>{fmtMin(s2)}/dia</b> pra manter a sequência viva e crescer aos poucos?</>;

  return (
    <div style={s.card}>
      <div style={s.top}>
        <span style={s.eyebrow}>Meta adaptativa</span>
        <button onClick={() => setDismissedOn(hoje)} style={s.dismiss} aria-label="Dispensar por hoje">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <p style={s.title}>{titulo}</p>
      <p style={s.body}>{corpo}</p>
      <div style={s.actions}>
        <button onClick={() => aplicar(s2)} style={s.primary}>
          {semMeta ? `Usar ${fmtMin(s2)}/dia` : `Ajustar para ${fmtMin(s2)}`}
        </button>
        <button onClick={() => setDismissedOn(hoje)} style={s.ghost}>agora não</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.tealBg, border: `0.5px solid ${theme.teal}`, borderRadius: theme.radius,
    padding: '14px 16px', marginTop: 12, fontFamily: theme.font, minWidth: 0,
  },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.tealDeep },
  dismiss: { border: 'none', background: 'transparent', color: theme.tealDeep, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.65 },
  title: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 4px', letterSpacing: -0.2 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.55, margin: '0 0 12px', maxWidth: 560 },
  strong: { color: theme.ink, fontWeight: 700 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  primary: { padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { padding: '9px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  proj: {
    display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, padding: '9px 12px',
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, minWidth: 0,
  },
  projText: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.45, flex: 1, minWidth: 0 },
  dismissX: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', flexShrink: 0 },
};
