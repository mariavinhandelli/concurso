'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Mensagem de fallback; se omitida usa um genérico. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary de componente — isola falhas de render dentro de painéis individuais
 * sem derrubar a página inteira. Use para envolver seções autossuficientes.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <PainelPesado />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Não logar para não poluir o console do usuário final em produção.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={styles.wrap} role="alert">
          <p style={styles.title}>Não foi possível carregar esta seção.</p>
          <p style={styles.detail}>{this.state.error.message}</p>
          <button
            style={styles.retry}
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '24px 20px', borderRadius: 12, border: '0.5px solid var(--line)', background: 'var(--card)', textAlign: 'center' },
  title: { color: 'var(--ink)', fontWeight: 600, fontSize: 15, margin: '0 0 6px' },
  detail: { color: 'var(--ink-soft)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 },
  retry: { border: 0, borderRadius: 8, padding: '9px 16px', background: 'var(--teal)', color: 'var(--on-teal)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
