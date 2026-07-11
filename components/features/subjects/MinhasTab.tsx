'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useConfirm } from '@/hooks/useConfirm';
import { createSubject, updateSubject, deleteSubject } from '@/services/subjects.service';
import { SUBJECT_COLORS } from '@/lib/subject-colors';
import {
  getMySubjects, archiveSubject, unarchiveSubject,
  type MySubject, type SubjectStatus,
} from '@/services/userSubjects.service';
import { theme } from '@/lib/theme';

type SortKey = 'recente' | 'alfa' | 'progresso';

interface Props {
  isMobile: boolean;
  onError: (m: string) => void;
}

export function MinhasTab({ isMobile, onError }: Props) {
  const { confirm, dialog } = useConfirm();
  const [status, setStatus] = useState<SubjectStatus>('ativo');
  const [ativas, setAtivas] = useState<MySubject[]>([]);
  const [arquivadas, setArquivadas] = useState<MySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recente');

  const load = useCallback(async () => {
    try {
      const [a, arq] = await Promise.all([
        getMySubjects('ativo'),
        getMySubjects('arquivado'),
      ]);
      setAtivas(a);
      setArquivadas(arq);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao carregar matérias.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createSubject(newName, newColor);
      setNewName('');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  function startEdit(s: MySubject) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color ?? SUBJECT_COLORS[0]);
  }
  function cancelEdit() { setEditingId(null); setEditName(''); setEditColor(''); }

  async function saveEdit() {
    if (!editingId || !editName.trim()) { cancelEdit(); return; }
    try {
      await updateSubject(editingId, { name: editName, color: editColor });
      cancelEdit();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  async function handleArchive(id: string) {
    setProcessingId(id);
    try { await archiveSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao arquivar.'); }
    finally { setProcessingId(null); }
  }
  async function handleUnarchive(id: string) {
    setProcessingId(id);
    try { await unarchiveSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao reativar.'); }
    finally { setProcessingId(null); }
  }
  async function handleDelete(id: string, name: string) {
    if (!await confirm({ title: `Apagar "${name}"?`, description: 'Todos os seus tópicos serão apagados. Esta ação não pode ser desfeita.', confirmLabel: 'Apagar', danger: true })) return;
    setProcessingId(id);
    try { await deleteSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao apagar.'); }
    finally { setProcessingId(null); }
  }

  const base = status === 'ativo' ? ativas : arquivadas;

  const lista = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? base.filter((s) => s.name.toLowerCase().includes(q)) : base;
    if (sort === 'alfa') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    if (sort === 'progresso') return [...filtered].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    return filtered;
  }, [base, search, sort]);

  return (
    <>
      {dialog}
      {/* Criar matéria própria */}
      <div style={styles.createBox}>
        <div style={{ ...styles.createRow, flexDirection: isMobile ? 'column' : 'row' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Criar matéria própria (ex: Lei Orgânica do TCE-GO)"
            style={styles.input}
          />
          <button onClick={handleCreate} style={{ ...styles.addBtn, width: isMobile ? '100%' : undefined }}>Criar</button>
        </div>
        <div style={styles.colors}>
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              style={{ ...styles.colorDot, background: c, outline: newColor === c ? `2px solid ${theme.ink}` : 'none', outlineOffset: 2 }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Sub-filtro ativas/arquivadas */}
      <div style={styles.pills}>
        <button
          onClick={() => { setStatus('ativo'); if (editingId) cancelEdit(); }}
          style={{ ...styles.pill, ...(status === 'ativo' ? styles.pillActive : {}) }}
        >
          Ativas ({ativas.length})
        </button>
        <button
          onClick={() => { setStatus('arquivado'); if (editingId) cancelEdit(); }}
          style={{ ...styles.pill, ...(status === 'arquivado' ? styles.pillActive : {}) }}
        >
          Arquivadas ({arquivadas.length})
        </button>
      </div>

      {/* Busca + Ordenação */}
      {!loading && base.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <div style={styles.searchBox}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar matéria…"
              style={styles.searchInput}
              aria-label="Buscar matéria"
            />
            {search && (
              <button onClick={() => setSearch('')} style={styles.searchClear} aria-label="Limpar busca">✕</button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={styles.sortSelect}
            aria-label="Ordenar por"
          >
            <option value="recente">Recentes</option>
            <option value="alfa">A–Z</option>
            <option value="progresso">Progresso</option>
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: theme.muted, animation: 'skeleton-pulse 1.4s ease infinite', animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p style={styles.muted}>
          {search ? 'Nenhuma matéria encontrada para esta busca.' :
            status === 'ativo'
              ? 'Nenhuma matéria ativa. Explore o banco ou crie a sua acima.'
              : 'Nenhuma matéria arquivada.'}
        </p>
      ) : (
        <div style={styles.myList}>
          {lista.map((s) => (
            editingId === s.id ? (
              <div key={s.id} style={styles.editCard}>
                <div style={{ ...styles.editRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <span style={{ ...styles.colorBar, background: editColor }} />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={styles.editInput}
                  />
                  <button onClick={saveEdit} style={styles.saveBtn}>Salvar</button>
                  <button onClick={cancelEdit} style={styles.cancelBtn}>Cancelar</button>
                </div>
                <div style={styles.colors}>
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{ ...styles.colorDot, background: c, outline: editColor === c ? `2px solid ${theme.ink}` : 'none', outlineOffset: 2 }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={s.id} style={styles.myCard}>
                {status === 'ativo' ? (
                  <Link href={`/subjects/${s.id}`} style={{ ...styles.myCardMain, textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ ...styles.colorBar, background: s.color ?? theme.teal }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.myCardTop}>
                        <span style={styles.myCardName}>{s.name}</span>
                        {s.is_own && <span style={styles.ownTag}>própria</span>}
                      </div>
                      <div style={styles.myTrack}>
                        <div style={{ ...styles.myFill, width: `${s.progress}%`, background: s.color ?? theme.teal }} />
                      </div>
                      <div style={styles.myMeta}>
                        {s.progress}% · {s.leaf_done} de {s.leaf_total} tópicos estudados
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div style={{ ...styles.myCardMain, cursor: 'default' }}>
                    <span style={{ ...styles.colorBar, background: s.color ?? theme.teal }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.myCardTop}>
                        <span style={styles.myCardName}>{s.name}</span>
                        {s.is_own && <span style={styles.ownTag}>própria</span>}
                      </div>
                    </div>
                  </div>
                )}

                <div style={styles.myActions}>
                  {status === 'ativo' ? (
                    <>
                      <button onClick={() => startEdit(s)} style={styles.iconBtn} aria-label={`Editar ${s.name}`} title="Editar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button onClick={() => handleArchive(s.id)} disabled={processingId === s.id} style={{ ...styles.iconBtn, opacity: processingId === s.id ? 0.4 : 1 }} aria-label={`Arquivar ${s.name}`} title="Arquivar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" /><path d="M10 12h4" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleUnarchive(s.id)} disabled={processingId === s.id} style={{ ...styles.unarchiveBtn, opacity: processingId === s.id ? 0.4 : 1 }} title="Reativar">{processingId === s.id ? '…' : 'Reativar'}</button>
                      <button onClick={() => handleDelete(s.id, s.name)} disabled={processingId === s.id} style={{ ...styles.deleteBtn, opacity: processingId === s.id ? 0.4 : 1 }} aria-label={`Apagar ${s.name}`} title="Apagar">✕</button>
                    </>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  muted: { color: theme.inkFaint, fontSize: 14 },

  createBox: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 18 },
  createRow: { display: 'flex', gap: 10, marginBottom: 14 },
  input: { flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  colors: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 },

  pills: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 },
  pill: {
    fontSize: 12.5, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontWeight: 500,
  },
  pillActive: { background: theme.ink, color: theme.bg, border: `0.5px solid ${theme.ink}` },

  searchBox: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 7,
    border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm,
    background: theme.card, padding: '8px 11px',
  },
  searchInput: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: theme.ink, fontFamily: 'inherit' },
  searchClear: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  sortSelect: {
    padding: '8px 11px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft, fontSize: 13, fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none', flexShrink: 0,
  },

  myList: { display: 'flex', flexDirection: 'column', gap: 10 },
  myCard: { display: 'flex', alignItems: 'center', gap: 8, background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.line}`, padding: '13px 15px', minWidth: 0 },
  myCardMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', minWidth: 0 },
  colorBar: { width: 10, height: 36, borderRadius: 3, flexShrink: 0 },
  myCardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  myCardName: { fontSize: 15, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ownTag: { fontSize: 11, padding: '2px 7px', borderRadius: 999, background: 'rgba(15,23,42,.05)', color: theme.inkFaint, flexShrink: 0 },
  myTrack: { height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  myFill: { height: '100%', borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  myMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 4 },
  myActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: 0.75, flexShrink: 0 },
  unarchiveBtn: { fontSize: 12.5, padding: '6px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', opacity: 0.6, width: 28, flexShrink: 0 },

  editCard: { background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.teal}`, boxShadow: theme.shadow, padding: 16 },
  editRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  editInput: { flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14.5, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  saveBtn: { padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  cancelBtn: { padding: '9px 10px', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};
