// components/ui/Menu.tsx
// Primitivo de dropdown/popover — converge os ~7 menus à mão do app (kebab
// menus, avatar, notificações) numa única API: dismiss por click-outside e
// Esc, radius/sombra/z-index consistentes (theme.zIndex.menu).
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { theme, zIndex } from '@/lib/theme';

interface MenuProps {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  width?: number;
}

export function Menu({ trigger, children, align = 'right', width = 200 }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {trigger({ onClick: (e) => { e.stopPropagation(); setOpen((v) => !v); }, open })}
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: '100%', [align]: 0, marginTop: 6,
            background: theme.card, border: `0.5px solid ${theme.line}`,
            borderRadius: theme.radiusSm, boxShadow: theme.shadowHover,
            padding: 4, zIndex: zIndex.menu, minWidth: width,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  icon?: ReactNode;
}

export function MenuItem({ onClick, children, danger, icon }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      className="ui-menu-item"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', textAlign: 'left', padding: '8px 12px',
        borderRadius: theme.radiusXs, border: 'none', background: 'transparent',
        color: danger ? theme.danger : theme.ink, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
