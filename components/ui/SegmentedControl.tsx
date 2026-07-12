// components/ui/SegmentedControl.tsx
// Primitivo de abas segmentadas — extrai o padrão repetido em Flashcards,
// Caderno, Matérias e Histórico (trilha com fundo suave, aba ativa em card
// + sombra). `equalWidth` cobre o caso de 2-3 abas ocupando a linha toda;
// sem ele, cada aba tem largura pelo conteúdo (ex.: filtros de período).
'use client';

import { theme } from '@/lib/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  equalWidth?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, equalWidth = true }: Props<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex', gap: 4, padding: 3,
        background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm,
        width: equalWidth ? '100%' : 'fit-content',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              flex: equalWidth ? 1 : undefined,
              padding: equalWidth ? '8px 0' : '8px 16px',
              borderRadius: 10, border: 'none',
              background: active ? theme.card : 'transparent',
              color: active ? theme.ink : theme.inkSoft,
              fontSize: 14, fontWeight: active ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: active ? theme.shadow : 'none',
              transition: 'background .15s ease, color .15s ease, box-shadow .15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
