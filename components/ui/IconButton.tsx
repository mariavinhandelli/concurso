// components/ui/IconButton.tsx
// Primitivo de botão só-ícone — companion do Button para ações compactas
// (fechar, editar, mais opções) que não levam texto.
'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { theme } from '@/lib/theme';

export type IconButtonVariant = 'ghost' | 'outline';
export type IconButtonSize = 'md' | 'sm';

const SIZES: Record<IconButtonSize, number> = { md: 36, sm: 28 };

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { variant = 'ghost', size = 'md', style, className, disabled, type = 'button', ...rest },
  ref,
) {
  const dim = SIZES[size];
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`ui-icon-btn ui-icon-btn-${variant}${className ? ` ${className}` : ''}`}
      style={{
        width: dim, height: dim, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        borderRadius: theme.radiusSm, fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        color: theme.inkSoft,
        background: variant === 'outline' ? theme.card : 'transparent',
        border: variant === 'outline' ? `0.5px solid ${theme.line}` : 'none',
        ...style,
      }}
      {...rest}
    />
  );
});
