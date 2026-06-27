export default function AppLoading() {
  return (
    <div style={styles.wrap} role="status" aria-live="polite">
      <span style={styles.spinner} aria-hidden="true" />
      <span>Carregando sua área de estudos…</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    color: 'var(--ink-soft)',
    fontSize: 14,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid var(--line)',
    borderTopColor: 'var(--teal)',
    animation: 'focali-spin .8s linear infinite',
  },
};
