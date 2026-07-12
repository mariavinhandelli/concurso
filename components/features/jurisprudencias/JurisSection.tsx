'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/lib/theme';

interface Props {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: 'danger' | 'purple' | 'teal' | 'warn';
  children: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
}

export function JurisSection({
  title, icon, defaultOpen = false, highlight, children, empty, emptyText,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const borderColor =
    highlight === 'danger' ? theme.danger :
    highlight === 'purple' ? theme.clay :
    highlight === 'warn' ? theme.warn :
    highlight === 'teal' ? theme.teal :
    theme.line;

  const labelColor =
    highlight === 'danger' ? theme.danger :
    highlight === 'purple' ? theme.clay :
    highlight === 'warn' ? theme.warnDeep :
    highlight === 'teal' ? theme.teal :
    theme.inkSoft;

  return (
    <div style={{
      borderRadius: theme.radius,
      border: `0.5px solid ${open && highlight ? borderColor : theme.line}`,
      background: theme.card,
      overflow: 'hidden',
      transition: 'border-color .15s',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '13px 16px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: theme.font,
          borderLeft: highlight ? `3px solid ${borderColor}` : '3px solid transparent',
        }}
      >
        {icon && <span style={{ color: labelColor, display: 'flex', flexShrink: 0 }}>{icon}</span>}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: labelColor, textAlign: 'left' }}>
          {title}
        </span>
        <ChevronDown
          size={16} color={theme.inkFaint} strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}
        />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `0.5px solid ${theme.line}` }}>
          {empty ? (
            <p style={{ fontSize: 14, color: theme.inkFaint, margin: '12px 0 0', fontStyle: 'italic' }}>
              {emptyText ?? 'Não preenchido.'}
            </p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
