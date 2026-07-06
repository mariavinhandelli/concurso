'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { theme, zIndex } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type ToastKind = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

export interface ToastOptions {
  action?: ToastAction;
}

interface ToastContextValue {
  success: (msg: string, opts?: ToastOptions) => void;
  error: (msg: string, opts?: ToastOptions) => void;
  info: (msg: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { isMobile } = useUI();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const push = useCallback((message: string, kind: ToastKind, opts?: ToastOptions) => {
    const id = ++idSeq;
    setToasts((prev) => [...prev.slice(-4), { id, message, kind, action: opts?.action }]);
    // Toasts com action ficam abertos 6s para dar tempo de clicar "Desfazer"
    const duration = opts?.action ? 6000 : 4000;
    const t = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, t);
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    success: (msg, opts) => push(msg, 'success', opts),
    error: (msg, opts) => push(msg, 'error', opts),
    info: (msg, opts) => push(msg, 'info', opts),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div style={{ ...s.container, bottom: isMobile ? 84 : 24 }} aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              style={{
                ...s.toast,
                background: t.kind === 'error' ? theme.danger : t.kind === 'success' ? theme.ok : theme.teal,
              }}
            >
              <span style={s.msg}>{t.message}</span>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  style={s.actionBtn}
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} style={s.close} aria-label="Fechar">✕</button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return ctx;
}

const s: Record<string, CSSProperties> = {
  container: {
    position: 'fixed', bottom: 24, right: 24, zIndex: zIndex.toast,
    display: 'flex', flexDirection: 'column', gap: 8,
    maxWidth: 'min(360px, calc(100vw - 32px))',
  },
  toast: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    fontFamily: theme.font, animation: 'toast-in 0.2s ease',
  },
  msg: { flex: 1, fontSize: 13.5, fontWeight: 500, color: '#fff', lineHeight: 1.4 },
  actionBtn: {
    background: 'rgba(255,255,255,0.22)', border: 'none', color: '#fff',
    cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 6, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0,
  },
  close: {
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontSize: 13, padding: 0, flexShrink: 0,
  },
};
