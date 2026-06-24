// components/features/home/BentoCard.tsx
// Invólucro dos blocos do bento grid. Profundidade via sombra dupla,
// elevação leve no hover. Aceita span de colunas/linhas pra modular o grid.
'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { theme } from '@/lib/theme';

type Props = {
  children: ReactNode;
  colSpan?: number;        // quantas colunas o bloco ocupa
  rowSpan?: number;        // quantas linhas
  accent?: string;         // cor de fundo opcional (degradê suave)
  interactive?: boolean;   // hover com elevação + cursor
  onClick?: () => void;
  style?: CSSProperties;
};

export function BentoCard({
  children, colSpan = 1, rowSpan = 1,
  accent, interactive = false, onClick, style,
}: Props) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        background: accent
          ? `linear-gradient(135deg, ${accent}, ${theme.card})`
          : theme.card,
        border: `1px solid ${theme.line}`,
        borderRadius: theme.radius,
        padding: 24,
        boxShadow: hover && interactive ? theme.shadowHover : theme.shadow,
        transform: hover && interactive ? 'translateY(-3px)' : 'none',
        transition: 'transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}