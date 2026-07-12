// components/ui/Textarea.tsx
// Primitivo de área de texto do design system — mesma anatomia do Input
// (padding, radius, borda, foco), com resize vertical por padrão.
'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { theme } from '@/lib/theme';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, hint, error, id, style, className, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const field = (
    <textarea
      ref={ref}
      id={fieldId}
      className={className}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '10px 13px', borderRadius: theme.radiusSm,
        border: `0.5px solid ${error ? theme.danger : theme.line}`,
        background: theme.card, fontSize: 14, color: theme.ink,
        fontFamily: 'inherit', outline: 'none', resize: 'vertical',
        ...style,
      }}
      {...rest}
    />
  );

  if (!label && !hint && !error) return field;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500, color: theme.inkSoft }}>
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
