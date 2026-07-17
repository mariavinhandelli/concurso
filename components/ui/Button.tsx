// components/ui/Button.tsx
// Primitivo de botão do design system — substitui os objetos de estilo locais.
//   primary    → ação principal (navy sólido, onTeal)
//   outline    → ação secundária (borda + card)
//   ghost      → ação terciária (transparente)
//   danger     → destrutiva confirmada (vermelho sólido)
//   dangerSoft → destrutiva de entrada (tinta suave, ex.: "Sair de tudo")
// Hover vem das classes .ui-btn-* em globals.css. Estados de disabled já inclusos.
'use client';

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { theme } from '@/lib/theme';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'outline' | 'brandOutline' | 'ghost' | 'danger' | 'dangerSoft';
export type ButtonSize = 'md' | 'sm' | 'lg';

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary:      { background: theme.primary, color: theme.onPrimary, border: 'none', fontWeight: 600 },
  outline:      { background: theme.card, color: theme.inkSoft, border: `0.5px solid ${theme.line}`, fontWeight: 500 },
  // "outline teal" — recriada via style prop em ~17 lugares (schedule, targets, editais...).
  brandOutline: { background: theme.card, color: theme.inkSoft, border: `0.5px solid ${theme.teal}`, fontWeight: 600 },
  ghost:        { background: 'transparent', color: theme.inkSoft, border: 'none', fontWeight: 500 },
  danger:       { background: theme.danger, color: theme.onDanger, border: 'none', fontWeight: 600 },
  dangerSoft:   { background: theme.dangerBg, color: theme.danger, border: '0.5px solid color-mix(in srgb, var(--danger) 30%, transparent)', fontWeight: 600 },
};

const SIZES: Record<ButtonSize, CSSProperties> = {
  lg: { padding: '13px 32px', fontSize: 15, borderRadius: theme.radiusSm },
  md: { padding: '11px 22px', fontSize: 14, borderRadius: theme.radiusSm },
  sm: { padding: '8px 14px', fontSize: 13, borderRadius: theme.radiusSm },
};

const SPINNER_SIZE: Record<ButtonSize, number> = { lg: 16, md: 14, sm: 12 };

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, style, className, disabled, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        whiteSpace: 'nowrap', opacity: disabled ? 0.55 : 1,
        width: fullWidth ? '100%' : undefined,
        ...SIZES[size],
        ...VARIANTS[variant],
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner size={SPINNER_SIZE[size]} />}
      {children}
    </button>
  );
});
