// components/features/dashboard/NarrativaMes.tsx
// M6 — "Leitura do mês": 2-4 frases geradas por IA a partir dos números
// determinísticos do mês COMPLETO anterior (Edge Function + juiz de
// fidelidade). Sem narrativa gravada, o card simplesmente não existe —
// nenhum estado vazio ocupando a página.
'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { getLatestNarrative, type MonthlyNarrative } from '@/services/narrative.service';
import { theme } from '@/lib/theme';

export function NarrativaMes() {
  const { data } = useQuery<MonthlyNarrative | null>({
    queryKey: ['monthly-narrative'],
    queryFn: getLatestNarrative,
    staleTime: 6 * 60 * 60_000, // muda 1x por mês — cache de 6h é até conservador
  });

  if (!data) return null;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <Sparkles size={14} color={theme.clay} strokeWidth={2} aria-hidden="true" />
        <span style={s.title}>Leitura de {data.monthLabel}</span>
      </div>
      <p style={s.text}>{data.frases.join(' ')}</p>
      <p style={s.footnote}>Escrita por IA a partir dos seus números do mês — nada além deles.</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: '18px 22px', minWidth: 0, fontFamily: theme.font,
  },
  head: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.inkSoft },
  text: { fontSize: 14.5, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 },
  footnote: { fontSize: 11, color: theme.inkFaint, margin: '10px 0 0', fontWeight: 500 },
};
