'use client';

import { useEffect, useRef } from 'react';
import { theme, zIndex } from '@/lib/theme';

export function Overlay({ children, onClose, labelledBy }: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, []);

  function handleTab(e: React.KeyboardEvent) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--backdrop)',
        zIndex: zIndex.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Tab') handleTab(e); }}
        style={{
          position: 'relative',
          background: theme.card,
          border: `0.5px solid ${theme.line}`,
          borderRadius: theme.radius,
          boxShadow: theme.shadowModal,
          width: '100%', maxWidth: 680,
          maxHeight: '90vh', overflowY: 'auto',
          padding: '24px 28px',
          fontFamily: theme.font,
          zIndex: zIndex.modal,
          outline: 'none',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          aria-keyshortcuts="Escape"
          style={{ position: 'absolute', top: 14, right: 16, border: 'none', background: 'transparent', fontSize: 18, color: theme.inkFaint, cursor: 'pointer', lineHeight: 1, padding: 4 }}
        >✕</button>
        {children}
      </div>
    </div>
  );
}
