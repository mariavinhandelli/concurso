'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { PageContainer, PageHeader } from '@/components/ui/Page';

type Tab = 'banco' | 'minhas';

const parseTab = (v: string | null): Tab => (v === 'minhas' ? 'minhas' : 'banco');

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
  // Aba persistida de forma SSR-safe (sem mismatch de hidratação).
  const [tab, setTab] = usePersistedState<Tab>('subjects_tab', 'banco', parseTab);

  const handleTabChange = useCallback((t: Tab) => { setTab(t); }, [setTab]);

  const handleError = useCallback((m: string) => toast.error(m), [toast]);
  const handleActivated = useCallback(() => {
    toast.success('Matéria ativada com sucesso!');
    handleTabChange('minhas');
  }, [toast, handleTabChange]);

  return (
    <PageContainer width="wide" style={{ minWidth: 0 }}>
      <PageHeader title="Matérias" subtitle="Explore o banco de matérias ou gerencie as suas." />

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
    </PageContainer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tabs: { display: 'flex', gap: 4, marginBottom: 20, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
  tab: {
    padding: '8px 18px', borderRadius: 9, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all .15s',
  },
  tabActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
};
