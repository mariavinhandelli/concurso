'use client';
// hooks/useLocalToday.ts
// H16 — "hoje" era calculado 1x no render (page.tsx, PlanoHoje, ExamCountdown)
// sem timer: uma aba deixada aberta atravessando a meia-noite ficava com a
// saudação, o countdown de provas e os blocos do dia desatualizados até algo
// mais disparar um re-render (foco, refetch etc.). Este hook agenda um
// re-render exato na próxima meia-noite local e devolve a data (YYYY-MM-DD)
// já sincronizada entre todos os consumidores.

import { useEffect, useState } from 'react';
import { toLocalDateString } from '@/lib/local-date';

export function useLocalToday(): string {
  const [today, setToday] = useState(() => toLocalDateString(new Date()));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    function scheduleNextTick() {
      const now = new Date();
      // +5s de folga sobre a virada exata, evita corrida com o relógio do SO.
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timeoutId = setTimeout(() => {
        setToday(toLocalDateString(new Date()));
        scheduleNextTick();
      }, nextMidnight.getTime() - now.getTime());
    }
    scheduleNextTick();
    return () => clearTimeout(timeoutId);
  }, []);

  return today;
}
