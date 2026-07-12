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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            className={onChange ? 'icon-touch-target' : undefined}
            onClick={onChange ? () => onChange(n) : undefined}
            style={{
              border: 'none', background: 'transparent', padding: 0,
              cursor: onChange ? 'pointer' : 'default', display: 'grid', placeItems: 'center',
            }}
            aria-label={onChange ? `${n} estrelas` : undefined}
          >
            <Star size={size}
              fill={n <= value ? '#f59e0b' : theme.line}
              color={n <= value ? '#f59e0b' : theme.line}
              strokeWidth={1.7} />
          </button>
        ))}
      </div>
      {showLabel && (
        <span style={{ fontSize: size * 0.8, fontWeight: 600, color: theme.warnDeep }}>
          {ESTRELAS_LABEL[value]}
        </span>
      )}
    </div>
  );
}
