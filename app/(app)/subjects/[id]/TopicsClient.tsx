'use client';

import dynamic from 'next/dynamic';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, FilePlus, ChevronDown, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateAfter } from '@/lib/cache-invalidation';
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
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/Page';
import { BackLink } from '@/components/ui/BackLink';
import { getSubjectEditalLinks, linkTopicsBulk, type EditalPresence } from '@/services/targetTopics.service';

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
            height: h, borderRadius: theme.radiusSm,
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

  // Integração Targets → Subjects: em quais editais esta matéria aparece e
  // QUAIS tópicos estão vinculados a algum concurso ativo — alimenta os chips
  // e o agrupamento "fora dos seus editais".
  // Busca única após o load (ref evita refetch a cada toggle de tópico).
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState<EditalPresence[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const presenceFetched = useRef(false);
  const refreshEditalLinks = useCallback(async () => {
    const res = await getSubjectEditalLinks(topics.map((t) => t.id));
    setPresence(res.presence);
    setLinkedIds(new Set(res.linkedTopicIds));
  }, [topics]);
  useEffect(() => {
    if (loading || presenceFetched.current || topics.length === 0) return;
    presenceFetched.current = true;
    refreshEditalLinks().catch(() => {});
  }, [loading, topics, refreshEditalLinks]);

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

  // ── Agrupamento "fora dos seus editais" ──
  // Só quando a matéria participa de algum concurso ativo E não há busca em
  // curso (com filtro ativo a lista volta a mostrar tudo — senão a busca
  // "esconderia" tópicos que estão no grupo de baixo).
  const agrupar = presence.length > 0 && filter.trim() === '';

  interface ForaItem {
    topic: Topic;
    parentName?: string;   // filho de pasta mista: mostra o contexto
    leafIds: string[];     // o que o "Ativar" vincula (só folhas, regra do sistema)
    isFolder: boolean;
    kidsCount: number;
  }

  const { mainParents, kidsVisiveis, foraItems, foraLeafCount } = useMemo(() => {
    if (!agrupar) {
      return { mainParents: filteredParents, kidsVisiveis: null as Map<string, Topic[]> | null, foraItems: [] as ForaItem[], foraLeafCount: 0 };
    }
    const dentro: Topic[] = [];
    const fora: ForaItem[] = [];
    const kidsMap = new Map<string, Topic[]>();
    for (const p of filteredParents) {
      const kids = childrenOf.get(p.id) ?? [];
      // Pasta é julgada pelos FILHOS: vínculo legado no registro-pai (alvos
      // antigos vinculavam pastas) não pode fazer a pasta ficar "dentro" com
      // zero filhos visíveis — ela renderizaria como folha.
      const linkedDeep = kids.length > 0 ? kids.some((k) => linkedIds.has(k.id)) : linkedIds.has(p.id);
      if (!linkedDeep) {
        fora.push({
          topic: p,
          leafIds: kids.length > 0 ? kids.map((k) => k.id) : [p.id],
          isFolder: kids.length > 0,
          kidsCount: kids.length,
        });
        continue;
      }
      dentro.push(p);
      kidsMap.set(p.id, kids.filter((k) => linkedIds.has(k.id)));
      // Filhos de pasta mista que não caem descem para o grupo, com contexto.
      for (const k of kids) {
        if (!linkedIds.has(k.id)) {
          fora.push({ topic: k, parentName: p.name, leafIds: [k.id], isFolder: false, kidsCount: 0 });
        }
      }
    }
    const leafCount = fora.reduce((acc, f) => acc + (f.isFolder ? f.kidsCount : 1), 0);
    return { mainParents: dentro, kidsVisiveis: kidsMap, foraItems: fora, foraLeafCount: leafCount };
  }, [agrupar, filteredParents, childrenOf, linkedIds]);

  const [mostrarFora, setMostrarFora] = useState(false);
  const [ativandoId, setAtivandoId] = useState<string | null>(null);
  const [foraError, setForaError] = useState<string | null>(null);
  const handleAtivar = useCallback(async (item: ForaItem) => {
    if (ativandoId) return;
    setAtivandoId(item.topic.id);
    setForaError(null);
    try {
      // Vincula às provas ativas em que esta matéria participa (os chips acima).
      for (const t of presence) await linkTopicsBulk(item.leafIds, t.targetId);
      invalidateAfter(queryClient, 'edital');
      await refreshEditalLinks();
    } catch {
      setForaError('Não foi possível ativar agora — tente de novo em instantes.');
    } finally {
      setAtivandoId(null);
    }
  }, [ativandoId, presence, queryClient, refreshEditalLinks]);

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
  // Remedir, não medir uma vez só: o que vem ANTES da lista muda de altura
  // depois do primeiro paint — os chips "Nos editais" chegam por fetch, o campo
  // de filtro só aparece quando há tópicos, e o título quebra em mais linhas
  // conforme a largura. Com a medida congelada, o scrollMargin ficava menor que
  // o offset real e a lista aparecia deslocada (visível no tablet, onde o
  // cabeçalho é mais alto).
  useEffect(() => {
    // Lê listRef.current DENTRO de measure (não capturado no escopo do efeito):
    // a div só existe quando filteredParents.length > 0, então filtrar pra um
    // resultado vazio e depois limpar o filtro desmonta e remonta um nó NOVO.
    // Um `el` fechado no momento em que o efeito rodou ficava apontando pro nó
    // antigo e desconectado — offsetTop de um nó fora do DOM é sempre 0, e
    // o próximo resize zerava scrollMargin de volta, reabrindo o bug original.
    const measure = () => {
      const el = listRef.current;
      if (!el) return;
      setScrollMargin((prev) => (prev === el.offsetTop ? prev : el.offsetTop));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [loading, filteredParents.length === 0]);

  const rowVirtualizer = useWindowVirtualizer({
    count: loading ? 0 : mainParents.length,
    estimateSize: () => 68,
    overscan: 5,
    scrollMargin,
  });

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  // Ref além do estado: cliques no mesmo tick veem o state antigo (setState é
  // assíncrono) — só o ref bloqueia reentrada de forma síncrona.
  const creatingRef = useRef(false);
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
    const desc = count > 0
      ? (count === 1 ? '1 subtópico também será apagado.' : `${count} subtópicos também serão apagados.`)
      : undefined;
    if (!await confirm({
      title: 'Apagar esta pasta?',
      description: desc,
      confirmLabel: 'Apagar tudo',
      danger: true,
    })) return;
    await handleDelete(id);
  }, [confirm, handleDelete, childrenOf]);

  const handleStartAddChild = useCallback((parentId: string) => { setAddingChildOf(parentId); setChildName(''); }, []);
  // Ref de reentrada: dois Enter no mesmo tick chegam antes do re-render que
  // desmonta o input — sem o guard, o subtópico era criado duas vezes.
  const committingChildRef = useRef(false);
  const handleCommitAddChild = useCallback(async (parentId: string, name: string) => {
    if (committingChildRef.current) return;
    committingChildRef.current = true;
    setAddingChildOf(null); setChildName('');
    try {
      if (name.trim()) await handleCreate(name, parentId);
    } finally {
      committingChildRef.current = false;
    }
  }, [handleCreate]);
  const handleCancelAddChild = useCallback(() => { setAddingChildOf(null); setChildName(''); }, []);

  const handleCreateLoose = useCallback(async () => {
    // Guard de reentrada: duplo clique/Enter repetido criava o tópico duas vezes.
    if (!newName.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      await handleCreate(newName);
      setNewName('');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [newName, handleCreate]);

  return (
    <>
      {dialog}
      <PageContainer width="default">

        <BackLink href="/subjects">Matérias</BackLink>

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
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateLoose()}
            placeholder="Novo tópico (ex: Controle de Constitucionalidade)"
            style={{ flexBasis: isMobile ? '100%' : undefined, flexGrow: 1 }}
          />
          <Button onClick={handleCreateLoose} disabled={creating} style={{ flex: isMobile ? 1 : undefined }}>
            {creating ? 'Adicionando…' : 'Adicionar'}
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
            <Search size={14} color={theme.inkFaint} strokeWidth={2} aria-hidden="true" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar tópicos…"
              style={styles.filterInput}
              aria-label="Filtrar tópicos"
            />
            {filter && (
              <button onClick={() => setFilter('')} style={styles.filterClear} aria-label="Limpar filtro">
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <TopicsSkeleton />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={<FilePlus size={26} color={theme.teal} strokeWidth={1.8} />}
            title="Nenhum tópico ainda"
            body="Cole o conteúdo programático do edital de uma só vez, um tópico por linha."
            action={{ label: 'Importar lista', onClick: () => setBulkParent(null) }}
          />
        ) : filteredParents.length === 0 ? (
          <p style={styles.muted}>Nenhum tópico corresponde ao filtro.</p>
        ) : (
          <div ref={listRef} style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = mainParents[virtualRow.index];
              const kids = (kidsVisiveis ? kidsVisiveis.get(p.id) : null) ?? childrenOf.get(p.id) ?? [];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  // `start` é medido a partir do topo do DOCUMENTO (o scroller é
                  // a janela), mas o container já está posicionado em offsetTop.
                  // Sem descontar o scrollMargin o deslocamento entra duas vezes
                  // e a lista nasce ~1 tela abaixo de onde deveria.
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`, paddingBottom: 8 }}
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

        {/* ── Fora dos seus editais ──
            O acervo recebe a matéria INTEIRA do catálogo (ela serve a vários
            concursos), mas só os tópicos vinculados caem nas suas provas. O
            resto fica agrupado aqui embaixo, fechado — visível sob demanda,
            ativável se o aluno quiser estudar mesmo assim. */}
        {!loading && agrupar && foraItems.length > 0 && (
          <div style={styles.foraCard}>
            <button
              onClick={() => setMostrarFora((v) => !v)}
              style={styles.foraHeader}
              aria-expanded={mostrarFora}
            >
              <span style={styles.foraTitle}>Fora dos seus editais</span>
              <span style={styles.foraBadge}>{foraLeafCount} tópico{foraLeafCount === 1 ? '' : 's'}</span>
              <ChevronDown
                size={15}
                strokeWidth={2}
                style={{ marginLeft: 'auto', flexShrink: 0, transform: mostrarFora ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
              />
            </button>
            {mostrarFora && (
              <>
                <p style={styles.foraHint}>
                  Estes tópicos existem no catálogo da matéria, mas não caem em nenhuma das suas provas
                  ativas — não entram no progresso do edital nem no plano. Ative um tópico se quiser
                  estudá-lo mesmo assim.
                </p>
                {foraError && <p style={styles.error}>{foraError}</p>}
                <div style={styles.foraList}>
                  {foraItems.map((item) => (
                    <div key={item.topic.id} style={styles.foraRow}>
                      <div style={styles.foraInfo}>
                        <span style={styles.foraName}>{item.topic.name}</span>
                        {item.parentName && <span style={styles.foraContext}>em {item.parentName}</span>}
                        {item.isFolder && (
                          <span style={styles.foraContext}>
                            pasta · {item.kidsCount} subtópico{item.kidsCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <div style={styles.foraActions}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAtivar(item)}
                          disabled={ativandoId != null}
                          title="Vincular às suas provas ativas — passa a contar no progresso do edital"
                        >
                          {ativandoId === item.topic.id ? 'Ativando…' : 'Ativar'}
                        </Button>
                        <button
                          onClick={() => (item.isFolder ? handleDeleteFolder(item.topic.id) : handleDeleteLeaf(item.topic.id))}
                          style={styles.foraDelete}
                          aria-label={`Apagar ${item.topic.name}`}
                          title="Apagar do acervo"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </PageContainer>

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

  header: { marginBottom: 24 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '5px 0 0', fontWeight: 500 },

  progressCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 22 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  progressLabel: { fontSize: 13, color: theme.inkSoft, fontWeight: 600 },
  progressPct: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15 },
  progressFrac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  progressTrack: { height: 8, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  progressFill: { height: '100%', background: theme.ok, borderRadius: theme.radiusPill, transition: 'width 0.6s cubic-bezier(.2,.7,.3,1)' },
  presenceRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  presenceLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500, flexShrink: 0 },
  presenceChip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: theme.radiusPill, border: `1px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  presenceCount: { fontSize: 11, fontWeight: 700, color: theme.teal },

  createRow: { display: 'flex', gap: 10, marginBottom: 14 },

  filterRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card },
  filterInput: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: theme.ink, fontFamily: 'inherit' },
  filterClear: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, flexShrink: 0 },

  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14, marginTop: 8 },

  foraCard: { marginTop: 16, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, background: theme.card, overflow: 'hidden' },
  foraHeader: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: theme.inkSoft, textAlign: 'left' },
  foraTitle: { fontSize: 13, fontWeight: 600 },
  foraBadge: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, background: theme.muted, borderRadius: theme.radiusPill, padding: '2px 8px', flexShrink: 0 },
  foraHint: { fontSize: 12, color: theme.inkFaint, lineHeight: 1.55, margin: 0, padding: '0 14px 10px' },
  foraList: { display: 'flex', flexDirection: 'column' },
  foraRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 14px', borderTop: `0.5px solid ${theme.line}`, opacity: 0.75 },
  foraInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  foraName: { fontSize: 13, fontWeight: 500, color: theme.inkSoft, overflowWrap: 'anywhere' },
  foraContext: { fontSize: 11, color: theme.inkFaint },
  foraActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  foraDelete: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'grid', placeItems: 'center' },
};
