// app/(app)/subjects/[id]/page.tsx
// Tópicos de uma matéria: criar, colar vários, EDITAR, marcar "já estudei", estudar, ativar revisão.
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listTopics, createTopic, createTopicsBulk, updateTopic, toggleCompleted, deleteTopic, type Topic,
} from '@/services/topics.service';
import { activateReview, deactivateReview } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';
import { HealthBar } from '@/components/features/topics/HealthBar';
import { BulkImportModal } from '@/components/features/topics/BulkImportModal';
import { theme } from '@/lib/theme';

export default function TopicsPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [saudeMap, setSaudeMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

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

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createTopic(subjectId, newName);
      setNewName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  async function handleToggle(topic: Topic) {
    const novoValor = !topic.is_completed;
    setTopics((prev) =>
      prev.map((t) => (t.id === topic.id ? { ...t, is_completed: novoValor } : t)),
    );
    try {
      await toggleCompleted(topic.id, novoValor);
    } catch (e) {
      load();
      setError(e instanceof Error ? e.message : 'Erro ao marcar.');
    }
  }

  async function handleToggleReview(topic: Topic) {
    const novoValor = !topic.is_review_active;
    setTopics((prev) =>
      prev.map((t) => (t.id === topic.id ? { ...t, is_review_active: novoValor } : t)),
    );
    try {
      if (novoValor) await activateReview(topic.id);
      else await deactivateReview(topic.id);
    } catch (e) {
      load();
      setError(e instanceof Error ? e.message : 'Erro na revisão.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apagar este tópico?')) return;
    try {
      await deleteTopic(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setEditText(topic.name);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }
  async function commitEdit(id: string) {
    const nome = editText.trim();
    if (!nome) { cancelEdit(); return; }
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, name: nome } : t)));
    cancelEdit();
    try {
      await updateTopic(id, { name: nome });
    } catch (e) {
      load();
      setError(e instanceof Error ? e.message : 'Erro ao editar.');
    }
  }

  const total = topics.length;
  const done = topics.filter((t) => t.is_completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div style={styles.container}>
      <button onClick={() => router.push('/subjects')} style={styles.back}>← Matérias</button>

      <div style={styles.header}>
        <h1 style={styles.h1}>Tópicos</h1>
        <p style={styles.sub}>Marque o que já estudou e ative a revisão espaçada por tópico.</p>
      </div>

      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <span style={styles.progressLabel}>Progresso</span>
          <span style={styles.progressPct}>
            <b style={{ color: theme.ink, fontWeight: 700 }}>{pct}%</b>
            <span style={styles.progressFrac}>{done}/{total}</span>
          </span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
        </div>
      </div>

      <div style={styles.createRow}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Novo tópico (ex: Controle de Constitucionalidade)"
          style={styles.input}
        />
        <button onClick={handleCreate} style={styles.addBtn}>Adicionar</button>
        <button onClick={() => setBulkOpen(true)} style={styles.bulkBtn}>Colar vários</button>
      </div>

      {bulkOpen && (
        <BulkImportModal
          onClose={() => setBulkOpen(false)}
          onConfirm={async (nomes) => {
            await createTopicsBulk(subjectId, nomes);
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
          {topics.map((t) => (
            <div key={t.id} style={styles.row}>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(t.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onBlur={() => commitEdit(t.id)}
                  autoFocus
                  style={styles.editInput}
                />
              ) : (
                <span style={{ ...styles.topicName, ...(t.is_completed ? styles.topicNameDone : {}) }}>
                  {t.name}
                </span>
              )}

              <HealthBar saude={saudeMap[t.id]} />

              <button
                onClick={() => (editingId === t.id ? commitEdit(t.id) : startEdit(t))}
                style={{ ...styles.iconBtn, color: editingId === t.id ? theme.teal : theme.inkFaint }}
                title="Editar nome"
                aria-label="Editar tópico"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>

              <button
                onClick={() => handleToggleReview(t)}
                style={{ ...styles.iconBtn, color: t.is_review_active ? theme.teal : theme.inkFaint, background: t.is_review_active ? theme.tealBg : 'transparent' }}
                title={t.is_review_active ? 'Em revisão (clique para desativar)' : 'Ativar revisão espaçada'}
                aria-label="Alternar revisão"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2" /><path d="M20 4v5h-5M4 20v-5h5" />
                </svg>
              </button>
              <button
                onClick={() => router.push(`/?topicId=${t.id}&subjectId=${subjectId}`)}
                style={{ ...styles.iconBtn, color: theme.teal }}
                title="Estudar este tópico"
                aria-label="Estudar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>
              <button onClick={() => handleDelete(t.id)} style={styles.deleteBtn} aria-label="Apagar tópico">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900, margin: '0 auto', padding: '34px 48px', fontFamily: theme.font },
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
  input: { flex: 1, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  editInput: { flex: 1, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${theme.teal}`, background: theme.card, fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  bulkBtn: { padding: '11px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '12px 16px' },
  checkbox: { width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${theme.line}`, background: theme.card, color: 'transparent', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: '#fff' },
  topicName: { flex: 1, fontSize: 15, color: theme.ink },
  topicNameDone: { color: theme.inkFaint, textDecoration: 'line-through' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s' },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', opacity: 0.6, width: 28 },
};