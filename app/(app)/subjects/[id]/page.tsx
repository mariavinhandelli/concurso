// app/(app)/subjects/[id]/page.tsx
// Tópicos de uma matéria em HIERARQUIA pai/filho.
//   • Pai-pasta (parent_id null COM filhos): colapsável, barra de progresso
//     dos filhos, botão "+ subtópico". Não é estudável.
//   • Folha (filho, OU pai sem filhos): checkbox "estudei", revisão SM-2,
//     estudar, editar, apagar, HealthBar. É onde toda ação acontece.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listTopics, createTopic, createTopicsBulk, updateTopic, toggleCompleted, deleteTopic, type Topic,
} from '@/services/topics.service';
import { activateReview, deactivateReview } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';
import { HealthBar } from '@/components/features/topics/HealthBar';
import { BulkImportModal } from '@/components/features/topics/BulkImportModal';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

export default function TopicsPage() {
  const params = useParams();
  const router = useRouter();
  const { isMobile } = useUI();
  const subjectId = params.id as string;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [saudeMap, setSaudeMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  // bulk import: pode ser solto (parentId null) ou dentro de um pai
  const [bulkParent, setBulkParent] = useState<string | null | undefined>(undefined); // undefined = fechado
  // colapso por pai
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // criar subtópico inline por pai
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  // editar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function load() {
    try {
      const lista = await listTopics(subjectId);
      setTopics(lista);
      const mapa = await getSaudeMap(lista.map((t) => t.id));
      setSaudeMap(mapa);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [subjectId]);

  // ---------- montagem da árvore ----------
  // pais (parent_id null) na ordem; filhos agrupados por parent_id.
  const { parents, childrenOf } = useMemo(() => {
    const parents = topics
      .filter((t) => t.parent_id === null)
      .sort((a, b) => a.position - b.position);
    const childrenOf = new Map<string, Topic[]>();
    for (const t of topics) {
      if (t.parent_id === null) continue;
      const arr = childrenOf.get(t.parent_id) ?? [];
      arr.push(t);
      childrenOf.set(t.parent_id, arr);
    }
    for (const arr of childrenOf.values()) arr.sort((a, b) => a.position - b.position);
    return { parents, childrenOf };
  }, [topics]);

  // progresso geral (só folhas: filhos + pais-sem-filhos)
  const { totalLeaf, doneLeaf } = useMemo(() => {
    let total = 0, done = 0;
    for (const t of topics) {
      const isParentFolder = t.parent_id === null && (childrenOf.get(t.id)?.length ?? 0) > 0;
      if (isParentFolder) continue;
      total++;
      if (t.is_completed) done++;
    }
    return { totalLeaf: total, doneLeaf: done };
  }, [topics, childrenOf]);
  const pct = totalLeaf === 0 ? 0 : Math.round((doneLeaf / totalLeaf) * 100);

  // ---------- ações ----------
  async function handleCreateLoose() {
    if (!newName.trim()) return;
    try {
      await createTopic(subjectId, newName, null);
      setNewName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  async function handleCreateChild(parentId: string) {
    if (!childName.trim()) { setAddingChildOf(null); setChildName(''); return; }
    try {
      await createTopic(subjectId, childName, parentId);
      setChildName('');
      setAddingChildOf(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar subtópico.');
    }
  }

  async function handleToggle(topic: Topic) {
    const novo = !topic.is_completed;
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_completed: novo } : t)));
    try { await toggleCompleted(topic.id, novo); }
    catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro ao marcar.'); }
  }

  async function handleToggleReview(topic: Topic) {
    const novo = !topic.is_review_active;
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_review_active: novo } : t)));
    try {
      if (novo) await activateReview(topic.id);
      else await deactivateReview(topic.id);
    } catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro na revisão.'); }
  }

  async function handleDelete(id: string, isParentFolder: boolean) {
    const msg = isParentFolder
      ? 'Apagar este tópico e TODOS os seus subtópicos?'
      : 'Apagar este tópico?';
    if (!confirm(msg)) return;
    try { await deleteTopic(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao apagar.'); }
  }

  function startEdit(t: Topic) { setEditingId(t.id); setEditText(t.name); }
  function cancelEdit() { setEditingId(null); setEditText(''); }
  async function commitEdit(id: string) {
    const nome = editText.trim();
    if (!nome) { cancelEdit(); return; }
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, name: nome } : t)));
    cancelEdit();
    try { await updateTopic(id, { name: nome }); }
    catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro ao editar.'); }
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---------- render de uma FOLHA (filho ou pai-sem-filhos) ----------
  function renderLeaf(t: Topic, indented: boolean) {
    return (
      <div key={t.id} style={{ ...styles.row, ...(indented ? styles.rowChild : {}), flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <button
          onClick={() => handleToggle(t)}
          style={{ ...styles.checkbox, ...(t.is_completed ? styles.checkboxOn : {}) }}
          aria-label={t.is_completed ? 'Concluído' : 'Marcar como concluído'}
        >
          {t.is_completed ? '✓' : ''}
        </button>

        {editingId === t.id ? (
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(t.id); if (e.key === 'Escape') cancelEdit(); }}
            onBlur={() => commitEdit(t.id)}
            autoFocus
            style={styles.editInput}
          />
        ) : (
          <span style={{ ...styles.topicName, ...(t.is_completed ? styles.topicNameDone : {}) }}>{t.name}</span>
        )}

        <HealthBar saude={saudeMap[t.id]} />

        <div style={{ ...styles.actions, ...(isMobile ? styles.actionsMobile : {}) }}>
          <button
            onClick={() => (editingId === t.id ? commitEdit(t.id) : startEdit(t))}
            style={{ ...styles.iconBtn, color: editingId === t.id ? theme.teal : theme.inkFaint }}
            title="Editar nome" aria-label="Editar tópico"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            onClick={() => handleToggleReview(t)}
            style={{ ...styles.iconBtn, color: t.is_review_active ? theme.teal : theme.inkFaint, background: t.is_review_active ? theme.tealBg : 'transparent' }}
            title={t.is_review_active ? 'Em revisão (clique para desativar)' : 'Ativar revisão espaçada'} aria-label="Alternar revisão"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2" /><path d="M20 4v5h-5M4 20v-5h5" />
            </svg>
          </button>
          <button
            onClick={() => router.push(`/?topicId=${t.id}&subjectId=${subjectId}`)}
            style={{ ...styles.iconBtn, color: theme.teal }}
            title="Estudar este tópico" aria-label="Estudar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button onClick={() => handleDelete(t.id, false)} style={styles.deleteBtn} aria-label="Apagar tópico">✕</button>
        </div>
      </div>
    );
  }

  // ---------- render de um PAI-PASTA ----------
  function renderParentFolder(t: Topic, kids: Topic[]) {
    const isCollapsed = collapsed.has(t.id);
    const kidsDone = kids.filter((k) => k.is_completed).length;
    const kidsPct = kids.length === 0 ? 0 : Math.round((kidsDone / kids.length) * 100);

    return (
      <div key={t.id} style={styles.folderWrap}>
        <div style={styles.folderHead}>
          <button onClick={() => toggleCollapse(t.id)} style={styles.caretBtn} aria-label={isCollapsed ? 'Expandir' : 'Recolher'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            {editingId === t.id ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(t.id); if (e.key === 'Escape') cancelEdit(); }}
                onBlur={() => commitEdit(t.id)}
                autoFocus
                style={styles.editInput}
              />
            ) : (
              <span style={styles.folderName} onClick={() => toggleCollapse(t.id)}>{t.name}</span>
            )}
            <div style={styles.folderTrack}>
              <div style={{ ...styles.folderFill, width: `${kidsPct}%` }} />
            </div>
            <div style={styles.folderMeta}>{kidsPct}% · {kidsDone}/{kids.length} subtópicos</div>
          </div>

          <div style={styles.actions}>
            <button onClick={() => (editingId === t.id ? commitEdit(t.id) : startEdit(t))} style={{ ...styles.iconBtn, color: theme.inkFaint }} title="Editar nome" aria-label="Editar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button onClick={() => handleDelete(t.id, true)} style={styles.deleteBtn} aria-label="Apagar pasta">✕</button>
          </div>
        </div>

        {!isCollapsed && (
          <div style={styles.folderBody}>
            {kids.map((k) => renderLeaf(k, true))}

            {addingChildOf === t.id ? (
              <div style={{ ...styles.row, ...styles.rowChild }}>
                <input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChild(t.id); if (e.key === 'Escape') { setAddingChildOf(null); setChildName(''); } }}
                  onBlur={() => handleCreateChild(t.id)}
                  autoFocus
                  placeholder="Nome do subtópico…"
                  style={styles.editInput}
                />
              </div>
            ) : (
              <button onClick={() => { setAddingChildOf(t.id); setChildName(''); }} style={styles.addChildBtn}>
                + subtópico
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 48px' }}>
      <button onClick={() => router.push('/subjects')} style={styles.back}>← Matérias</button>

      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Tópicos</h1>
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
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
        </div>
      </div>

      <div style={{ ...styles.createRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateLoose()}
          placeholder="Novo tópico solto (ex: Bens Públicos)"
          style={{ ...styles.input, flexBasis: isMobile ? '100%' : undefined }}
        />
        <button onClick={handleCreateLoose} style={{ ...styles.addBtn, flex: isMobile ? 1 : undefined }}>Adicionar</button>
        <button onClick={() => setBulkParent(null)} style={{ ...styles.bulkBtn, flex: isMobile ? 1 : undefined }}>Colar vários</button>
      </div>

      {bulkParent !== undefined && (
        <BulkImportModal
          onClose={() => setBulkParent(undefined)}
          onConfirm={async (nomes) => {
            await createTopicsBulk(subjectId, nomes, bulkParent ?? null);
            await load();
          }}
        />
      )}

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : topics.length === 0 ? (
        <p style={styles.muted}>Nenhum tópico ainda. Adicione o primeiro acima.</p>
      ) : (
        <div style={styles.list}>
          {parents.map((p) => {
            const kids = childrenOf.get(p.id) ?? [];
            return kids.length > 0
              ? renderParentFolder(p, kids)
              : renderLeaf(p, false); // pai sem filhos = folha estudável
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: '34px 48px', fontFamily: theme.font, minWidth: 0 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 18, fontFamily: 'inherit' },
  header: { marginBottom: 22 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },

  progressCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 22 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  progressLabel: { fontSize: 13, color: theme.inkSoft, fontWeight: 600 },
  progressPct: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15 },
  progressFrac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  progressTrack: { height: 8, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },

  createRow: { display: 'flex', gap: 10, marginBottom: 20 },
  input: { flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  editInput: { flex: 1, minWidth: 0, width: '100%', padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${theme.teal}`, background: theme.card, fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  bulkBtn: { padding: '11px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },

  // folha (filho ou pai-sem-filhos)
  row: { display: 'flex', alignItems: 'center', gap: 10, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '12px 16px', minWidth: 0 },
  rowChild: { background: theme.bg, borderRadius: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${theme.line}`, background: theme.card, color: 'transparent', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: theme.onTeal },
  topicName: { flex: 1, fontSize: 15, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  topicNameDone: { color: theme.inkFaint, textDecoration: 'line-through' },
  actions: { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 },
  actionsMobile: { width: '100%', justifyContent: 'flex-end', marginTop: 4 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s', flexShrink: 0 },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', opacity: 0.6, width: 28, flexShrink: 0 },

  // pai-pasta
  folderWrap: { background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, overflow: 'hidden' },
  folderHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' },
  caretBtn: { width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  folderName: { fontSize: 15.5, color: theme.ink, fontWeight: 600, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  folderTrack: { height: 5, background: theme.muted, borderRadius: 999, overflow: 'hidden', marginTop: 7 },
  folderFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  folderMeta: { fontSize: 11.5, color: theme.inkSoft, marginTop: 4 },
  folderBody: { padding: '4px 12px 12px 40px', display: 'flex', flexDirection: 'column', gap: 6 },
  addChildBtn: { alignSelf: 'flex-start', marginTop: 2, border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' },
};