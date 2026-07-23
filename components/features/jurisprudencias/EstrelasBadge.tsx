'use client';

import { Star } from 'lucide-react';
import { theme } from '@/lib/theme';

interface Props {
  value: 1 | 2 | 3 | 4 | 5;
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  size?: number;
  showLabel?: boolean;
}

const ESTRELAS_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'Altíssima',
  4: 'Alta',
  3: 'Média',
  2: 'Baixa',
  1: 'Muito baixa',
};

export function EstrelasBadge({ value, onChange, size = 16, showLabel = false }: Props) {
  const stars = ([1, 2, 3, 4, 5] as const).map((n) => (
    <Star key={n} size={size}
      fill={n <= value ? theme.gold : theme.line}
      color={n <= value ? theme.gold : theme.line}
      strokeWidth={1.7} aria-hidden="true" />
  ));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {onChange ? (
        <div style={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label="Relevância em estrelas">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              className="icon-touch-target"
              onClick={() => onChange(n)}
              role="radio"
              aria-checked={n === value}
              style={{
                border: 'none', background: 'transparent', padding: 0,
                cursor: 'pointer', display: 'grid', placeItems: 'center',
              }}
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            >
              <Star size={size}
                fill={n <= value ? theme.gold : theme.line}
                color={n <= value ? theme.gold : theme.line}
                strokeWidth={1.7} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        // Somente leitura: nada de <button> — leitores de tela anunciavam
        // "botão" vazio 5x por card. Uma imagem com rótulo resolve.
        <div style={{ display: 'flex', gap: 2 }} role="img" aria-label={`Relevância: ${ESTRELAS_LABEL[value]} (${value} de 5 estrelas)`}>
          {stars}
        </div>
      )}
      {showLabel && (
        <span style={{ fontSize: size * 0.8, fontWeight: 600, color: theme.warnDeep }}>
          {ESTRELAS_LABEL[value]}
        </span>
      )}
    </div>
  );
}
