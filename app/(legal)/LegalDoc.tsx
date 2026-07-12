// app/(legal)/LegalDoc.tsx
// Casca visual compartilhada por Termos e Privacidade. Fora do grupo (app):
// páginas públicas, indexáveis, sem sidebar/login. Server component puro.
import Link from 'next/link';
import { theme } from '@/lib/theme';

export function LegalDoc({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main style={styles.wrap}>
      <header style={styles.header}>
        <Link href="/" style={styles.brand}>focali</Link>
        <nav style={styles.nav}>
          <Link href="/termos" style={styles.navLink}>Termos de Uso</Link>
          <Link href="/privacidade" style={styles.navLink}>Privacidade</Link>
        </nav>
      </header>

      <article style={styles.article}>
        <h1 style={styles.h1}>{title}</h1>
        <p style={styles.updated}>Última atualização: {updatedAt}</p>
        {intro && <div style={styles.intro}>{intro}</div>}
        {children}
      </article>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          focali — 【RAZÃO SOCIAL】, CNPJ 【00.000.000/0001-00】. Dúvidas:{' '}
          <a href="mailto:【contato@focali.app】" style={styles.link}>【contato@focali.app】</a>.
        </p>
      </footer>
    </main>
  );
}

// Blocos reutilizáveis para manter a tipografia uniforme entre os dois documentos.
export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section style={styles.section}>
      <h2 id={id} style={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={styles.p}>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul style={styles.ul}>{children}</ul>;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 780, margin: '0 auto', padding: '0 24px 80px', fontFamily: theme.font, color: theme.ink, background: theme.bg, minHeight: '100vh' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0', borderBottom: `0.5px solid ${theme.line}`, flexWrap: 'wrap', gap: 12 },
  brand: { fontSize: 20, fontWeight: 800, color: theme.primary, textDecoration: 'none', letterSpacing: -0.5 },
  nav: { display: 'flex', gap: 18 },
  navLink: { fontSize: 14, fontWeight: 600, color: theme.inkSoft, textDecoration: 'none' },
  article: { paddingTop: 36 },
  h1: { fontSize: 30, fontWeight: 800, letterSpacing: -0.6, margin: '0 0 6px' },
  updated: { fontSize: 13, color: theme.inkFaint, margin: '0 0 28px' },
  intro: { fontSize: 16, lineHeight: 1.7, color: theme.inkSoft, margin: '0 0 12px' },
  section: { marginTop: 32 },
  h2: { fontSize: 19, fontWeight: 700, letterSpacing: -0.3, margin: '0 0 10px', scrollMarginTop: 24 },
  p: { fontSize: 15, lineHeight: 1.75, color: theme.ink, margin: '0 0 12px' },
  ul: { fontSize: 15, lineHeight: 1.75, color: theme.ink, margin: '0 0 12px', paddingLeft: '1.4em', listStyle: 'disc' },
  footer: { marginTop: 56, paddingTop: 24, borderTop: `0.5px solid ${theme.line}` },
  footerText: { fontSize: 13, color: theme.inkFaint, lineHeight: 1.6, margin: 0 },
  link: { color: theme.teal, textDecoration: 'underline' },
};
