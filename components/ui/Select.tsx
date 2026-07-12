// components/ui/Select.tsx
// Primitivo de select do design system — mesma anatomia do Input, com chevron
// próprio (appearance:none mata o nativo do SO, que varia visualmente).
'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/lib/theme';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, error, id, style, className, children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const field = (
    <div style={{ position: 'relative' }}>
      <select
        ref={ref}
        id={fieldId}
        className={className}
        style={{
          width: '100%', boxSizing: 'border-box', appearance: 'none',
          padding: '10px 32px 10px 13px', borderRadius: theme.radiusSm,
          border: `0.5px solid ${error ? theme.danger : theme.line}`,
          background: theme.card, fontSize: 14, color: theme.ink,
          fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14} color={theme.inkFaint} strokeWidth={2} aria-hidden="true"
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      />
    </div>
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
