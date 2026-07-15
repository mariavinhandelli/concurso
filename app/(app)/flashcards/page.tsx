'use client';
// app/(app)/flashcards/page.tsx
// Ponto de entrada da rota. Gerencia sessão ativa e alternância de abas.

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { useUI } from '@/components/layout/UIContext';
import { buildDailyQueue, buildTargetQueue, type QueueCard } from '@/services/flashcards.service';
import dynamic from 'next/dynamic';
const FlashcardEngine = dynamic(
  () => import('@/components/features/flashcards/FlashcardEngine').then(m => ({ default: m.FlashcardEngine })),
  { ssr: false },
);
import { ReviewTab } from '@/components/features/flashcards/ReviewTab';
import { CardsTab } from '@/components/features/flashcards/CardsTab';
import { BancoFlashcardsTab } from '@/components/features/flashcards/BancoFlashcardsTab';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { PageContainer, PageHeader } from '@/components/ui/Page';

type Tab = 'cards' | 'review' | 'banco';

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

  // Sessão filtrada pelas matérias de um concurso-alvo (vem do hub de Targets
  // via ?subjectIds=id1,id2,...). Fila só dessas matérias, não do usuário todo.
  const startForSubjects = useCallback(async (subjectIds: string[]) => {
    setStarting(true);
    try {
      const queue = await buildTargetQueue(subjectIds);
      setSession(queue);
      if (queue.length > 0) {
        toast.success(`Sessão com ${queue.length} card${queue.length === 1 ? '' : 's'} das matérias deste concurso.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar flashcards. Tente novamente.');
    } finally {
      setStarting(false);
    }
  }, [toast]);

  useEffect(() => {
    const subjectIdsParam = params.get('subjectIds');
    if (subjectIdsParam) {
      startForSubjects(subjectIdsParam.split(',').filter(Boolean));
    } else if (params.get('study') === 'now') {
      startDaily();
    }
  }, [params, startDaily, startForSubjects]);

  if (session) {
    return (
      <div style={styles.focusPage}>
        <div style={styles.focusContainer}>
          {session.length === 0 ? (
            <div style={styles.empty}>
              <button onClick={() => setSession(null)} style={styles.exitFocus}><X size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: -2 }} />Sair</button>
              <span style={styles.emptyIcon}><Check size={28} strokeWidth={2.2} /></span>
              <p style={styles.muted}>Nada para estudar agora. Tudo em dia!</p>
              <Button style={{ marginTop: 8, padding: '12px 28px' }} onClick={() => setSession(null)}>Voltar</Button>
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
    <PageContainer width="narrow" style={{ minWidth: 0 }}>
      <PageHeader title="Flashcards" subtitle="Crie, organize e revise seus cards." />

      <div style={styles.tabs}>
        <button className="touch-target" onClick={() => setTab('cards')}
          style={{ ...styles.tab, ...(tab === 'cards' ? styles.tabActive : {}) }}>Meus Cards</button>
        <button className="touch-target" onClick={() => setTab('review')}
          style={{ ...styles.tab, ...(tab === 'review' ? styles.tabActive : {}) }}>Revisar</button>
        <button className="touch-target" onClick={() => setTab('banco')}
          style={{ ...styles.tab, ...(tab === 'banco' ? styles.tabActive : {}) }}>Banco</button>
      </div>

      {tab === 'cards'
        ? <CardsTab onStudy={q => setSession(q)} />
        : tab === 'review'
        ? <ReviewTab key={reviewKey} onStart={startDaily} loading={starting} />
        : <BancoFlashcardsTab />}
    </PageContainer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  focusPage: { minHeight: 'calc(100vh - var(--topbar-h))', fontFamily: theme.font, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' },
  focusContainer: { width: '100%', maxWidth: 560, padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px)', position: 'relative' },
  exitFocus: { position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyIcon: { fontSize: 36, color: theme.ok, display: 'block', marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
