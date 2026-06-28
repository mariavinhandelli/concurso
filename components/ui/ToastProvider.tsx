'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { theme } from '@/lib/theme';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const push = useCallback((message: string, kind: ToastKind) => {
    const id = ++idSeq;
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }]);
    const t = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, t);
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const value: ToastContextValue = {
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'error'),
    info: (msg) => push(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div style={styles.container} aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              style={{
                ...styles.toast,
                background: t.kind === 'error' ? theme.danger : t.kind === 'success' ? theme.ok : theme.teal,
              }}
            >
              <span style={styles.msg}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={styles.close} aria-label="Fechar">✕</button>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
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
  close: {
    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontSize: 13, padding: 0, flexShrink: 0,
  },
};
