// components/ui/Card.tsx
// Primitivo de card do design system — radius 16 fixo (theme.radius) e duas
// densidades de padding, convergindo os ≥10 paddings de card distintos
// encontrados na 4ª auditoria de design (16/07/2026).
//   default (20px 24px) → cards de conteúdo (painéis, resumos)
//   compact (16px 18px) → cards densos (listas, grades com muitos itens)
// `interactive` adiciona hover (borda + sombra), para cards clicáveis.
'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { theme } from '@/lib/theme';

export type CardDensity = 'default' | 'compact';

const PADDING: Record<CardDensity, string> = {
  default: '20px 24px',
  compact: '16px 18px',
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  density?: CardDensity;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, Props>(function Card(
  { density = 'default', interactive, style, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`${interactive ? 'ui-card-interactive' : ''}${className ? ` ${className}` : ''}`}
      style={{
        background: theme.card,
        border: `0.5px solid ${theme.line}`,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: PADDING[density],
        transition: interactive ? 'border-color .14s ease, box-shadow .14s ease' : undefined,
        cursor: interactive ? 'pointer' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
