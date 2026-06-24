// components/features/home/StatBlock.tsx
// Bloco de métrica: número grande é o protagonista, label pequeno em cima.
// Usado dentro de um BentoCard.
'use client';

import { type ReactNode } from 'react';
import { theme } from '@/lib/theme';

type Props = {
  label: string;            // rótulo pequeno (UPPERCASE)
  value: ReactNode;         // número/valor em destaque
  unit?: string;            // sufixo pequeno (ex: "dias", "%")
  foot?: string;            // legenda discreta embaixo
  icon?: ReactNode;         // ícone opcional no topo
  iconBg?: string;          // fundo pastel do ícone
  valueColor?: string;      // cor do número (default: ink)
  numberSize?: number;      // tamanho do número (default 40)
};

export function StatBlock({
  label, value, unit, foot, icon, iconBg,
  valueColor = theme.ink, numberSize = 40,
}: Props) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: iconBg ?? theme.tealBg,
            display: 'grid', placeItems: 'center',
          }}>
            {icon}
          </div>
        )}
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: theme.inkFaint,
          letterSpacing: .3, textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{
            fontSize: numberSize, fontWeight: 700, color: valueColor,
            lineHeight: 1, letterSpacing: -1.2, fontVariantNumeric: 'tabular-nums',
          }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: 15, fontWeight: 700, color: valueColor }}>
              {unit}
            </span>
          )}
        </div>
        {foot && (
          <div style={{
            fontSize: 12.5, color: theme.inkSoft, fontWeight: 600, marginTop: 4,
          }}>
            {foot}
          </div>
        )}
      </div>
    </>
  );
}