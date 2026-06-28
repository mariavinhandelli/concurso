// app/(app)/flashcards/page.tsx
// Flashcards: aba "Meus Cards" (gestão) e aba "Revisar" (Engine em modo foco).
'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { useSearchParams } from 'next/navigation';
import {
  listFlashcards, deleteFlashcard, countFlashcardsBySubject,
  buildDailyQueue, buildTopicQueue, type Flashcard, type QueueCard,
} from '@/services/flashcards.service';
import { listSubjectOptions, listTopicOptions, type PickerOption } from '@/services/picker.service';
import { CardForm } from '@/components/features/flashcards/CardForm';
import { FlashcardEngine } from '@/components/features/flashcards/FlashcardEngine';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Tab = 'cards' | 'review';
type Level = 'subjects' | 'topics' | 'cards';

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
  const [tab, setTab] = useState<Tab>('cards');
  const [session, setSession] = useState<QueueCard[] | null>(null);
  const [reviewKey, setReviewKey] = useState(0);

  const startDaily = useCallback(async () => {
    const queue = await buildDailyQueue();
    setSession(queue);
  }, []);

  useEffect(() => {
    if (params.get('study') === 'now') startDaily();
  }, [params, startDaily]);

  // MODO FOCO: ocupa a tela, sem navegação.
  if (session) {
    return (
      <div style={styles.focusPage}>
        <div style={styles.focusContainer}>
          <button onClick={() => setSession(null)} style={styles.exitFocus}>✕ Sair</button>
          {session.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}>✓</span>
              <p style={styles.muted}>Nada para estudar agora. Tudo em dia!</p>
              <button onClick={() => setSession(null)} style={styles.finishBtn}>Voltar</button>
            </div>
          ) : (
            <FlashcardEngine queue={session} onFinish={() => { setSession(null); setTab('review'); setReviewKey((k) => k + 1); }} />
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
        ? <CardsTab onStudy={(q) => setSession(q)} />
        : <ReviewTab key={reviewKey} onStart={startDaily} />}
    </div>
  );
}

// ---------- ABA REVISAR ----------
function ReviewTab({ onStart }: { onStart: () => void }) {
  const [counts, setCounts] = useState<{ pending: number; news: number } | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    buildDailyQueue()
      .then((q) => {
        setCounts({
          pending: q.filter((c) => !c.isNew).length,
          news: q.filter((c) => c.isNew).length,
        });
      })
      .catch(() => {
        setHasError(true);
        setCounts({ pending: 0, news: 0 });
      });
  }, []);

  const total = counts ? counts.pending + counts.news : 0;

  return (
    <div style={styles.reviewStart}>
      {counts === null ? (
        <p style={styles.muted}>Carregando…</p>
      ) : hasError ? (
        <div style={styles.empty}>
          <p style={{ ...styles.muted, color: theme.danger }}>Erro ao carregar flashcards. Recarregue a página.</p>
        </div>
      ) : total === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>✓</span>
          <p style={styles.muted}>Nenhum flashcard para revisar hoje!</p>
        </div>
      ) : (
        <>
          <div style={styles.startCounts}>
            <div style={styles.startCount}>
              <span style={styles.startNum}>{counts.pending}</span>
              <span style={styles.startLabel}>revisões</span>
            </div>
            <div style={styles.startDivider} />
            <div style={styles.startCount}>
              <span style={{ ...styles.startNum, color: theme.teal }}>{counts.news}</span>
              <span style={styles.startLabel}>novos</span>
            </div>
          </div>
          <button onClick={onStart} style={styles.startBtn}>Iniciar sessão de estudo</button>
        </>
      )}
    </div>
  );
}

