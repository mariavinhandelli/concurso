'use client';

import { useEffect } from 'react';
import { theme } from '@/lib/theme';

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
          <button onClick={onCancel} style={styles.cancelBtn}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{ ...styles.confirmBtn, background: danger ? theme.danger : theme.teal }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9000, padding: 16,
  },
  modal: {
    background: theme.card, borderRadius: 16, padding: '24px 24px 20px',
    width: 'min(380px, 94vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    fontFamily: theme.font,
  },
  title: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0 },
  desc: { fontSize: 13.5, color: theme.inkSoft, margin: '8px 0 0', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    border: `0.5px solid ${theme.line}`, background: theme.card,
    color: theme.inkSoft, fontSize: 14, fontWeight: 500,
  },
  confirmBtn: {
    padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
  },
};
