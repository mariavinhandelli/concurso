'use client';

import { useEffect, useRef } from 'react';
import { theme, zIndex } from '@/lib/theme';
import { IconButton } from './IconButton';

export function Overlay({ children, onClose, labelledBy, maxWidth = 680, hideClose = false, closeOnBackdrop = true, padding = '24px 28px' }: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
  maxWidth?: number;
  hideClose?: boolean;
  closeOnBackdrop?: boolean;
  padding?: number | string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
      prev?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
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
          width: '100%', maxWidth,
          maxHeight: '90vh', overflowY: 'auto',
          padding,
          fontFamily: theme.font,
          zIndex: zIndex.modal,
          outline: 'none',
        }}
      >
        {!hideClose && (
          <IconButton
            onClick={onClose}
            aria-label="Fechar"
            aria-keyshortcuts="Escape"
            size="sm"
            style={{ position: 'absolute', top: 10, right: 12, fontSize: 16 }}
          >✕</IconButton>
        )}
        {children}
      </div>
    </div>
  );
}