// ---------- ABA MEUS CARDS ----------
function CardsTab({ onStudy }: { onStudy: (queue: QueueCard[]) => void }) {
  const [level, setLevel] = useState<Level>('subjects');
  const [subjects, setSubjects] = useState<PickerOption[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [curSubject, setCurSubject] = useState<PickerOption | null>(null);
  const [curTopic, setCurTopic] = useState<PickerOption | null | 'none'>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      listSubjectOptions().then(setSubjects),
      countFlashcardsBySubject().then(setCounts),
    ]).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar matérias. Recarregue a página.';
      setLoadError(msg);
      toast.error(msg);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCards = useCallback(async (subjectId: string, topicId: string | null) => {
    try {
      setCards(await listFlashcards({ subjectId, topicId }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar os cards. Tente novamente.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openSubject(s: PickerOption) {
    setCurSubject(s);
    listTopicOptions(s.id).then(setTopics).catch((e) =>
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos.')
    );
    setLevel('topics');
  }
  function openTopic(t: PickerOption | 'none') {
    setCurTopic(t);
    loadCards(curSubject!.id, t === 'none' ? null : t.id);
    setLevel('cards');
  }
  function reloadCards() {
    if (curSubject) loadCards(curSubject.id, curTopic === 'none' ? null : (curTopic?.id ?? null));
    countFlashcardsBySubject().then(setCounts).catch(() => {});
  }
  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Apagar este card?', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteFlashcard(id);
      toast.success('Card apagado.');
      reloadCards();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar o card. Tente novamente.');
    }
  }

  async function studySubject(s: PickerOption) {
    const q = await buildTopicQueue({ subjectId: s.id });
    onStudy(q);
  }
  async function studyTopic() {
    if (!curSubject) return;
    const topicId = curTopic === 'none' ? null : (curTopic?.id ?? null);
    const q = await buildTopicQueue({ subjectId: curSubject.id, topicId });
    onStudy(q);
  }

  const presetSubjectId = curSubject?.id ?? null;
  const presetTopicId = curTopic === 'none' ? null : (curTopic?.id ?? null);

  return (
    <>
    {dialog}
    <div>
      {loadError && (
        <p role="alert" style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{loadError}</p>
      )}
      {level === 'subjects' && (
        <div style={styles.list}>
          <p style={styles.crumb}>Escolha a matéria</p>
          {subjects.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.muted}>Nenhuma matéria cadastrada ainda.</p>
              <a href="/subjects" style={styles.emptyAction}>Adicionar matéria →</a>
            </div>
          )}
          {subjects.map((s) => (
            <div key={s.id} style={styles.navItem}>
              <span onClick={() => openSubject(s)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>{s.name}</span>
              {counts[s.id] ? <span style={styles.count}>{counts[s.id]}</span> : null}
              {counts[s.id] ? (
                <button onClick={() => studySubject(s)} style={styles.studyBtn}>Estudar</button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {level === 'topics' && curSubject && (
        <div style={styles.list}>
          <button onClick={() => setLevel('subjects')} style={styles.back}>← Matérias</button>
          <p style={styles.crumb}>{curSubject.name}</p>
          {topics.map((t) => (
            <div key={t.id} onClick={() => openTopic(t)} style={styles.navItem}><span>{t.name}</span></div>
          ))}
          <div onClick={() => openTopic('none')} style={{ ...styles.navItem, fontStyle: 'italic', color: theme.inkFaint }}>
            <span>Sem tópico específico</span>
          </div>
        </div>
      )}

      {level === 'cards' && curSubject && (
        <div style={styles.list}>
          <button onClick={() => setLevel('topics')} style={styles.back}>← Tópicos</button>
          <div style={styles.cardsHeader}>
            <p style={styles.crumb}>{curTopic === 'none' ? 'Sem tópico' : (curTopic as PickerOption)?.name}</p>
            {cards.length > 0 && <button onClick={studyTopic} style={styles.studyTopicBtn}>▶ Estudar tópico</button>}
          </div>

          {creating ? (
            <CardForm subjectId={presetSubjectId} topicId={presetTopicId}
              onCreated={() => { setCreating(false); toast.success('Card criado!'); reloadCards(); }}
              onCancel={() => setCreating(false)} />
          ) : (
            <button onClick={() => setCreating(true)} style={styles.newBtn}>+ Criar card</button>
          )}

          {cards.length === 0 ? (
            <p style={styles.muted}>Nenhum card aqui ainda.</p>
          ) : cards.map((c) => (
            <div key={c.id} style={styles.cardItem}>
              <div style={styles.cardFront}>{c.front}</div>
              <div style={styles.cardBack}>{c.back}</div>
              <button onClick={() => handleDelete(c.id)} style={styles.delBtn} aria-label="Apagar card">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 680, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 22 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },

  focusPage: { minHeight: 'calc(100vh - 60px)', fontFamily: theme.font, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' },
  focusContainer: { width: '100%', maxWidth: 560, padding: '40px 24px', position: 'relative' },
  exitFocus: { position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },

  tabs: { display: 'flex', gap: 4, marginBottom: 24, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: 12, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },

  crumb: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, margin: '4px 0', textTransform: 'uppercase', letterSpacing: 0.6 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' },
  newBtn: { padding: '11px 0', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 4, fontFamily: 'inherit' },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '13px 15px', cursor: 'pointer', fontSize: 14, color: theme.ink, fontWeight: 500, minWidth: 0 },
  count: { fontSize: 11, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, flexShrink: 0 },
  studyBtn: { padding: '5px 13px', borderRadius: 8, border: 'none', background: theme.tealBg, color: theme.tealDeep, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  cardsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  studyTopicBtn: { padding: '7px 15px', borderRadius: 10, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  cardItem: { position: 'relative', background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '13px 15px' },
  cardFront: { fontSize: 14, color: theme.ink, fontWeight: 600, paddingRight: 20 },
  cardBack: { fontSize: 13, color: theme.inkSoft, marginTop: 4 },
  delBtn: { position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', opacity: 0.6 },
  emptyState: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  emptyAction: { fontSize: 13.5, color: theme.teal, fontWeight: 600, textDecoration: 'none' },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyIcon: { fontSize: 36, color: theme.ok, display: 'block', marginBottom: 12 },
  finishBtn: { marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reviewStart: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '40px 0' },
  startCounts: { display: 'flex', gap: 28, alignItems: 'center' },
  startCount: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  startDivider: { width: 1, height: 40, background: theme.line },
  startNum: { fontSize: 40, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' },
  startLabel: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  startBtn: { padding: '13px 30px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};