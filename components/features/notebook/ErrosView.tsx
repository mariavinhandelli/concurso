// components/features/notebook/ErrosView.tsx
// Aba "Erros" do hub Caderno: log estruturado de erros (Navegar/Recentes/
// Críticos + banca), extraído da antiga página /notebook SEM alterar a lógica.
// O hub cuida de header/abas e passa `openNoteId` para abrir um erro vindo da
// aba "Tudo". O botão "+ Adicionar erro" fica numa barra de ações da própria view.
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { searchNotes, listNotes, getNote, deleteNote, countNotesBySubject, listNotesByBoard, listRecentNotes, listCriticalTopics, listBoards, type ErrorNote, type CriticalTopic } from '@/services/notebook.service';
import { listActiveWithColor, type SubjectColorOption } from '@/services/subjects.service';
import { listLeaves as listTopicOptions, type PickerOption } from '@/services/topics.service';
import { scheduleReviewFromError } from '@/services/reviews.service';
import { NoteEditor } from '@/components/features/notebook/NoteEditor';
import { SubjectPill } from '@/components/features/caderno/SubjectPill';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

type Level = 'subjects' | 'topics' | 'notes';
type ViewMode = 'navegar' | 'recentes' | 'criticos';

const PERIODOS = [7, 15, 30];

