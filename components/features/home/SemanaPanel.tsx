// components/features/home/SemanaPanel.tsx
// M7 — unifica os sistemas motivacionais da semana num único painel, em vez de
// três cards rivais competindo por atenção. O streak é o laço central (topo);
// as missões e o resumo do coach passam a ser CONTEÚDO do painel, não cartões
// separados. Cada seção opcional (missões, coach) traz o próprio divisor e some
// por inteiro quando não há dados — o painel nunca fica com divisor órfão.
'use client';

import { StreakBar } from '@/components/features/streak/StreakBar';
import { MissoesSemana } from '@/components/features/home/MissoesSemana';
import { CoachSemanal } from '@/components/features/home/CoachSemanal';
import { theme } from '@/lib/theme';

export function SemanaPanel() {
  return (
    <div style={s.card}>
      <StreakBar />
      <MissoesSemana bare />
      <CoachSemanal variant="row" />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card,
    border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: 18,
    minWidth: 0,
    fontFamily: theme.font,
  },
};
