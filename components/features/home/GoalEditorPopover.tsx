'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { theme, zIndex } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface GoalEditorPopoverProps {
  label: string;
  weeklyHint?: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function GoalEditorPopover({ label, weeklyHint, saving, onSave, onClose, children }: GoalEditorPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Escape fecha; clique fora fecha. O gatilho (data-popover-trigger) é ignorado
  // no clique-fora — senão o pointerdown fecharia e o click do gatilho reabriria.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: PointerEvent) {
      const alvo = e.target as Element | null;
      if (!alvo) return;
      if (alvo.closest('[data-popover-trigger]')) return;
      if (ref.current && !ref.current.contains(alvo)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  // Foco entra no primeiro campo ao abrir (navegação por teclado).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, []);

  return (
    <div ref={ref} style={styles.popover} role="dialog" aria-label={label}>
      <div style={styles.popLabel}>{label}</div>
      {children}
      {weeklyHint && <div style={styles.popHint}>{weeklyHint}</div>}
      <div style={styles.popActions}>
        <Button variant="ghost" size="sm" className="touch-target" onClick={onClose}>Cancelar</Button>
        <Button size="sm" className="touch-target" onClick={onSave} disabled={saving}>
          {saving ? '…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  popover: {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: zIndex.menu,
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm,
    boxShadow: theme.shadowHover, padding: 14, width: 200,
  },
  popLabel: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, marginBottom: 10 },
  popHint: { fontSize: 12, color: theme.inkFaint, marginBottom: 10, marginTop: -4 },
  popActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
};
