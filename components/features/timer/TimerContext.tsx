// components/features/timer/TimerContext.tsx
// Provedor único do cronômetro. Roda useStudyTimer() uma vez no topo da árvore
// e compartilha o estado, pra termos UMA fonte de verdade (flutuante, Home, etc.).
'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useStudyTimer } from '@/hooks/useStudyTimer';

type TimerValue = ReturnType<typeof useStudyTimer>;

const TimerContext = createContext<TimerValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const timer = useStudyTimer();

  useEffect(() => {
    if (timer.status === 'running') {
      document.title = `⏱ ${timer.formatted} · Focali`;
    } else {
      document.title = 'Focali';
    }
  }, [timer.status, timer.formatted]);

  return <TimerContext.Provider value={timer}>{children}</TimerContext.Provider>;
}

// Hook de consumo. Qualquer componente dentro do provider usa o MESMO timer.
export function useTimer(): TimerValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer deve ser usado dentro de <TimerProvider>.');
  return ctx;
}