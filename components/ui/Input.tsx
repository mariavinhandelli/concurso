// components/ui/Input.tsx
// Primitivo de campo de texto do design system — substitui os objetos de
// estilo locais "input:" repetidos em cada formulário/modal.
// Label + hint/erro opcionais; o <input> em si sempre usa o mesmo radius,
// borda, fundo e foco ring (focus-visible universal já vem de globals.css).
'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { theme } from '@/lib/theme';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Ícone fixo à esquerda (ex.: lupa de busca, envelope de e-mail). */
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, icon, id, style, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const input = (
    <input
      ref={ref}
      id={inputId}
      className={className}
      style={{
        width: '100%', minWidth: 0, boxSizing: 'border-box',
        padding: icon ? '10px 13px 10px 38px' : '10px 13px', borderRadius: theme.radiusSm,
        border: `0.5px solid ${error ? theme.danger : theme.line}`,
        background: theme.card, fontSize: 14, color: theme.ink,
        fontFamily: 'inherit', outline: 'none',
        ...style,
      }}
      {...rest}
    />
  );

  const field = icon ? (
    <div style={{ position: 'relative' }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: theme.inkFaint, pointerEvents: 'none' }}>
        {icon}
      </span>
      {input}
    </div>
  ) : input;

  // Sem label/hint/error: retorna o campo puro, usável direto como item de
  // flexbox (ex.: ao lado de um Button numa mesma linha). Com qualquer um
  // deles, envolve num wrapper de coluna para empilhar label/hint por baixo.
  if (!label && !hint && !error) return field;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 500, color: theme.inkSoft }}>
          {label}
        </label>
      )}
      {field}
      {error ? (
        <span style={{ fontSize: 13, color: theme.danger }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 13, color: theme.inkFaint }}>{hint}</span>
      ) : null}
    </div>
  );
});
