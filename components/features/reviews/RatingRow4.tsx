// components/features/reviews/RatingRow4.tsx
// Grade de 4 botões de avaliação (Errei/Difícil/Ok/Dominei) com preview do
// próximo intervalo — usada por qualquer fluxo de revisão baseado no estado
// de 4 níveis (lib/juris-review): lei seca, jurisprudência, e a fila única.
// Fundos SÓLIDOS (theme.*Bg), não os *Tint translúcidos: sobre o tema escuro
// um tint de baixo alfa fica quase da mesma luminância do texto colorido —
// contraste medido abaixo de 2:1 em 3 dos 4 botões com a versão tint.
'use client';

import { theme } from '@/lib/theme';
import { fmtInterval } from '@/lib/interval-format';
import {
  RATING_LABEL, calculateNextJurisReview, type JurisRating, type JurisReviewState,
} from '@/lib/juris-review';

export const RATINGS_4: { key: JurisRating; fg: string; bg: string }[] = [
  { key: 'errei',   fg: theme.danger,   bg: theme.dangerBg },
  { key: 'dificil', fg: theme.warnDeep, bg: theme.warnBg },
  { key: 'ok',      fg: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', fg: theme.okDeep,   bg: theme.okBg },
];

export function RatingRow4({ state, onRate, disabled }: {
  state: JurisReviewState;
  onRate: (r: JurisRating) => void;
  disabled?: boolean;
}) {
  return (
    <div style={s.ratings4}>
      {RATINGS_4.map((r, i) => (
        <button
          key={r.key}
          onClick={() => onRate(r.key)}
          disabled={disabled}
          style={{
            ...s.rating4Btn,
            border: `0.5px solid ${r.fg}`, background: r.bg, color: r.fg,
            opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{RATING_LABEL[r.key]}</span>
          <span style={s.ratingInterval}>→ {fmtInterval(calculateNextJurisReview(state, r.key).intervalDays)}</span>
        </button>
      ))}
    </div>
  );
}

const s = {
  ratings4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  rating4Btn: { padding: '13px 10px', borderRadius: theme.radiusSm, fontFamily: theme.font, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3 },
  ratingKey: { fontSize: 11, opacity: 0.65 },
  ratingLbl: { fontWeight: 700, fontSize: 14 },
  ratingInterval: { fontSize: 11, fontWeight: 500, opacity: 0.85 },
};
