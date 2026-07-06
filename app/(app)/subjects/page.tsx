'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { theme, pageWide } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Tab = 'banco' | 'minhas';

function savedTab(): Tab {
  if (typeof window === 'undefined') return 'banco';
  const v = localStorage.getItem('subjects_tab');
  return v === 'minhas' ? 'minhas' : 'banco';
}

const BancoTab = dynamic(
  () => import('@/components/features/subjects/BancoTab').then((m) => ({ default: m.BancoTab })),
  { loading: () => <TabSkeleton /> },
);

const MinhasTab = dynamic(
  () => import('@/components/features/subjects/MinhasTab').then((m) => ({ default: m.MinhasTab })),
  { loading: () => <TabSkeleton /> },
);

function TabSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 64, borderRadius: 14,
            background: theme.muted,
            animation: 'skeleton-pulse 1.4s ease infinite',
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function SubjectsPage() {
  const { isMobile } = useUI();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(savedTab);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    localStorage.setItem('subjects_tab', t);
  }, []);

  const handleError = useCallback((m: string) => toast.error(m), [toast]);
  const handleActivated = useCallback(() => {
    toast.success('Matéria ativada com sucesso!');
    handleTabChange('minhas');
  }, [toast, handleTabChange]);

  return (
    <div style={{ ...pageWide, padding: isMobile ? '20px 16px' : '34px 40px', minWidth: 0 }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>Matérias</h1>
        <p style={styles.sub}>Explore o banco de matérias ou gerencie as suas.</p>
      </div>

      <div style={styles.tabs}>
        <button
          className="touch-target"
          onClick={() => handleTabChange('banco')}
          style={{ ...styles.tab, ...(tab === 'banco' ? styles.tabActive : {}) }}
        >
          Explorar
        </button>
        <button
          className="touch-target"
          onClick={() => handleTabChange('minhas')}
          style={{ ...styles.tab, ...(tab === 'minhas' ? styles.tabActive : {}) }}
        >
          Minhas matérias
        </button>
      </div>

      {/* key força re-mount na troca de aba, disparando a animação CSS .tab-enter */}
      <div key={tab} className="tab-enter">
        {tab === 'banco'
          ? <BancoTab isMobile={isMobile} onError={handleError} onActivated={handleActivated} />
          : <MinhasTab isMobile={isMobile} onError={handleError} />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 24 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: 12, width: 'fit-content' },
  tab: {
    padding: '8px 18px', borderRadius: 9, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all .15s',
  },
  tabActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
};
