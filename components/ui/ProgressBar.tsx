// components/ui/ProgressBar.tsx
// Primitivo de barra de progresso — extrai o padrão de components/features
// /conquistas (GPU via scaleX, sem reflow por frame), reusável fora do módulo.
'use client';

import { theme } from '@/lib/theme';

interface Props {
  /** 0–1 */
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  animate?: boolean;
}

export function ProgressBar({ value, color = theme.teal, trackColor = theme.muted, height = 6, animate = true }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ width: '100%', height, background: trackColor, borderRadius: theme.radiusPill, overflow: 'hidden' }}>
      <div
        style={{
          width: '100%', height: '100%', borderRadius: theme.radiusPill,
          background: color, transformOrigin: 'left',
          transform: `scaleX(${pct})`,
          transition: animate ? 'transform .5s cubic-bezier(.4,0,.2,1)' : undefined,
        }}
      />
    </div>
  );
}
