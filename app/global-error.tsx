'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Erro global não tratado:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main style={styles.page} role="alert">
          <div style={styles.card}>
            <h1 style={styles.title}>A Focali encontrou um problema.</h1>
            <p style={styles.text}>Tente recarregar a aplicação. Seu progresso já salvo não será afetado.</p>
            <button type="button" onClick={unstable_retry} style={styles.button}>
              Recarregar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', fontFamily: 'var(--font-poppins), Arial, sans-serif' },
  card: { width: 'min(440px, 100%)', boxSizing: 'border-box', padding: 32, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)', textAlign: 'center' },
  title: { color: 'var(--ink)', fontSize: 22, margin: '0 0 10px' },
  text: { color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' },
  button: { border: 0, borderRadius: 10, padding: '11px 18px', background: 'var(--teal)', color: 'var(--on-teal)', font: 'inherit', fontWeight: 600, cursor: 'pointer' },
};
