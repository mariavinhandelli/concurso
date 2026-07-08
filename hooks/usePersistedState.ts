// hooks/usePersistedState.ts
// Estado persistido em localStorage de forma SSR-safe. Usa useSyncExternalStore:
// na renderização do servidor e na hidratação usa o `fallback` (igual ao HTML do
// servidor → sem mismatch de hidratação); depois passa a ler o valor salvo. É a
// forma canônica do React para ler estado externo mutável, e substitui o padrão
// `useState(() => localStorage...)` que divergia entre servidor e cliente.
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function usePersistedState<T extends string>(
  key: string,
  fallback: T,
  parse: (raw: string | null) => T,
): [T, (value: T) => void] {
  const eventName = `focali:persisted:${key}`;

  const subscribe = useCallback((onChange: () => void) => {
    // 'storage' cobre outras abas; o CustomEvent cobre a própria aba (o evento
    // 'storage' não dispara na aba que escreveu).
    const handler = (e: Event) => {
      if (e instanceof StorageEvent && e.key !== null && e.key !== key) return;
      onChange();
    };
    window.addEventListener('storage', handler);
    window.addEventListener(eventName, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(eventName, handler);
    };
  }, [key, eventName]);

  const getSnapshot = useCallback((): T => {
    try { return parse(localStorage.getItem(key)); } catch { return fallback; }
  }, [key, parse, fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

  const setValue = useCallback((next: T) => {
    try { localStorage.setItem(key, next); } catch { /* modo privado / cota */ }
    window.dispatchEvent(new Event(eventName));
  }, [key, eventName]);

  return [value, setValue];
}
