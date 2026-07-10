// components/features/home/CoachSlot.tsx
// Renderiza UM card de coaching (o vencedor decidido por useCoachDecision),
// reusando os componentes atuais sem reescrever visual. Substitui o empilhamento
// de RetaFinal/Retomada/Risco no topo da Home. Dispara coach_shown para medir
// qual mensagem aparece. Os guards internos de cada card continuam valendo como
// rede de segurança (a decisão usa os mesmos dados).
'use client';

import { useEffect } from 'react';
import { RetaFinalCard } from './RetaFinalCard';
import { RetomadaCard } from './RetomadaCard';
import { SequenciaRiscoCard } from './SequenciaRiscoCard';
import { track, EV } from '@/lib/analytics';
import type { CoachDecision } from '@/hooks/useCoach';

export function CoachSlot({ decision }: { decision: CoachDecision }) {
  const { card } = decision;

  useEffect(() => {
    if (card) track(EV.coachShown, { type: card });
  }, [card]);

  if (card === 'reta-final') return <RetaFinalCard />;
  if (card === 'retomada') return <RetomadaCard />;
  if (card === 'risco') return <SequenciaRiscoCard />;
  return null;
}
