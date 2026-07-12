// components/ui/Switch.tsx
// Primitivo de toggle — extrai o padrão usado em Configurações (aparência)
// e no Gerador de cronograma, com role="switch" para acessibilidade.
'use client';

import { theme } from '@/lib/theme';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label': string;
}

export function Switch({ checked, onChange, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: theme.radiusPill,
        border: 'none', background: checked ? theme.teal : theme.muted,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        padding: 2, flexShrink: 0, transition: 'background .2s ease',
      }}
      {...rest}
    >
      <span
        style={{
          display: 'block', width: 20, height: 20, borderRadius: '50%',
          background: '#fff', boxShadow: theme.shadow,
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform .2s ease',
        }}
      />
    </button>
  );
}
