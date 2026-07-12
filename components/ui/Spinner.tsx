// components/ui/Spinner.tsx
// Spinner de loading do design system — mesma anatomia usada dentro do
// Button (prop loading), disponível solto para estados de carregamento
// fora de um botão (troca de "Carregando…" literal).
import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Spinner({ size = 16, color = 'currentColor', style }: Props) {
  return (
    <span
      aria-hidden="true"
      role="status"
      style={{
        display: 'inline-block', width: size, height: size,
        border: '2px solid ' + color, borderRightColor: 'transparent',
        borderRadius: '50%', animation: 'focali-spin .6s linear infinite',
        flexShrink: 0, opacity: 0.8,
        ...style,
      }}
    />
  );
}
