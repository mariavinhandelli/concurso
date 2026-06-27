// app/(app)/notebook/page.tsx
// Caderno: navegação (Matéria → Tópico → Erros) + busca + abas Recentes e Críticos.
// No mobile, master-detail: mostra a lista OU o editor (não os dois lado a lado).
'use client';

import { useEffect, useState, useCallback } from 'react';
import { searchNotes, listNotes, deleteNote, countNotesBySubject, listNotesByBoard, listRecentNotes, listCriticalTopics, listBoards, type ErrorNote, type CriticalTopic } from '@/services/notebook.service';
import { listSubjectOptions, listTopicOptions, type PickerOption } from '@/services/picker.service';
import { NoteEditor } from '@/components/features/notebook/NoteEditor';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Level = 'subjects' | 'topics' | 'notes';
type ViewMode = 'navegar' | 'recentes' | 'criticos';

const PERIODOS = [7, 15, 30];

export default function NotebookPage() {
  const { isMobile } = useUI();
  const [viewMode, setViewMode] = useState<ViewMode>('navegar');
  const [periodo, setPeriodo] = useState(7);
  const [recentNotes, setRecentNotes] = useState<ErrorNote[]>([]);
  const [criticals, setCriticals] = useState<CriticalTopic[]>([]);

  const [level, setLevel] = useState<Level>('subjects');
  const [subjects, setSubjects] = useState<PickerOption[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);
  const [notes, setNotes] = useState<ErrorNote[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [curSubject, setCurSubject] = useState<PickerOption | null>(null);
  const [curTopic, setCurTopic] = useState<PickerOption | null | 'none'>(null);

  const [term, setTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ErrorNote[] | null>(null);
  const [boards, setBoards] = useState<{ id: string; name: string; color: string }[]>([]);
  const [boardFilter, setBoardFilter] = useState('');
  const [boardResults, setBoardResults] = useState<ErrorNote[] | null>(null);
  const [selected, setSelected] = useState<ErrorNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [blankEditor, setBlankEditor] = useState(false);

  useEffect(() => {
    listSubjectOptions().then(setSubjects).catch(() => {});
    countNotesBySubject().then(setCounts).catch(() => {});
  }, []);
  useEffect(() => {
    listBoards().then(setBoards).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode !== 'recentes') return;
    listRecentNotes(periodo).then(setRecentNotes).catch(() => setRecentNotes([]));
  }, [viewMode, periodo]);

  useEffect(() => {
    if (viewMode !== 'criticos') return;
    listCriticalTopics().then(setCriticals).catch(() => setCriticals([]));
  }, [viewMode]);

  useEffect(() => {
    if (!boardFilter) { setBoardResults(null); return; }
    listNotesByBoard(boardFilter).then(setBoardResults).catch(() => setBoardResults([]));
  }, [boardFilter]);

  useEffect(() => {
    if (!term.trim()) { setSearchResults(null); return; }
    const t = setTimeout(() => {
      searchNotes(term).then(setSearchResults).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const loadNotes = useCallback(async (subjectId: string, topicId: string | null) => {
    const data = await listNotes({ subjectId, topicId });
    setNotes(data);
  }, []);

  function openSubject(s: PickerOption) {
    setCurSubject(s);
    listTopicOptions(s.id).then(setTopics).catch(() => {});
    setLevel('topics');
  }

  function openTopic(t: PickerOption | 'none') {
    setCurTopic(t);
    const topicId = t === 'none' ? null : t.id;
    loadNotes(curSubject!.id, topicId);
    setLevel('notes');
  }

  // Abre os erros de um tópico crítico (vai pro modo navegar, nível notes).
  async function openCriticalTopic(c: CriticalTopic) {
    setViewMode('navegar');
    const subjOption: PickerOption = { id: '', name: c.subjectName };
    setCurSubject(subjOption);
    setCurTopic({ id: c.topicId, name: c.topicName });
    const data = await listNotes({ topicId: c.topicId });
    setNotes(data);
    setLevel('notes');
  }

  function handleNew() {
    setSelected(null);
    setBlankEditor(false);
    setEditing(true);
  }

  function handleNewGlobal() {
    setSelected(null);
    setBlankEditor(true);
    setEditing(true);
  }

  function handleSelectNote(n: ErrorNote) {
    setSelected(n);
    setBlankEditor(false);
    setEditing(true);
  }

  function refreshAux() {
    if (viewMode === 'recentes') listRecentNotes(periodo).then(setRecentNotes).catch(() => {});
    if (viewMode === 'criticos') listCriticalTopics().then(setCriticals).catch(() => {});
  }

  async function handleSaved() {
    setEditing(false);
    setSelected(null);
    setBlankEditor(false);
    if (curSubject) {
      const topicId = curTopic === 'none' ? null : (curTopic?.id ?? null);
      loadNotes(curSubject.id, topicId);
    }
    countNotesBySubject().then(setCounts).catch(() => {});
    refreshAux();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Apagar este erro?')) return;
    await deleteNote(id);
    if (selected?.id === id) { setSelected(null); setEditing(false); }
    if (curSubject) {
      const topicId = curTopic === 'none' ? null : (curTopic?.id ?? null);
      loadNotes(curSubject.id, topicId);
    }
    if (searchResults) setSearchResults(searchResults.filter((n) => n.id !== id));
    setRecentNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const presetSubjectId = blankEditor ? null : (curSubject?.id || null);
  const presetTopicId = blankEditor ? null : (curTopic === 'none' ? null : (curTopic?.id ?? null));

  // Cor da taxa de acerto (status universal).
  function acColor(pct: number): string {
    if (pct >= 75) return theme.ok;
    if (pct >= 50) return theme.warn;
    return theme.crit;
  }

  // Master-detail no mobile: mostra a sidebar OU o editor.
  const showSidebar = !isMobile || !editing;
  const showMain = !isMobile || editing;

  return (
    <div style={{ ...styles.page, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={styles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Cadernos de Erros</h1>
            <p style={styles.sub}>Registre o erro. Revise os recentes e ataque os críticos.</p>
          </div>
          <button onClick={handleNewGlobal} style={{ ...styles.addTopBtn, width: isMobile ? '100%' : undefined }}>+ Adicionar erro</button>
        </div>
      </div>

      <div style={{ ...styles.layout, flexDirection: isMobile ? 'column' : 'row' }}>
        {showSidebar && (
        <aside style={{ ...styles.sidebar, width: isMobile ? '100%' : 300 }}>
          <div style={styles.tabs}>
            <button onClick={() => setViewMode('navegar')}
              style={{ ...styles.tab, ...(viewMode === 'navegar' ? styles.tabOn : {}) }}>Navegar</button>
            <button onClick={() => setViewMode('recentes')}
              style={{ ...styles.tab, ...(viewMode === 'recentes' ? styles.tabOn : {}) }}>Recentes</button>
            <button onClick={() => setViewMode('criticos')}
              style={{ ...styles.tab, ...(viewMode === 'criticos' ? styles.tabOn : {}) }}>Críticos</button>
          </div>

          {viewMode === 'recentes' ? (
            <>
              <div style={styles.periodRow}>
                {PERIODOS.map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    style={{ ...styles.periodBtn, ...(periodo === p ? styles.periodBtnOn : {}) }}>
                    {p} dias
                  </button>
                ))}
              </div>
              <div style={styles.list}>
                <p style={styles.crumb}>Erros dos últimos {periodo} dias</p>
                {recentNotes.length === 0 ? (
                  <p style={styles.muted}>Nenhum erro registrado neste período.</p>
                ) : recentNotes.map((n) => (
                  <NoteItem key={n.id} note={n} active={selected?.id === n.id}
                    onClick={() => handleSelectNote(n)} onDelete={(e) => handleDelete(n.id, e)} />
                ))}
              </div>
            </>
          ) : viewMode === 'criticos' ? (
            <div style={styles.list}>
              <p style={styles.crumb}>Tópicos por prioridade</p>
              {criticals.length === 0 ? (
                <p style={styles.muted}>Nenhum erro com tópico ainda. Registre erros vinculados a tópicos para ver suas prioridades.</p>
              ) : criticals.map((c) => (
                <div key={c.topicId} onClick={() => openCriticalTopic(c)}
                  style={{ ...styles.critItem, ...(c.isAlert ? styles.critAlert : {}) }}>
                  <div style={styles.critTop}>
                    <span style={styles.critName}>{c.topicName}</span>
                    {c.isAlert && <span style={styles.critBadge}>crítico</span>}
                  </div>
                  <span style={styles.critSubject}>{c.subjectName}</span>
                  <div style={styles.critStats}>
                    <span style={styles.critErrors}>{c.errorCount} {c.errorCount === 1 ? 'erro' : 'erros'}</span>
                    <span style={styles.critDot}>·</span>
                    <span style={styles.critAcerto}>
                      {c.acertoPct === null ? '— acerto' : (
                        <>acerto <b style={{ color: acColor(c.acertoPct) }}>{c.acertoPct}%</b></>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <input value={term} onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar em todos os erros…" style={styles.search} />
              <select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} style={styles.search}>
                <option value="">Todas as bancas</option>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {boardResults !== null ? (
                <div style={styles.list}>
                  <p style={styles.crumb}>Erros da banca selecionada</p>
                  {boardResults.length === 0 ? (
                    <p style={styles.muted}>Nenhum erro nesta banca.</p>
                  ) : boardResults.map((n) => (
                    <NoteItem key={n.id} note={n} active={selected?.id === n.id}
                      onClick={() => handleSelectNote(n)} onDelete={(e) => handleDelete(n.id, e)} />
                  ))}
                </div>
              ) : searchResults !== null ? (
                <div style={styles.list}>
                  <p style={styles.crumb}>Resultados da busca</p>
                  {searchResults.length === 0 ? (
                    <p style={styles.muted}>Nada encontrado.</p>
                  ) : searchResults.map((n) => (
                    <NoteItem key={n.id} note={n} active={selected?.id === n.id}
                      onClick={() => handleSelectNote(n)} onDelete={(e) => handleDelete(n.id, e)} />
                  ))}
                </div>
              ) : (
                <>
                  {level === 'subjects' && (
                    <div style={styles.list}>
                      <p style={styles.crumb}>Matérias</p>
                      {subjects.length === 0 ? (
                        <p style={styles.muted}>Crie matérias primeiro na aba Matérias.</p>
                      ) : subjects.map((s) => (
                        <div key={s.id} onClick={() => openSubject(s)} style={styles.navItem}>
                          <span style={styles.navItemName}>{s.name}</span>
                          {counts[s.id] ? <span style={styles.count}>{counts[s.id]}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {level === 'topics' && curSubject && (
                    <div style={styles.list}>
                      <button onClick={() => setLevel('subjects')} style={styles.back}>← Matérias</button>
                      <p style={styles.crumbSubject}>{curSubject.name}</p>
                      {topics.map((t) => (
                        <div key={t.id} onClick={() => openTopic(t)} style={styles.navItem}>
                          <span style={styles.navItemName}>{t.name}</span>
                        </div>
                      ))}
                      <div onClick={() => openTopic('none')} style={{ ...styles.navItem }}>
                        <span style={{ ...styles.navItemName, fontStyle: 'italic', color: theme.inkFaint }}>Sem tópico específico</span>
                      </div>
                    </div>
                  )}

                  {level === 'notes' && curSubject && (
                    <div style={styles.list}>
                      <button onClick={() => setLevel('topics')} style={styles.back}>← Tópicos</button>
                      <p style={styles.crumbSubject}>
                        {curTopic === 'none' ? 'Sem tópico' : (curTopic as PickerOption)?.name}
                      </p>
                      <button onClick={handleNew} style={styles.newBtn}>+ Novo erro</button>
                      {notes.length === 0 ? (
                        <p style={styles.muted}>Nenhum erro aqui ainda.</p>
                      ) : notes.map((n) => (
                        <NoteItem key={n.id} note={n} active={selected?.id === n.id}
                          onClick={() => handleSelectNote(n)} onDelete={(e) => handleDelete(n.id, e)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </aside>
        )}

        {showMain && (
        <section style={styles.main}>
          {editing ? (
            <>
              {isMobile && (
                <button onClick={() => { setEditing(false); setSelected(null); setBlankEditor(false); }} style={styles.backToList}>
                  ← Voltar à lista
                </button>
              )}
              <NoteEditor
                note={selected}
                presetSubjectId={presetSubjectId}
                presetTopicId={presetTopicId}
                onSaved={handleSaved}
                onCancel={() => { setEditing(false); setSelected(null); setBlankEditor(false); }}
              />
            </>
          ) : (
            <div style={styles.empty}>
              <p style={styles.muted}>Navegue até um tópico e crie ou selecione um erro — ou use “Adicionar erro” no topo.</p>
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}

function NoteItem({ note, active, onClick, onDelete }: {
  note: ErrorNote; active: boolean;
  onClick: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div onClick={onClick} style={{ ...styles.item, ...(active ? styles.itemActive : {}) }}>
      <div style={styles.itemTitle}>{note.title || '(sem título)'}</div>
      {note.error_type && <div style={styles.itemMeta}><span style={styles.tag}>{note.error_type}</span></div>}
      <button onClick={onDelete} style={styles.delBtn} aria-label="Apagar erro">✕</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1140, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, width: '100%', minWidth: 0, boxSizing: 'border-box' },
  header: { marginBottom: 24 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  addTopBtn: { padding: '11px 20px', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start', width: '100%', minWidth: 0 },
  sidebar: { width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  tabs: { display: 'flex', gap: 4, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 4 },
  tab: { flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  periodRow: { display: 'flex', gap: 6 },
  periodBtn: { flex: 1, padding: '7px 0', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  periodBtnOn: { background: theme.card, borderColor: theme.teal, color: theme.ink, boxShadow: theme.shadow },
  search: { padding: '11px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  crumb: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, margin: '4px 0', textTransform: 'uppercase', letterSpacing: 0.6 },
  crumbSubject: { fontSize: 15, color: theme.ink, fontWeight: 700, margin: '6px 0 4px', lineHeight: 1.4 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' },
  backToList: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', marginBottom: 14 },
  newBtn: { padding: '11px 0', borderRadius: 12, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 4, fontFamily: 'inherit' },
  muted: { color: theme.inkFaint, fontSize: 14, lineHeight: 1.5 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: theme.card, borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer' },
  navItemName: { fontSize: 14, color: theme.ink, fontWeight: 500, lineHeight: 1.45 },
  count: { fontSize: 11, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, flexShrink: 0 },
  critItem: { display: 'flex', flexDirection: 'column', gap: 3, background: theme.card, borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer' },
  critAlert: { borderWidth: 1.5, borderColor: theme.crit, background: theme.bg },
  critTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  critName: { fontSize: 14, color: theme.ink, fontWeight: 600, lineHeight: 1.35 },
  critBadge: { fontSize: 10, fontWeight: 700, color: '#fff', background: theme.crit, padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 },
  critSubject: { fontSize: 12, color: theme.inkFaint },
  critStats: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12.5, color: theme.inkSoft },
  critErrors: { fontWeight: 600, color: theme.ink },
  critDot: { color: theme.inkFaint },
  critAcerto: { color: theme.inkSoft },
  item: { position: 'relative', background: theme.card, borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer', transition: 'border-color .15s' },
  itemActive: { borderColor: theme.teal, background: theme.tealBg },
  itemTitle: { fontSize: 14, color: theme.ink, fontWeight: 500, paddingRight: 20, lineHeight: 1.4 },
  itemMeta: { marginTop: 6 },
  tag: { fontSize: 11, color: theme.tealDeep, background: theme.tealBg, padding: '2px 8px', borderRadius: 6, fontWeight: 600 },
  delBtn: { position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', opacity: 0.6 },
  main: { flex: '1 1 0', minWidth: 0, maxWidth: '100%', width: '100%', background: theme.card, borderRadius: theme.radius, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, boxShadow: theme.shadow, padding: 24, minHeight: 440, overflowX: 'hidden', boxSizing: 'border-box' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 392, textAlign: 'center' },
};