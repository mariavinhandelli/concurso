import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <span style={styles.code}>404</span>
        <h1 style={styles.title}>Esta página não existe.</h1>
        <p style={styles.text}>O endereço pode ter mudado ou ter sido digitado incorretamente.</p>
        <Link href="/" style={styles.link}>Voltar ao início</Link>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', fontFamily: 'var(--font-poppins), Arial, sans-serif' },
  card: { width: 'min(440px, 100%)', boxSizing: 'border-box', padding: 32, borderRadius: 18, border: '0.5px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)', textAlign: 'center' },
  code: { color: 'var(--teal)', fontSize: 13, fontWeight: 800, letterSpacing: 1 },
  title: { color: 'var(--ink)', fontSize: 24, margin: '8px 0' },
  text: { color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' },
  link: { display: 'inline-block', borderRadius: 10, padding: '11px 18px', background: 'var(--teal)', color: 'var(--on-teal)', fontWeight: 600, textDecoration: 'none' },
};
