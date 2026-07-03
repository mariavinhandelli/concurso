'use client';
// app/(app)/flashcards/page.tsx
// Ponto de entrada da rota. Gerencia sessão ativa e alternância de abas.

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { useUI } from '@/components/layout/UIContext';
import { buildDailyQueue, type QueueCard } from '@/services/flashcards.service';
import dynamic from 'next/dynamic';
const FlashcardEngine = dynamic(
  () => import('@/components/features/flashcards/FlashcardEngine').then(m => ({ default: m.FlashcardEngine })),
  { ssr: false },
);
import { ReviewTab } from '@/components/features/flashcards/ReviewTab';
import { CardsTab } from '@/components/features/flashcards/CardsTab';
import { theme } from '@/lib/theme';

type Tab = 'cards' | 'review';

export default function FlashcardsPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardsContent />
    </Suspense>
  );
}

function FlashcardsContent() {
  const params = useSearchParams();
  const { isMobile } = useUI();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('review');
  const [session, setSession] = useState<QueueCard[] | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [starting, setStarting] = useState(false);

  const startDaily = useCallback(async () => {
    setStarting(true);
    try {
      setSession(await buildDailyQueue());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar flashcards. Tente novamente.');
    } finally {
      setStarting(false);
    }
  }, [toast]);

  useEffect(() => {
    if (params.get('study') === 'now') startDaily();
  }, [params, startDaily]);

  if (session) {
    return (
      <div style={styles.focusPage}>
        <div style={styles.focusContainer}>
          {session.length === 0 ? (
            <div style={styles.empty}>
              <button onClick={() => setSession(null)} style={styles.exitFocus}>✕ Sair</button>
              <span style={styles.emptyIcon}>✓</span>
              <p style={styles.muted}>Nada para estudar agora. Tudo em dia!</p>
              <button onClick={() => setSession(null)} style={styles.finishBtn}>Voltar</button>
            </div>
          ) : (
            <FlashcardEngine
              queue={session}
              onExit={() => setSession(null)}
              onFinish={() => { setSession(null); setTab('review'); setReviewKey(k => k + 1); }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Flashcards</h1>
        <p style={styles.sub}>Crie, organize e revise seus cards.</p>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setTab('cards')}
          style={{ ...styles.tab, ...(tab === 'cards' ? styles.tabActive : {}) }}>Meus Cards</button>
        <button onClick={() => setTab('review')}
          style={{ ...styles.tab, ...(tab === 'review' ? styles.tabActive : {}) }}>Revisar</button>
      </div>

      {tab === 'cards'
        ? <CardsTab onStudy={q => setSession(q)} />
        : <ReviewTab key={reviewKey} onStart={startDaily} loading={starting} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 680, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 22 },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  focusPage: { minHeight: 'calc(100vh - 60px)', fontFamily: theme.font, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' },
  focusContainer: { width: '100%', maxWidth: 560, padding: '40px 24px', position: 'relative' },
  exitFocus: { position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: 12, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyIcon: { fontSize: 36, color: theme.ok, display: 'block', marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
