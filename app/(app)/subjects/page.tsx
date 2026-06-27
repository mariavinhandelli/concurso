// app/(app)/subjects/page.tsx
// Matérias em duas abas:
//   • Banco de matérias  → catálogo global (filtro por área + busca, ativar)
//   • Minhas matérias     → instância do usuário (ativas/arquivadas, progresso,
//                           criar livre, editar nome/cor, arquivar)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSubject, updateSubject, deleteSubject, SUBJECT_COLORS,
} from '@/services/subjects.service';
import {
  getCatalogAreas, getCatalogSubjects, activateSubject,
  getMySubjects, archiveSubject, unarchiveSubject,
  type CatalogArea, type CatalogSubject, type MySubject, type SubjectStatus,
} from '@/services/catalog.service';
import { theme, pageWide } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Tab = 'banco' | 'minhas';

export default function SubjectsPage() {
  const router = useRouter();
  const { isMobile } = useUI();

  const [tab, setTab] = useState<Tab>('banco');
  const [error, setError] = useState('');

  return (
    <div style={{ ...pageWide, padding: isMobile ? '20px 16px' : '34px 40px', minWidth: 0 }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Matérias</h1>
        <p style={styles.sub}>Ative matérias do banco ou crie as suas. Clique numa matéria ativa para ver os tópicos.</p>
      </div>

      {/* Abas */}
      <div style={styles.tabs}>
        <button
          onClick={() => setTab('banco')}
          style={{ ...styles.tab, ...(tab === 'banco' ? styles.tabActive : {}) }}
        >
          Banco de matérias
        </button>
        <button
          onClick={() => setTab('minhas')}
          style={{ ...styles.tab, ...(tab === 'minhas' ? styles.tabActive : {}) }}
        >
          Minhas matérias
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {tab === 'banco'
        ? <BancoTab isMobile={isMobile} onError={setError} onActivated={() => setTab('minhas')} />
        : <MinhasTab isMobile={isMobile} onError={setError} router={router} />}
    </div>
  );
}

/* ============================================================
   ABA: BANCO DE MATÉRIAS (catálogo)
   ============================================================ */
function BancoTab({
  isMobile, onError, onActivated,
}: {
  isMobile: boolean;
  onError: (m: string) => void;
  onActivated: () => void;
}) {
  const [areas, setAreas] = useState<CatalogArea[]>([]);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState<string>('todas'); // slug ou 'todas'
  const [query, setQuery] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  async function load() {
    try {
      const [a, s] = await Promise.all([getCatalogAreas(), getCatalogSubjects()]);
      setAreas(a);
      setSubjects(s);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao carregar o banco.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleActivate(cat: CatalogSubject) {
    setActivatingId(cat.id);
    try {
      await activateSubject(cat.id);
      // marca como ativada localmente (feedback imediato)
      setSubjects((prev) => prev.map((s) => (s.id === cat.id ? { ...s, is_activated: true } : s)));
      onActivated(); // leva o usuário para "Minhas matérias"
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao ativar.');
    } finally {
      setActivatingId(null);
    }
  }

  // filtro por área + busca textual (client-side)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      const okArea = areaFilter === 'todas' || s.area_slugs.includes(areaFilter);
      const okQuery = q === '' || s.name.toLowerCase().includes(q);
      return okArea && okQuery;
    });
  }, [subjects, areaFilter, query]);

  // agrupa por área (na ordem das áreas); uma matéria pode aparecer em várias.
  // Se um filtro de área está ativo, mostra só aquele grupo.
  const groups = useMemo(() => {
    const visibleAreas = areaFilter === 'todas'
      ? areas
      : areas.filter((a) => a.slug === areaFilter);

    return visibleAreas
      .map((area) => ({
        area,
        items: filtered.filter((s) => s.area_slugs.includes(area.slug)),
      }))
      .filter((g) => g.items.length > 0);
  }, [areas, filtered, areaFilter]);

  if (loading) return <p style={styles.muted}>Carregando…</p>;

  return (
    <>
      {/* Busca */}
      <div style={styles.searchBox}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar matéria…"
          style={styles.searchInput}
        />
      </div>

      {/* Filtro por área */}
      <div style={styles.pills}>
        <button
          onClick={() => setAreaFilter('todas')}
          style={{ ...styles.pill, ...(areaFilter === 'todas' ? styles.pillActive : {}) }}
        >
          Todas
        </button>
        {areas.map((a) => (
          <button
            key={a.slug}
            onClick={() => setAreaFilter(a.slug)}
            style={{ ...styles.pill, ...(areaFilter === a.slug ? styles.pillActive : {}) }}
          >
            {a.name}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p style={styles.muted}>Nenhuma matéria encontrada.</p>
      ) : (
        groups.map(({ area, items }) => (
          <div key={area.slug} style={{ marginBottom: 22 }}>
            <div style={styles.groupLabel}>{area.name}</div>
            <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {items.map((s) => (
                <div key={s.id} style={styles.catCard}>
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.catName}>{s.name}</div>
                    <div style={styles.catMeta}>
                      {s.parent_count} tópicos · {s.topic_count - s.parent_count} subtópicos
                    </div>
                  </div>
                  {s.is_activated ? (
                    <span style={styles.activeBadge}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Ativa
                    </span>
                  ) : (
                    <button
                      onClick={() => handleActivate(s)}
                      disabled={activatingId === s.id}
                      style={{ ...styles.activateBtn, opacity: activatingId === s.id ? 0.6 : 1 }}
                    >
                      {activatingId === s.id ? 'Ativando…' : '+ Ativar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

/* ============================================================
   ABA: MINHAS MATÉRIAS (instância do usuário)
   ============================================================ */
function MinhasTab({
  isMobile, onError, router,
}: {
  isMobile: boolean;
  onError: (m: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [status, setStatus] = useState<SubjectStatus>('ativo');
  const [ativas, setAtivas] = useState<MySubject[]>([]);
  const [arquivadas, setArquivadas] = useState<MySubject[]>([]);
  const [loading, setLoading] = useState(true);

  // criar matéria livre
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);

  // editar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function load() {
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
  }
  useEffect(() => { load(); }, []);

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
  function cancelEdit() {
    setEditingId(null); setEditName(''); setEditColor('');
  }
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
    try { await archiveSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao arquivar.'); }
  }
  async function handleUnarchive(id: string) {
    try { await unarchiveSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao reativar.'); }
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Apagar "${name}" e todos os seus tópicos? Esta ação não pode ser desfeita.`)) return;
    try { await deleteSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao apagar.'); }
  }

  const lista = status === 'ativo' ? ativas : arquivadas;

  return (
    <>
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
          onClick={() => setStatus('ativo')}
          style={{ ...styles.pill, ...(status === 'ativo' ? styles.pillActive : {}) }}
        >
          Ativas ({ativas.length})
        </button>
        <button
          onClick={() => setStatus('arquivado')}
          style={{ ...styles.pill, ...(status === 'arquivado' ? styles.pillActive : {}) }}
        >
          Arquivadas ({arquivadas.length})
        </button>
      </div>

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : lista.length === 0 ? (
        <p style={styles.muted}>
          {status === 'ativo'
            ? 'Nenhuma matéria ativa. Ative uma no Banco de matérias ou crie a sua acima.'
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
                <div
                  style={styles.myCardMain}
                  onClick={() => status === 'ativo' && router.push(`/subjects/${s.id}`)}
                >
                  <span style={{ ...styles.colorBar, background: s.color ?? theme.teal }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.myCardTop}>
                      <span style={styles.myCardName}>{s.name}</span>
                      {s.is_own && <span style={styles.ownTag}>própria</span>}
                    </div>
                    {status === 'ativo' && (
                      <>
                        <div style={styles.myTrack}>
                          <div style={{ ...styles.myFill, width: `${s.progress}%`, background: s.color ?? theme.teal }} />
                        </div>
                        <div style={styles.myMeta}>
                          {s.progress}% · {s.leaf_done} de {s.leaf_total} tópicos estudados
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.myActions}>
                  {status === 'ativo' ? (
                    <>
                      <button onClick={() => startEdit(s)} style={styles.iconBtn} aria-label={`Editar ${s.name}`} title="Editar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button onClick={() => handleArchive(s.id)} style={styles.iconBtn} aria-label={`Arquivar ${s.name}`} title="Arquivar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" /><path d="M10 12h4" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleUnarchive(s.id)} style={styles.unarchiveBtn} title="Reativar">Reativar</button>
                      <button onClick={() => handleDelete(s.id, s.name)} style={styles.deleteBtn} aria-label={`Apagar ${s.name}`} title="Apagar">✕</button>
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
  header: { marginBottom: 20 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },

  tabs: { display: 'flex', gap: 4, borderBottom: `0.5px solid ${theme.line}`, marginBottom: 20 },
  tab: {
    padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 14.5, color: theme.inkSoft, fontWeight: 500, fontFamily: 'inherit',
    borderBottom: '2px solid transparent', marginBottom: -1,
  },
  tabActive: { color: theme.ink, fontWeight: 600, borderBottom: `2px solid ${theme.ink}` },

  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },

  // busca
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
    border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm,
    background: theme.card, padding: '9px 12px',
  },
  searchInput: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: theme.ink, fontFamily: 'inherit' },

  // pills (filtro área + ativas/arquivadas)
  pills: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 },
  pill: {
    fontSize: 12.5, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontWeight: 500,
  },
  pillActive: { background: theme.ink, color: theme.bg, border: `0.5px solid ${theme.ink}` },

  groupLabel: { fontSize: 12.5, color: theme.inkFaint, fontWeight: 600, marginBottom: 9 },
  grid: { display: 'grid', gap: 10 },

  // card do catálogo
  catCard: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 14, padding: '13px 15px', minWidth: 0,
  },
  catName: { fontSize: 14.5, fontWeight: 500, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis' },
  catMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 3 },
  activateBtn: {
    fontSize: 12.5, padding: '6px 13px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: theme.onTeal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, padding: '6px 11px',
    borderRadius: theme.radiusSm, background: theme.okBg, color: theme.ok, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
  },

  // criar livre
  createBox: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 18 },
  createRow: { display: 'flex', gap: 10, marginBottom: 14 },
  input: { flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  colors: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 },

  // minhas matérias
  myList: { display: 'flex', flexDirection: 'column', gap: 10 },
  myCard: { display: 'flex', alignItems: 'center', gap: 8, background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.line}`, padding: '13px 15px', minWidth: 0 },
  myCardMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', minWidth: 0 },
  colorBar: { width: 10, height: 36, borderRadius: 3, flexShrink: 0 },
  myCardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  myCardName: { fontSize: 15, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ownTag: { fontSize: 11, padding: '2px 7px', borderRadius: 999, background: theme.muted, color: theme.inkFaint, flexShrink: 0 },
  myTrack: { height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  myFill: { height: '100%', borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  myMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 4 },
  myActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: 0.75, flexShrink: 0 },
  unarchiveBtn: { fontSize: 12.5, padding: '6px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', opacity: 0.6, width: 28, flexShrink: 0 },

  // editar
  editCard: { background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.teal}`, boxShadow: theme.shadow, padding: 16 },
  editRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  editInput: { flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14.5, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  saveBtn: { padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  cancelBtn: { padding: '9px 10px', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};