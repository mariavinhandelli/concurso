// services/studyTotals.service.ts
// Perf F4: totais de study_logs agregados POR DIA no servidor (RPC
// get_study_day_totals). streak e goals derivam daqui em vez de buscar logs crus.
// Dedup de request: no load da Home streak e goals chamam quase juntos → uma só
// RPC (inflight compartilhado). Sem cache/TTL para não servir dado velho após
// salvar uma sessão (React Query já cuida do staleTime nas camadas de cima).

import { createClient } from '@/lib/supabase/client';

export interface DayTotal {
  day: string;      // 'YYYY-MM-DD' (data local, igual ao toLocalDateString)
  seconds: number;  // soma de duration_sec no dia (cru — o cliente aplica limiares)
  questions: number;
  correct: number;
}

const DEFAULT_DAYS = 1100; // cobre a janela de 3 anos do streak (1095)
let inflight: Promise<DayTotal[]> | null = null;

export async function getStudyDayTotals(days: number = DEFAULT_DAYS): Promise<DayTotal[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const supabase = createClient();
      const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/Sao_Paulo';
      const { data, error } = await supabase.rpc('get_study_day_totals', { p_tz: tz, p_days: days });
      if (error) return [];
      return ((data ?? []) as DayTotal[]).map((r) => ({
        day: r.day,
        seconds: r.seconds ?? 0,
        questions: r.questions ?? 0,
        correct: r.correct ?? 0,
      }));
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
