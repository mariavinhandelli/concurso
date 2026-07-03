// Hook centralizado de refresh ao retornar à aba.
// Usa um ref para manter o callback estável — o listener é registrado uma única vez,
// sem re-registros a cada render, mas sempre chama a versão mais recente do fn.
import { useEffect, useRef } from 'react';

export function useRefreshOnFocus(fn: () => void): void {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  useEffect(() => {
    function handle() {
      if (document.visibilityState === 'visible') fnRef.current();
    }
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);
}
