// components/features/timer/SessionCelebration.tsx
// Momento de recompensa pós-sessão (Tiny Habits: celebrar IMEDIATAMENTE após o
// comportamento é o que grava o hábito). Escuta o evento emitido por saveStudyLog
// e mostra UM card com o ganho real da sessão: minutos, estado do dia na
// sequência (transforma o piso de 30 min de binário em escada honesta: "faltam
// X min"), meta diária e proximidade de recorde. Sem dark pattern: um botão,
// fecha com Esc/backdrop, nunca pede nada em troca, nunca culpa.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { getGoalsSummary, type GoalsSummary } from '@/services/goals.service';
import { SESSION_SAVED_EVENT, type SessionSavedDetail } from '@/lib/session-celebration';
import { toLocalDateString } from '@/lib/local-date';
import { track, EV } from '@/lib/analytics';
import { theme, zIndex } from '@/lib/theme';

const MIN_DIA = 30; // piso do streak (services/streak.service)

interface CelebrationData {
  minutes: number;
  retroDate: string | null; // preenchido quando o registro é de um dia passado
  streak: StreakInfo | null;
  goals: GoalsSummary | null;
}

export function SessionCelebration() {
  const [data, setData] = useState<CelebrationData | null>(null);
  const [visible, setVisible] = useState(false); // controla a transição de entrada

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setData(null), 180);
  }, []);

  useEffect(() => {
    async function onSaved(e: Event) {
      const detail = (e as CustomEvent<SessionSavedDetail>).detail;
      if (!detail) return;
      const hoje = toLocalDateString();
      const isToday = detail.dateLocal === hoje;

      // Registro retroativo: celebração simples, sem streak/meta (que são de hoje).
      if (!isToday) {
        setData({ minutes: detail.minutes, retroDate: detail.dateLocal, streak: null, goals: null });
        return;
      }

      // Dados frescos direto do serviço (o save acabou de acontecer).
      const [streak, goals] = await Promise.all([
        getStreak().catch(() => null),
        getGoalsSummary().catch(() => null),
      ]);
      setData({ minutes: detail.minutes, retroDate: null, streak, goals });
      track(EV.celebrationShown, {
        minutes: detail.minutes,
        dayGuaranteed: !!streak?.studiedToday,
        goalMet: !!goals && goals.targetMinutesPerDay > 0 && goals.todayMinutes >= goals.targetMinutesPerDay,
      });
    }

    window.addEventListener(SESSION_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SESSION_SAVED_EVENT, onSaved);
  }, []);

  useEffect(() => {
    if (!data) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [data, close]);

  // Transição de entrada. setTimeout (e não requestAnimationFrame) porque rAF
  // não dispara em aba oculta — o card ficaria invisível para sempre.
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;

  const { minutes, retroDate, streak, goals } = data;

  // ── Linha da sequência: dia garantido / escada até os 30 min ──
  let streakLine: { emoji: string; text: string; strong?: boolean } | null = null;
  if (streak) {
    if (streak.studiedToday) {
      streakLine = streak.current > 1
        ? { emoji: '🔥', text: `Dia garantido — ${streak.current} dias de sequência`, strong: true }
        : { emoji: '🔥', text: 'Dia garantido — sequência iniciada', strong: true };
    } else if (goals && goals.todayMinutes > 0 && goals.todayMinutes < MIN_DIA) {
      streakLine = { emoji: '⏳', text: `Faltam ${MIN_DIA - goals.todayMinutes} min para o dia contar na sequência` };
    }
  }

  // ── Recorde: só quando é verdade e está perto (recompensa variável honesta) ──
  let recordLine: string | null = null;
  if (streak?.studiedToday && streak.current > 1) {
    if (streak.current >= streak.longest) recordLine = '🏆 Recorde pessoal!';
    else if (streak.longest - streak.current <= 3) {
      const faltam = streak.longest - streak.current;
      recordLine = `A ${faltam} ${faltam === 1 ? 'dia' : 'dias'} do seu recorde (${streak.longest})`;
    }
  }

  const temMeta = !!goals && goals.targetMinutesPerDay > 0;
  const metaPct = temMeta ? Math.min(100, Math.round((goals!.todayMinutes / goals!.targetMinutesPerDay) * 100)) : 0;
  const metaBatida = temMeta && goals!.todayMinutes >= goals!.targetMinutesPerDay;

  const retroLabel = retroDate
    ? new Date(retroDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : null;

  return (
    <div
      style={{ ...s.overlay, opacity: visible ? 1 : 0 }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Sessão registrada"
    >
      <div
        style={{ ...s.card, transform: visible ? 'scale(1) translateY(0)' : 'scale(.94) translateY(8px)', opacity: visible ? 1 : 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.check}>
          <Check size={26} color={theme.onOk} strokeWidth={3} />
        </div>

        <div style={s.minutes}>+{minutes} min</div>
        <p style={s.subtitle}>
          {retroLabel ? `Sessão registrada em ${retroLabel}.` : 'Sessão registrada. Bom trabalho.'}
        </p>

        {streakLine && (
          <div style={{ ...s.line, ...(streakLine.strong ? s.lineStrong : {}) }}>
            <span style={s.lineEmoji}>{streakLine.emoji}</span>
            <span>{streakLine.text}</span>
          </div>
        )}

        {recordLine && (
          <div style={s.record}>{recordLine}</div>
        )}

        {temMeta && (
          <div style={s.metaWrap}>
            <div style={s.metaHead}>
              <span style={s.metaLabel}>{metaBatida ? 'Meta diária batida 🎉' : 'Meta diária'}</span>
              <span style={s.metaNums}>{goals!.todayMinutes} de {goals!.targetMinutesPerDay} min</span>
            </div>
            <div style={s.metaBar}>
              <div style={{ ...s.metaFill, width: `${metaPct}%`, background: metaBatida ? theme.ok : theme.teal }} />
            </div>
          </div>
        )}

        <button onClick={close} style={s.btn} autoFocus>Continuar</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid',
    placeItems: 'center', zIndex: zIndex.dialog, padding: 20, fontFamily: theme.font,
    transition: 'opacity .18s ease',
  },
  card: {
    background: theme.card, borderRadius: theme.radius, padding: '28px 26px 22px',
    width: '100%', maxWidth: 360, textAlign: 'center',
    boxShadow: theme.shadowModal,
    transition: 'transform .18s ease, opacity .18s ease',
  },
  check: {
    width: 52, height: 52, borderRadius: '50%', background: theme.ok,
    display: 'grid', placeItems: 'center', margin: '0 auto 14px',
  },
  minutes: { fontSize: 34, fontWeight: 800, color: theme.ink, letterSpacing: -1, lineHeight: 1 },
  subtitle: { fontSize: 14, color: theme.inkSoft, margin: '8px 0 16px' },
  line: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 14, color: theme.inkSoft, fontWeight: 500,
    padding: '9px 12px', borderRadius: theme.radiusSm, background: theme.bg,
    marginBottom: 8,
  },
  lineStrong: { color: theme.ink, fontWeight: 700, background: theme.tealBg },
  lineEmoji: { fontSize: 16 },
  record: { fontSize: 13, fontWeight: 700, color: theme.warn, marginBottom: 8 },
  metaWrap: { marginTop: 6, marginBottom: 4, textAlign: 'left' },
  metaHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  metaLabel: { fontSize: 13, fontWeight: 700, color: theme.ink },
  metaNums: { fontSize: 12, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums' },
  metaBar: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  metaFill: { height: '100%', borderRadius: theme.radiusPill, transition: 'width .5s ease' },
  btn: {
    marginTop: 18, width: '100%', padding: '11px 0', borderRadius: theme.radiusSm,
    border: 'none', background: theme.primary, color: theme.onTeal,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
};
