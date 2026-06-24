// app/(app)/subjects/page.tsx
// Lista de Matérias Base em grade de 2 colunas: criar, ver, editar (nome + cor) e apagar.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listSubjects, createSubject, updateSubject, deleteSubject,
  SUBJECT_COLORS, type Subject,
} from '@/services/subjects.service';
import { theme, pageWide } from '@/lib/theme';

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function load() {
    try {
      setSubjects(await listSubjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createSubject(newName, newColor);
      setNewName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  function startEdit(s: Subject) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) { cancelEdit(); return; }
    try {
      await updateSubject(editingId, { name: editName, color: editColor });
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Apagar "${name}" e todos os seus tópicos?`)) return;
    try {
      await deleteSubject(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  return (
    <div style={pageWide}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Matérias</h1>
        <p style={styles.sub}>Suas matérias base. Clique numa matéria para ver os tópicos.</p>
      </div>

      <div style={styles.createBox}>
        <div style={styles.createRow}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nova matéria (ex: Direito Constitucional)"
            style={styles.input}
          />
          <button onClick={handleCreate} style={styles.addBtn}>Criar</button>
        </div>
        <div style={styles.colors}>
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              style={{
                ...styles.colorDot,
                background: c,
                outline: newColor === c ? `2px solid ${theme.ink}` : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : subjects.length === 0 ? (
        <p style={styles.muted}>Nenhuma matéria ainda. Crie a primeira acima.</p>
      ) : (
        <div style={styles.grid}>
          {subjects.map((s) => (
            editingId === s.id ? (
              <div key={s.id} style={styles.editCard}>
                <div style={styles.editRow}>
                  <span style={{ ...styles.colorBar, background: editColor }} />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                    style={styles.editInput}
                  />
                  <button onClick={saveEdit} style={styles.saveBtn}>Salvar</button>
                  <button onClick={cancelEdit} style={styles.cancelBtn}>Cancelar</button>
                </div>
                <div style={styles.editColors}>
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        ...styles.colorDot,
                        background: c,
                        outline: editColor === c ? `2px solid ${theme.ink}` : 'none',
                        outlineOffset: 2,
                      }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={s.id} style={styles.card}>
                <div
                  style={styles.cardMain}
                  onClick={() => router.push(`/subjects/${s.id}`)}
                >
                  <span style={{ ...styles.colorBar, background: s.color }} />
                  <span style={styles.cardName}>{s.name}</span>
                </div>
                <button
                  onClick={() => startEdit(s)}
                  style={styles.editBtn}
                  aria-label={`Editar ${s.name}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  style={styles.deleteBtn}
                  aria-label={`Apagar ${s.name}`}
                >
                  ✕
                </button>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 24 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  createBox: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 24 },
  createRow: { display: 'flex', gap: 10, marginBottom: 14 },
  input: {
    flex: 1, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none',
  },
  addBtn: {
    padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  colors: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  card: {
    display: 'flex', alignItems: 'center', background: theme.card,
    borderRadius: 14, border: `0.5px solid ${theme.line}`, overflow: 'hidden',
    transition: 'border-color .15s',
  },
  cardMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: 16, cursor: 'pointer', minWidth: 0 },
  colorBar: { width: 5, height: 28, borderRadius: 3, flexShrink: 0 },
  cardName: { fontSize: 15.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  editBtn: {
    padding: '0 14px', alignSelf: 'stretch', border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.7,
  },
  deleteBtn: {
    padding: '0 18px', alignSelf: 'stretch', border: 'none', background: 'transparent',
    color: theme.inkFaint, fontSize: 14, cursor: 'pointer', opacity: 0.6,
  },
  editCard: {
    gridColumn: '1 / -1',
    background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.teal}`,
    boxShadow: theme.shadow, padding: 16,
  },
  editRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  editInput: {
    flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.bg, fontSize: 14.5, color: theme.ink, fontFamily: 'inherit', outline: 'none',
  },
  saveBtn: {
    padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  cancelBtn: {
    padding: '9px 10px', border: 'none', background: 'transparent',
    color: theme.inkFaint, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  editColors: { display: 'flex', gap: 10, flexWrap: 'wrap' },
};