'use client';

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
            onClick={onChange ? () => onChange(n) : undefined}
            style={{
              border: 'none', background: 'transparent', padding: 0,
              cursor: onChange ? 'pointer' : 'default', display: 'flex',
            }}
            aria-label={onChange ? `${n} estrelas` : undefined}
          >
            <svg width={size} height={size} viewBox="0 0 24 24"
              fill={n <= value ? '#f59e0b' : theme.line}
              stroke={n <= value ? '#f59e0b' : theme.line}
              strokeWidth="1.7">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
            </svg>
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