export function ErrosView({ openNoteId }: { openNoteId?: string | null }) {
  const { isMobile, isTablet } = useUI();
  const [viewMode, setViewMode] = useState<ViewMode>('navegar');
  const [periodo, setPeriodo] = useState(7);
  const [recentNotes, setRecentNotes] = useState<ErrorNote[]>([]);
  const [criticals, setCriticals] = useState<CriticalTopic[]>([]);

  const [level, setLevel] = useState<Level>('subjects');
  const [subjects, setSubjects] = useState<SubjectColorOption[]>([]);
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
  const [boardLoading, setBoardLoading] = useState(false);
  const [selected, setSelected] = useState<ErrorNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [blankEditor, setBlankEditor] = useState(false);
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const loadingSubjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      listActiveWithColor().then(setSubjects),
      countNotesBySubject().then(setCounts),
    ])
      .catch(() => setPageError('Erro ao carregar matérias. Recarregue a página.'))
      .finally(() => setLoadingSubjects(false));
  }, []);
  useEffect(() => {
    listBoards().then(setBoards).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar bancas.'));
  }, [toast]);

  // Abre um erro específico (deep-link da aba "Tudo").
  useEffect(() => {
    if (!openNoteId) return;
    let cancelled = false;
    getNote(openNoteId).then((n) => {
      if (cancelled || !n) return;
      setSelected(n);
      setBlankEditor(false);
      setEditing(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [openNoteId]);

  useEffect(() => {
    if (viewMode !== 'recentes') return;
    listRecentNotes(periodo).then(setRecentNotes).catch((e) => { toast.error(e instanceof Error ? e.message : 'Erro ao carregar notas recentes.'); setRecentNotes([]); });
  }, [viewMode, periodo, toast]);

  useEffect(() => {
    if (viewMode !== 'criticos') return;
    listCriticalTopics().then(setCriticals).catch((e) => { toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos críticos.'); setCriticals([]); });
  }, [viewMode, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ao limpar o filtro de banca
    if (!boardFilter) { setBoardResults(null); setBoardLoading(false); return; }
    setBoardLoading(true);
    listNotesByBoard(boardFilter)
      .then(setBoardResults)
      .catch((e) => { toast.error(e instanceof Error ? e.message : 'Erro ao filtrar por banca.'); setBoardResults([]); })
      .finally(() => setBoardLoading(false));
  }, [boardFilter, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ao limpar a busca
    if (!term.trim()) { setSearchResults(null); return; }
    const t = setTimeout(() => {
      searchNotes(term).then(setSearchResults).catch((e) => { toast.error(e instanceof Error ? e.message : 'Erro na busca.'); setSearchResults([]); });
    }, 300);
    return () => clearTimeout(t);
  }, [term, toast]);

  const loadNotes = useCallback(async (subjectId: string, topicId: string | null) => {
    setLoadingNotes(true);
    try {
      const data = await listNotes({ subjectId, topicId });
      setNotes(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar anotações. Tente novamente.');
    } finally {
      setLoadingNotes(false);
    }
  }, [toast]);

  function openSubject(sub: PickerOption) {
    setCurSubject(sub);
    setLevel('topics');
    loadingSubjectIdRef.current = sub.id;
    listTopicOptions(sub.id)
      .then((ts) => { if (loadingSubjectIdRef.current === sub.id) setTopics(ts); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos.'));
  }

  function openTopic(t: PickerOption | 'none') {
    setCurTopic(t);
    const topicId = t === 'none' ? null : t.id;
    loadNotes(curSubject!.id, topicId);
    setLevel('notes');
  }

  async function openCriticalTopic(c: CriticalTopic) {
    setViewMode('navegar');
    setCurSubject({ id: c.subjectId, name: c.subjectName });
    setCurTopic({ id: c.topicId, name: c.topicName });
    setLevel('notes');
    setLoadingNotes(true);
    try {
      const [data, topicList] = await Promise.all([
        listNotes({ subjectId: c.subjectId, topicId: c.topicId }),
        listTopicOptions(c.subjectId),
      ]);
      setNotes(data);
      setTopics(topicList);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar notas.');
    } finally {
      setLoadingNotes(false);
    }
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
    if (viewMode === 'recentes') listRecentNotes(periodo).then(setRecentNotes).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao atualizar recentes.'));
    if (viewMode === 'criticos') listCriticalTopics().then(setCriticals).catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao atualizar críticos.'));
  }

  async function handleSaved() {
    toast.success('Erro salvo no caderno.');
    setEditing(false);
    setSelected(null);
    setBlankEditor(false);
    if (curSubject) {
      const topicId = curTopic === 'none' ? null : (curTopic?.id ?? null);
      loadNotes(curSubject.id, topicId);
    }
    if (boardFilter) {
      listNotesByBoard(boardFilter).then(setBoardResults).catch(() => {});
    }
    if (!selected) countNotesBySubject().then(setCounts).catch(() => {});
    refreshAux();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const snapshotSubject = curSubject;
    const snapshotTopic = curTopic;
    if (!await confirm({ title: 'Apagar este erro?', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteNote(id);
      toast.success('Erro apagado.');
      if (selected?.id === id) { setSelected(null); setEditing(false); }
      if (snapshotSubject) {
        const topicId = snapshotTopic === 'none' ? null : (snapshotTopic?.id ?? null);
        loadNotes(snapshotSubject.id, topicId);
      }
      if (searchResults) setSearchResults(searchResults.filter((n) => n.id !== id));
      if (boardResults) setBoardResults(boardResults.filter((n) => n.id !== id));
      setRecentNotes((prev) => prev.filter((n) => n.id !== id));
      countNotesBySubject().then(setCounts).catch(() => {});
      listCriticalTopics().then(setCriticals).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao apagar a anotação. Tente novamente.');
    }
  }

  const presetSubjectId = blankEditor ? null : (curSubject?.id || null);
  const presetTopicId = blankEditor ? null : (curTopic === 'none' ? null : (curTopic?.id ?? null));

  function acColor(pct: number): string {
    if (pct >= 75) return theme.ok;
    if (pct >= 50) return theme.warn;
    return theme.crit;
  }

  const showSidebar = !isMobile || !editing;
  const showMain = !isMobile || editing;

  return (
    <div>
      <div style={styles.actionsRow}>
        <p style={styles.sub}>Registre o erro. Revise os recentes e ataque os críticos.</p>
        <Button onClick={handleNewGlobal} style={{ width: isMobile ? '100%' : undefined }}>+ Adicionar erro</Button>
      </div>

      {dialog}
      {pageError && (
        <p role="alert" aria-live="polite" style={styles.pageError}>{pageError}</p>
      )}

      <div style={{ ...styles.layout, flexDirection: isMobile ? 'column' : 'row' }}>
        {showSidebar && (
        <aside style={{ ...styles.sidebar, width: isMobile ? '100%' : isTablet ? 240 : 300 }}>
          <div style={styles.tabs}>
            {(['navegar', 'recentes', 'criticos'] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => {
                if (m !== 'navegar') { setTerm(''); setBoardFilter(''); }
                setViewMode(m);
              }} style={{ ...styles.tab, ...(viewMode === m ? styles.tabOn : {}) }}>
                {m === 'navegar' ? 'Navegar' : m === 'recentes' ? 'Recentes' : 'Críticos'}
              </button>
            ))}
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
              <Input value={term} onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar em todos os erros…" />
              <Select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)}>
                <option value="">Todas as bancas</option>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>

              {boardFilter && (boardLoading || boardResults !== null) ? (
                <div style={styles.list}>
                  <p style={styles.crumb}>Erros da banca selecionada</p>
                  {boardLoading ? (
                    <p style={styles.muted}>Carregando…</p>
                  ) : boardResults?.length === 0 ? (
                    <p style={styles.muted}>Nenhum erro nesta banca.</p>
                  ) : boardResults?.map((n) => (
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
                      {loadingSubjects ? (
                        <p style={styles.muted}>Carregando…</p>
                      ) : subjects.length === 0 ? (
                        <div>
                          <p style={styles.muted}>Nenhuma matéria cadastrada ainda.</p>
                          <Link href="/subjects" style={{ display: 'inline-block', marginTop: 10, fontSize: 14, color: theme.teal, fontWeight: 600, textDecoration: 'none' }}>Adicionar matéria →</Link>
                        </div>
                      ) : subjects.map((sub) => (
                        <SubjectPill
                          key={sub.id}
                          color={sub.color}
                          name={sub.name}
                          count={counts[sub.id] ?? 0}
                          active={curSubject?.id === sub.id}
                          onClick={() => openSubject(sub)}
                        />
                      ))}
                    </div>
                  )}

                  {level === 'topics' && curSubject && (
                    <div style={styles.list}>
                      <button onClick={() => { setLevel('subjects'); setCurSubject(null); }} style={styles.back}>← Matérias</button>
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
                      <Button fullWidth onClick={handleNew}>+ Novo erro</Button>
                      {loadingNotes ? (
                        <p style={styles.muted}>Carregando…</p>
                      ) : notes.length === 0 ? (
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
                onScheduleReview={(topicId, days) => scheduleReviewFromError(topicId, days)}
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
      <button onClick={onDelete} style={styles.delBtn} aria-label="Apagar erro"><X size={13} strokeWidth={2} /></button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sub: { fontSize: 14, color: theme.inkSoft, margin: 0, fontWeight: 500 },
  actionsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 },
  addTopBtn: { padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start', width: '100%', minWidth: 0 },
  sidebar: { width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  tabs: { display: 'flex', gap: 4, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 4 },
  tab: { flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  periodRow: { display: 'flex', gap: 6 },
  periodBtn: { flex: 1, padding: '7px 0', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  periodBtnOn: { background: theme.card, borderColor: theme.teal, color: theme.ink, boxShadow: theme.shadow },
  crumb: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, margin: '4px 0', textTransform: 'uppercase', letterSpacing: 0.6 },
  crumbSubject: { fontSize: 15, color: theme.ink, fontWeight: 700, margin: '6px 0 4px', lineHeight: 1.4 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' },
  backToList: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', marginBottom: 14 },
  newBtn: { padding: '11px 14px', width: '100%', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 4, fontFamily: 'inherit' },
  muted: { color: theme.inkFaint, fontSize: 14, lineHeight: 1.5 },
  pageError: { fontSize: 13, color: theme.danger, background: theme.dangerTint, borderRadius: theme.radiusXs, padding: '8px 14px', marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer' },
  navItemName: { fontSize: 14, color: theme.ink, fontWeight: 500, lineHeight: 1.45 },
  critItem: { display: 'flex', flexDirection: 'column', gap: 3, background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer' },
  critAlert: { borderWidth: 1.5, borderColor: theme.crit, background: theme.bg },
  critTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  critName: { fontSize: 14, color: theme.ink, fontWeight: 600, lineHeight: 1.35 },
  critBadge: { fontSize: 10, fontWeight: 700, color: theme.onDanger, background: theme.crit, padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 },
  critSubject: { fontSize: 12, color: theme.inkFaint },
  critStats: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, color: theme.inkSoft },
  critErrors: { fontWeight: 600, color: theme.ink },
  critDot: { color: theme.inkFaint },
  critAcerto: { color: theme.inkSoft },
  item: { position: 'relative', background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '13px 15px', cursor: 'pointer', transition: 'border-color .15s' },
  itemActive: { borderColor: theme.teal, background: theme.tealBg },
  itemTitle: { fontSize: 14, color: theme.ink, fontWeight: 500, paddingRight: 20, lineHeight: 1.4 },
  itemMeta: { marginTop: 6 },
  tag: { fontSize: 11, color: theme.tealDeep, background: theme.tealBg, padding: '2px 8px', borderRadius: 6, fontWeight: 600 },
  delBtn: { position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', opacity: 0.6 },
  main: { flex: '1 1 0', minWidth: 0, maxWidth: '100%', width: '100%', background: theme.card, borderRadius: theme.radius, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, boxShadow: theme.shadow, padding: 24, minHeight: 440, overflowX: 'hidden', boxSizing: 'border-box' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 392, textAlign: 'center' },
};
