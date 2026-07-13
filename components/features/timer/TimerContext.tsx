// components/features/timer/TimerContext.tsx
// Provedor único do cronômetro. Roda useStudyTimer() uma vez no topo da árvore
// e compartilha o estado, pra termos UMA fonte de verdade (flutuante, Home, etc.).
//
// DOIS contextos de propósito: o tick de 1s (elapsedSec/formatted) fica isolado
// em TimerTickContext para que consumidores de ações/status (Topbar, PlanoHoje,
// Home) NÃO re-renderizem a cada segundo durante uma sessão de estudo — só
// FloatingTimer/FocusMode, que exibem o relógio, pagam o tick.
'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useStudyTimer } from '@/hooks/useStudyTimer';

type TimerValue = ReturnType<typeof useStudyTimer>;
type TimerTickValue = Pick<TimerValue, 'elapsedSec' | 'formatted'>;
type TimerMainValue = Omit<TimerValue, 'elapsedSec' | 'formatted'>;

const TimerContext = createContext<TimerMainValue | null>(null);
const TimerTickContext = createContext<TimerTickValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const timer = useStudyTimer();

  useEffect(() => {
    if (timer.status === 'running') {
      document.title = `⏱ ${timer.formatted} · Focali`;
      return () => { document.title = 'Focali'; };
    }
    document.title = 'Focali';
  }, [timer.status, timer.formatted]);

  const tickValue = useMemo(
    () => ({ elapsedSec: timer.elapsedSec, formatted: timer.formatted }),
    [timer.elapsedSec, timer.formatted],
  );

  // Estável entre ticks: só muda quando status/sessão mudam (callbacks são
  // useCallback estáveis no hook). É isso que poupa Topbar/PlanoHoje do 1×/s.
  const mainValue = useMemo(
    () => ({
      status: timer.status,
      isRunning: timer.isRunning,
      isPaused: timer.isPaused,
      pendingSession: timer.pendingSession,
      active: timer.active,
      start: timer.start,
      pause: timer.pause,
      resume: timer.resume,
      stop: timer.stop,
      discardPending: timer.discardPending,
      abandon: timer.abandon,
    }),
    [
      timer.status, timer.isRunning, timer.isPaused, timer.pendingSession, timer.active,
      timer.start, timer.pause, timer.resume, timer.stop, timer.discardPending, timer.abandon,
    ],
  );

  return (
    <TimerContext.Provider value={mainValue}>
      <TimerTickContext.Provider value={tickValue}>{children}</TimerTickContext.Provider>
    </TimerContext.Provider>
  );
}

// Hook de consumo. Qualquer componente dentro do provider usa o MESMO timer.
// NÃO inclui elapsedSec/formatted — para o relógio ao vivo, use useTimerTick().
export function useTimer(): TimerMainValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer deve ser usado dentro de <TimerProvider>.');
  return ctx;
}

// Relógio ao vivo (re-renderiza 1×/s enquanto o timer roda) — use apenas em
// componentes que exibem o tempo (FloatingTimer, FocusMode).
export function useTimerTick(): TimerTickValue {
  const ctx = useContext(TimerTickContext);
  if (!ctx) throw new Error('useTimerTick deve ser usado dentro de <TimerProvider>.');
  return ctx;
}
