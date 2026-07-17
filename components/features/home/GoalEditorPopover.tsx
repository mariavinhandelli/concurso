'use client';

import type { ReactNode } from 'react';
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
  return (
    <div style={styles.popover}>
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
  popSave: {
    padding: '7px 14px', borderRadius: theme.radiusXs, border: 'none',
    background: theme.teal, color: theme.onTeal, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit',
  },
};
