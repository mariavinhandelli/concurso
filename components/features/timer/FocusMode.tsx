// components/features/timer/FocusMode.tsx
// Modo Foco (M3): ambiente de estudo em tela cheia — só o que você está
// estudando + o cronômetro. Sidebar, topbar e distrações somem. Reduz a
// sobrecarga visual no momento em que o usuário precisa de concentração
// (princípio Forest). Abre por evento (botão no cronômetro flutuante), fecha no
// Esc mantendo a sessão viva, e some sozinho quando não há sessão ativa.
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shrink } from 'lucide-react';
import { useTimer, useTimerTick } from './TimerContext';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listAllTopics, type Topic } from '@/services/topics.service';
import { SESSION_MODES } from '@/lib/session-modes';
import { theme, zIndex } from '@/lib/theme';

export const OPEN_FOCUS_EVENT = 'focali:open-focus';

function modeLabel(mode: string): string {
  return SESSION_MODES.find((m) => m.value === mode)?.label ?? 'Sessão';
}

export function FocusMode() {
  const timer = useTimer();
  const { formatted } = useTimerTick();
  const [open, setOpen] = useState(false);

  const hasSession = timer.status === 'running' || timer.status === 'paused';

  // Abre por evento disparado pelo cronômetro flutuante.
  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener(OPEN_FOCUS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FOCUS_EVENT, onOpen);
  }, []);

  // Sem sessão ativa (encerrou / abandonou) → o foco se fecha sozinho.
  // Ajuste durante o render (evita setState em efeito) — reseta a flag quando a
  // sessão termina, para uma sessão futura não reabrir o foco sem o usuário pedir.
  const [prevHasSession, setPrevHasSession] = useState(hasSession);
  if (hasSession !== prevHasSession) {
    setPrevHasSession(hasSession);
    if (!hasSession) setOpen(false);
  }

  // Esc sai do foco (a sessão continua). Espaço pausa/retoma.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (timer.isRunning) timer.pause(); else timer.resume();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, timer]);

  // Resolve nome da matéria/tópico da sessão (reusa as queries do palette).
  const enabled = open && hasSession;
  const { data: subjects } = useQuery<Subject[]>({ queryKey: ['cmd-subjects'], queryFn: listSubjects, enabled, staleTime: 60_000 });
  const { data: topics } = useQuery<Topic[]>({ queryKey: ['cmd-topics'], queryFn: listAllTopics, enabled, staleTime: 60_000 });

  const ctx = useMemo(() => {
    const a = timer.active;
    if (!a) return null;
    const topic = a.topicId ? (topics ?? []).find((t) => t.id === a.topicId) ?? null : null;
    const subjId = a.subjectId ?? topic?.subject_id ?? null;
    const subject = subjId ? (subjects ?? []).find((s) => s.id === subjId) ?? null : null;
    return {
      mode: modeLabel(a.mode),
      topicName: topic?.name ?? null,
      subjectName: subject?.name ?? null,
      subjectColor: subject?.color ?? theme.teal,
    };
  }, [timer.active, topics, subjects]);

  if (!open || !hasSession) return null;

  const title = ctx?.topicName ?? ctx?.subjectName ?? ctx?.mode ?? 'Sessão de estudo';
  const showSubjectLine = ctx?.topicName && ctx?.subjectName;

  return (
    <div style={s.overlay}>
      <button onClick={() => setOpen(false)} style={s.exit} title="Sair do foco (Esc)">
        <Shrink size={16} strokeWidth={1.9} />
        Sair do foco
      </button>

      <div style={s.center}>
        <div style={s.tags}>
          {ctx?.subjectColor && ctx?.topicName && <span style={{ ...s.swatch, background: ctx.subjectColor }} />}
          <span style={s.mode}>{ctx?.mode ?? 'Sessão'}</span>
        </div>

        <h1 style={s.title}>{title}</h1>
        {showSubjectLine && <p style={s.subject}>{ctx!.subjectName}</p>}

        <div style={{ ...s.time, color: timer.isRunning ? theme.ink : theme.inkSoft }}>{formatted}</div>
        <div style={s.state}>
          <span style={{ ...s.dot, background: timer.isRunning ? theme.teal : theme.clay }} />
          {timer.isRunning ? 'em andamento' : 'pausado'}
        </div>

        <div style={s.actions}>
          {timer.isRunning
            ? <button onClick={timer.pause} style={s.secondary}>Pausar</button>
            : <button onClick={timer.resume} style={s.secondary}>Retomar</button>}
          <button onClick={timer.stop} style={s.primary}>Encerrar</button>
        </div>

        <p style={s.hint}>
          <kbd style={s.kbd}>espaço</kbd> pausar · <kbd style={s.kbd}>esc</kbd> sair do foco
        </p>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: zIndex.dialog,
    background: theme.bg, fontFamily: theme.font,
    display: 'flex', flexDirection: 'column',
    padding: 'max(24px, env(safe-area-inset-top)) 24px 24px',
  },
  exit: {
    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7,
    border: 'none', background: 'transparent', color: theme.inkFaint,
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 4px',
  },
  center: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, textAlign: 'center', maxWidth: 620, margin: '0 auto', width: '100%', minWidth: 0,
  },
  tags: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  mode: { fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.inkFaint },
  title: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '0 0 2px', lineHeight: 1.25, overflowWrap: 'break-word' },
  subject: { fontSize: 15, color: theme.inkSoft, margin: '0 0 8px', fontWeight: 500 },
  time: { fontSize: 'clamp(56px, 14vw, 104px)', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: -2, lineHeight: 1.05, margin: '18px 0 4px' },
  state: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: theme.inkSoft, marginBottom: 26 },
  dot: { width: 8, height: 8, borderRadius: theme.radiusPill },
  actions: { display: 'flex', gap: 12 },
  secondary: { minWidth: 130, padding: '13px 22px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { minWidth: 130, padding: '13px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  hint: { fontSize: 12, color: theme.inkFaint, marginTop: 22 },
  kbd: { fontFamily: 'ui-monospace, monospace', fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `0.5px solid ${theme.line}`, background: theme.muted, color: theme.inkSoft, margin: '0 2px' },
};
