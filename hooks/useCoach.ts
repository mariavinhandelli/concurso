// hooks/useCoach.ts
// Decisor ÚNICO de coaching da Home (Rodada 3). Centraliza "qual mensagem mostrar
// hoje" para os cards do topo, que antes se auto-gatilhavam de forma independente
// e podiam empilhar. Reusa as mesmas queries que os cards já usam (React Query
// deduplica). Também expõe returnMode (hiato) para a Home colapsar o resto.
// Regra de exclusão mútua: no máximo UM card. Card novo no futuro = novo branch
// aqui + no CoachSlot, nunca outro card solto na Home.
'use client';

import { useQuery } from '@tanstack/react-query';
import { listTargetExams, type TargetExam } from '@/services/targetExams.service';
import { getRetomadaStatus, type RetomadaStatus } from '@/services/retomada.service';
import { daysUntilExam } from '@/lib/targets';

export type CoachCard = 'reta-final' | 'retomada' | 'risco' | null;

export interface CoachDecision {
  card: CoachCard;
  returnMode: boolean;  // hiato (≥4 dias) → a Home colapsa o resto
  diasAusente: number;
  loading: boolean;
}

const LIMITE_RETA = 30;
const RETA_CRITICO = 7;
const HIATO_MIN = 4;

// Dias até a prova futura mais próxima (ignora provas passadas), ou null.
function nearestExamDays(exams: TargetExam[]): number | null {
  let best: number | null = null;
  for (const t of exams) {
    if (!t.exam_date) continue;
    const d = daysUntilExam(t.exam_date);
    if (d < 0) continue;
    if (best === null || d < best) best = d;
  }
  return best;
}

export function useCoachDecision(): CoachDecision {
  const { data: exams } = useQuery<TargetExam[]>({ queryKey: ['target-exams'], queryFn: listTargetExams });
  const { data: retomada } = useQuery<RetomadaStatus>({
    queryKey: ['retomada'], queryFn: getRetomadaStatus, staleTime: 5 * 60_000,
  });

  const dias = nearestExamDays(exams ?? []);
  const diasAusente = retomada?.diasAusente ?? 0;
  const isHiato = !!retomada?.isHiato;
  const risco = diasAusente >= 1 && diasAusente <= 3;

  // Prioridade: reta final crítica > retomada (hiato) > risco (1–3d) > reta final (8–30d).
  let card: CoachCard = null;
  if (dias !== null && dias <= RETA_CRITICO) card = 'reta-final';
  else if (isHiato) card = 'retomada';
  else if (risco) card = 'risco';
  else if (dias !== null && dias <= LIMITE_RETA) card = 'reta-final';

  return {
    card,
    returnMode: isHiato && diasAusente >= HIATO_MIN,
    diasAusente,
    loading: exams === undefined || retomada === undefined,
  };
}
