'use client';

import { useEffect } from 'react';
import { theme, zIndex } from '@/lib/theme';
import { Button } from './Button';

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h3 id="confirm-title" style={styles.title}>{title}</h3>
        {description && <p style={styles.desc}>{description}</p>}
        <div style={styles.actions}>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'var(--backdrop)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: zIndex.dialog, padding: 16,
  },
  modal: {
    background: theme.card, borderRadius: theme.radius, padding: '24px 24px 20px',
    width: 'min(380px, 94vw)', boxShadow: theme.shadowModal,
    fontFamily: theme.font,
  },
  title: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  desc: { fontSize: 14, color: theme.inkSoft, margin: '8px 0 0', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
};
