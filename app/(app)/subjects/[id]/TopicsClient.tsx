'use client';

import dynamic from 'next/dynamic';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/hooks/useConfirm';
import { useUI } from '@/components/layout/UIContext';
import { useTopics } from '@/hooks/useTopics';
import { TopicLeafRow } from '@/components/features/subjects/TopicLeafRow';
import { TopicFolderRow } from '@/components/features/subjects/TopicFolderRow';
import { TopicNotesPopover } from '@/components/features/subjects/TopicNotesPopover';
import { pushRecent } from '@/lib/recents';
import { theme } from '@/lib/theme';
import type { Subject } from '@/services/subjects.service';
import type { Topic } from '@/services/topics.service';
import { Button } from '@/components/ui/Button';
import { listEditalPresence, type EditalPresence } from '@/services/targetTopics.service';

const BulkImportModal = dynamic(
  () => import('@/components/features/topics/BulkImportModal').then((m) => ({ default: m.BulkImportModal })),
  { ssr: false },
);

interface Props {
  subjectId: string;
  initialSubject: Subject;
}

function TopicsSkeleton() {
  const heights = [52, 52, 96, 52, 52, 52, 96, 52, 52];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            height: h, borderRadius: 12,
            background: theme.muted,
            animation: 'skeleton-pulse 1.4s ease infinite',
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function TopicsClient({ subjectId, initialSubject }: Props) {
  const router = useRouter();
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();

  // M12: registra a matéria nos "recentes" (client-side).
  useEffect(() => {
    pushRecent({ kind: 'subject', id: subjectId, label: initialSubject.name, href: `/subjects/${subjectId}` });
  }, [subjectId, initialSubject.name]);

  const {
    topics, saudeMap, noteCountMap, refreshNoteCounts, loading, error,
    parents, childrenOf,
    totalLeaf, doneLeaf,
    handleCreate, handleCreateBulk, handleToggle, handleToggleReview,
    handleDelete, handleUpdate,
  } = useTopics(subjectId, initialSubject);

  const [notasTopic, setNotasTopic] = useState<Topic | null>(null);

  // Integração Targets → Subjects: em quais editais esta matéria aparece.
  // Busca única após o load (ref evita refetch a cada toggle de tópico).
  const [presence, setPresence] = useState<EditalPresence[]>([]);
  const presenceFetched = useRef(false);
  useEffect(() => {
    if (loading || presenceFetched.current || topics.length === 0) return;
    presenceFetched.current = true;
    listEditalPresence(topics.map((t) => t.id)).then(setPresence).catch(() => {});
  }, [loading, topics]);

  // Barra de progresso: inicia em 0 e anima para o valor real após loading.
  const pct = totalLeaf === 0 ? 0 : Math.round((doneLeaf / totalLeaf) * 100);
  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    if (loading) { setDisplayPct(0); return; }
    const t = setTimeout(() => setDisplayPct(pct), 50);
    return () => clearTimeout(t);
  }, [loading, pct]);

  // Filtro de tópicos
  const [filter, setFilter] = useState('');
  const filteredParents = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      return (childrenOf.get(p.id) ?? []).some((k) => k.name.toLowerCase().includes(q));
    });
  }, [parents, childrenOf, filter]);

  // Estado de collapse persistido por matéria
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(`collapsed_${subjectId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(`collapsed_${subjectId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [subjectId]);

  // Virtualização com window scroll
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (!loading && listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, [loading]);

  const rowVirtualizer = useWindowVirtualizer({
    count: loading ? 0 : filteredParents.length,
    estimateSize: () => 68,
    overscan: 5,
    scrollMargin,
  });

  const [newName, setNewName] = useState('');
  const [bulkParent, setBulkParent] = useState<string | null | undefined>(undefined);
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleStartEdit = useCallback((t: Topic) => { setEditingId(t.id); setEditText(t.name); }, []);
  const handleCancelEdit = useCallback(() => { setEditingId(null); setEditText(''); }, []);
  const handleCommitEdit = useCallback(async (id: string, text: string) => {
    const nome = text.trim();
    setEditingId(null); setEditText('');
    if (nome) await handleUpdate(id, nome);
  }, [handleUpdate]);

  const handleStudy = useCallback((id: string) => {
    router.push(`/?topicId=${id}&subjectId=${subjectId}`);
  }, [router, subjectId]);

  const handleViewNotes = useCallback((topic: Topic) => { setNotasTopic(topic); }, []);

  const handleDeleteLeaf = useCallback(async (id: string) => {
    if (!await confirm({ title: 'Apagar este tópico?', confirmLabel: 'Apagar', danger: true })) return;
    await handleDelete(id);
  }, [confirm, handleDelete]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    const count = (childrenOf.get(id) ?? []).length;
    const desc = count > 0 ? `${count} subtópico${count > 1 ? 's' : ''} também serão apagados.` : undefined;
    if (!await confirm({
      title: 'Apagar esta pasta?',
      description: desc,
      confirmLabel: 'Apagar tudo',
      danger: true,
    })) return;
    await handleDelete(id);
  }, [confirm, handleDelete, childrenOf]);

  const handleStartAddChild = useCallback((parentId: string) => { setAddingChildOf(parentId); setChildName(''); }, []);
  const handleCommitAddChild = useCallback(async (parentId: string, name: string) => {
    setAddingChildOf(null); setChildName('');
    if (name.trim()) await handleCreate(name, parentId);
  }, [handleCreate]);
  const handleCancelAddChild = useCallback(() => { setAddingChildOf(null); setChildName(''); }, []);

  const handleCreateLoose = useCallback(() => {
    if (!newName.trim()) return;
    handleCreate(newName);
    setNewName('');
  }, [newName, handleCreate]);

  return (
    <>
      {dialog}
      <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>

        {/* Breadcrumb */}
        <nav style={styles.breadcrumb} aria-label="Navegação">
          <button onClick={() => router.push('/subjects')} style={styles.breadcrumbLink}>
            Matérias
          </button>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
          <span style={styles.breadcrumbCurrent}>{initialSubject.name}</span>
        </nav>

        <div style={styles.header}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>{initialSubject.name}</h1>
          <p style={styles.sub}>Pastas organizam; o estudo e a revisão acontecem nos subtópicos.</p>
        </div>

        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>Progresso</span>
            <span style={styles.progressPct}>
              <b style={{ color: theme.ink, fontWeight: 700 }}>{pct}%</b>
              <span style={styles.progressFrac}>{doneLeaf}/{totalLeaf}</span>
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${displayPct}%` }} />
          </div>
          {presence.length > 0 && (
            <div style={styles.presenceRow}>
              <span style={styles.presenceLabel}>Nos editais:</span>
              {presence.map((p) => (
                <button
                  key={p.targetId}
                  onClick={() => router.push(`/targets/${p.targetId}`)}
                  style={styles.presenceChip}
                  title={`${p.count} tópico${p.count === 1 ? '' : 's'} desta matéria neste edital`}
                >
                  {p.label} <span style={styles.presenceCount}>{p.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...styles.createRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateLoose()}
            placeholder="Novo tópico (ex: Controle de Constitucionalidade)"
            style={{ ...styles.input, flexBasis: isMobile ? '100%' : undefined }}
          />
          <Button onClick={handleCreateLoose} style={{ flex: isMobile ? 1 : undefined }}>
            Adicionar
          </Button>
          <Button
            variant="outline"
            style={{ flex: isMobile ? 1 : undefined, borderColor: theme.teal, color: theme.teal }}
            onClick={() => setBulkParent(null)}
            title="Cole o conteúdo programático do edital — um tópico por linha"
          >
            Importar lista
          </Button>
        </div>

        {bulkParent !== undefined && (
          <BulkImportModal
            onClose={() => setBulkParent(undefined)}
            onConfirm={async (nomes) => { await handleCreateBulk(nomes, bulkParent ?? null); setBulkParent(undefined); }}
          />
        )}

        {error && <p style={styles.error}>{error}</p>}

        {/* Filtro — visível quando há tópicos */}
        {!loading && topics.length > 0 && (
          <div style={styles.filterRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar tópicos…"
              style={styles.filterInput}
              aria-label="Filtrar tópicos"
            />
            {filter && (
              <button onClick={() => setFilter('')} style={styles.filterClear} aria-label="Limpar filtro">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        )}

        {loading ? (
          <TopicsSkeleton />
        ) : topics.length === 0 ? (
          <div style={styles.emptyState}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <p style={styles.emptyTitle}>Nenhum tópico ainda</p>
            <p style={styles.emptyHint}>
              Dica: use <b>Importar lista</b> para colar o conteúdo programático do edital de uma só vez.
            </p>
          </div>
        ) : filteredParents.length === 0 ? (
          <p style={styles.muted}>Nenhum tópico corresponde ao filtro.</p>
        ) : (
          <div ref={listRef} style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filteredParents[virtualRow.index];
              const kids = childrenOf.get(p.id) ?? [];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)`, paddingBottom: 8 }}
                >
                  {kids.length > 0 ? (
                    <TopicFolderRow
                      topic={p}
                      kids={kids}
                      saudeMap={saudeMap}
                      noteCountMap={noteCountMap}
                      isCollapsed={collapsed.has(p.id)}
                      editingId={editingId}
                      editText={editText}
                      isAddingChild={addingChildOf === p.id}
                      childName={childName}
                      isMobile={isMobile}
                      onToggleCollapse={handleToggleCollapse}
                      onStartEdit={handleStartEdit}
                      onCommitEdit={handleCommitEdit}
                      onCancelEdit={handleCancelEdit}
                      onEditTextChange={setEditText}
                      onDeleteFolder={handleDeleteFolder}
                      onDeleteLeaf={handleDeleteLeaf}
                      onToggle={handleToggle}
                      onToggleReview={handleToggleReview}
                      onStartAddChild={handleStartAddChild}
                      onCommitAddChild={handleCommitAddChild}
                      onCancelAddChild={handleCancelAddChild}
                      onChildNameChange={setChildName}
                      onStudy={handleStudy}
                      onViewNotes={handleViewNotes}
                    />
                  ) : (
                    <TopicLeafRow
                      topic={p}
                      saudeValue={saudeMap[p.id]}
                      noteCount={noteCountMap[p.id]}
                      isEditing={editingId === p.id}
                      editText={editingId === p.id ? editText : ''}
                      indented={false}
                      isMobile={isMobile}
                      onToggle={handleToggle}
                      onToggleReview={handleToggleReview}
                      onStartEdit={handleStartEdit}
                      onCommitEdit={handleCommitEdit}
                      onCancelEdit={handleCancelEdit}
                      onEditTextChange={setEditText}
                      onDelete={handleDeleteLeaf}
                      onStudy={handleStudy}
                      onViewNotes={handleViewNotes}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {notasTopic && (
        <TopicNotesPopover
          topic={notasTopic}
          subjectId={subjectId}
          onClose={() => setNotasTopic(null)}
          onChanged={refreshNoteCounts}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 960, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },

  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 },
  breadcrumbLink: {
    border: 'none', background: 'transparent', color: theme.teal,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
  },
  breadcrumbCurrent: {
    fontSize: 13, color: theme.inkSoft, fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
  },

  header: { marginBottom: 24 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '5px 0 0', fontWeight: 500 },

  progressCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 22 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  progressLabel: { fontSize: 13, color: theme.inkSoft, fontWeight: 600 },
  progressPct: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15 },
  progressFrac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  progressTrack: { height: 8, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: theme.ok, borderRadius: 999, transition: 'width 0.6s cubic-bezier(.2,.7,.3,1)' },
  presenceRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  presenceLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500, flexShrink: 0 },
  presenceChip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  presenceCount: { fontSize: 11, fontWeight: 700, color: theme.teal },

  createRow: { display: 'flex', gap: 10, marginBottom: 14 },
  input: { flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  bulkBtn: { padding: '11px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },

  filterRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card },
  filterInput: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: theme.ink, fontFamily: 'inherit' },
  filterClear: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, flexShrink: 0 },

  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14, marginTop: 8 },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 15, color: theme.inkSoft, fontWeight: 600, margin: 0 },
  emptyHint: { fontSize: 13.5, color: theme.inkFaint, margin: 0, maxWidth: 360, lineHeight: 1.6 },
};
