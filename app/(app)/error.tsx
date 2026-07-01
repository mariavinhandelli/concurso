'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro não tratado na área autenticada:', error);
  }, [error]);

  return (
    <div style={styles.wrap} role="alert">
      <div style={styles.card}>
        <span style={styles.code}>Algo saiu do trilho</span>
        <h1 style={styles.title}>Não foi possível abrir esta tela.</h1>
        <p style={styles.text}>Seus dados continuam seguros. Tente carregar novamente.</p>
        <button type="button" onClick={reset} style={styles.button}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: 360, display: 'grid', placeItems: 'center', padding: 24 },
  card: { maxWidth: 440, padding: 28, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)', textAlign: 'center' },
  code: { color: 'var(--danger)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: 'var(--ink)', fontSize: 22, margin: '8px 0' },
  text: { color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' },
  button: { border: 0, borderRadius: 10, padding: '11px 18px', background: 'var(--teal)', color: 'var(--on-teal)', font: 'inherit', fontWeight: 600, cursor: 'pointer' },
};
