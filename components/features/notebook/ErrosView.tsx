// components/features/notebook/ErrosView.tsx
// Aba "Erros" do hub Caderno sobre o CadernoShell (rail | lista | editor) —
// mesmo layout das outras abas. O antigo drill-down de 3 níveis (matéria →
// tópico → erros espremido na sidebar de 300px, com o painel grande vazio)
// virou filtros compostos: rail plano de matérias com contadores + visões
// Recentes/Críticos + selects de tópico/banca. Filtros não se limpam entre si;
// a lista vive na coluna central e o editor abre o primeiro erro sozinho.
// O hub cuida de header/abas e passa `openNoteId` (deep-link da aba "Tudo").
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateReviewCounts } from '@/lib/review-counts';
import Link from 'next/link';
import { ClipboardX } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { listNotes, getNote, deleteNote, listCriticalTopics, listBoards, type ErrorNote, type CriticalTopic } from '@/services/notebook.service';
import { listActiveWithColor, type SubjectColorOption } from '@/services/subjects.service';
import { listLeaves as listTopicOptions, type PickerOption } from '@/services/topics.service';
import { scheduleReviewFromError } from '@/services/reviews.service';
import { NoteEditor } from '@/components/features/notebook/NoteEditor';
import { CadernoShell } from '@/components/features/caderno/CadernoShell';
import { ItemCard } from '@/components/features/caderno/ItemCard';
import { ListPanel } from '@/components/features/caderno/ListPanel';
import { SubjectPill } from '@/components/features/caderno/SubjectPill';
import { cutoffDaysAgo } from '@/lib/relative-time';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Modo = 'todos' | 'recentes' | 'criticos';
type Periodo = '7' | '15' | '30';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
];

export function ErrosView({ openNoteId }: { openNoteId?: string | null }) {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [subjects, setSubjects] = useState<SubjectColorOption[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string; color: string }[]>([]);
  const [erros, setErros] = useState<ErrorNote[] | null>(null);
  const [criticals, setCriticals] = useState<CriticalTopic[]>([]);
  const [topics, setTopics] = useState<PickerOption[]>([]);

  const [filtroMateria, setFiltroMateria] = useState<'all' | 'none' | string>('all');
  const [filtroTopico, setFiltroTopico] = useState<'' | 'none' | string>('');
  const [filtroBanca, setFiltroBanca] = useState('');
  const [modo, setModo] = useState<Modo>('todos');
  const [periodo, setPeriodo] = useState<Periodo>('7');
  const [busca, setBusca] = useState('');

  const [selected, setSelected] = useState<ErrorNote | null>(null);
  const [creating, setCreating] = useState(false);
  // Bump força remount do editor no "Cancelar" (descarta alterações não salvas).
  const [editorEpoch, setEditorEpoch] = useState(0);
  const loadingSubjectIdRef = useRef<string | null>(null);

  const recarregar = useCallback(async () => {
    const [ns, cs] = await Promise.all([listNotes(), listCriticalTopics()]);
    setErros(ns);
    setCriticals(cs);
    return ns;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listActiveWithColor(), listBoards(), listNotes(), listCriticalTopics()])
      .then(([subs, bs, ns, cs]) => {
        if (cancelled) return;
        setSubjects(subs); setBoards(bs); setErros(ns); setCriticals(cs);
      })
      .catch((e) => {
        if (cancelled) return;
        setErros([]);
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar o caderno de erros.');
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre um erro específico (deep-link da aba "Tudo").
  useEffect(() => {
    if (!openNoteId) return;
    let cancelled = false;
    getNote(openNoteId).then((n) => {
      if (cancelled || !n) return;
      setSelected(n);
      setCreating(false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [openNoteId]);

  // Tópicos da matéria filtrada (para o select e para nomear tópicos nos cards).
  // O reset de filtroTopico fica nos handlers (mudarMateria), NÃO aqui: um effect
  // rodaria depois de abrirCritico e apagaria o tópico que ele acabou de definir.
  useEffect(() => {
    if (filtroMateria === 'all' || filtroMateria === 'none') { setTopics([]); return; }
    loadingSubjectIdRef.current = filtroMateria;
    listTopicOptions(filtroMateria)
      .then((ts) => { if (loadingSubjectIdRef.current === filtroMateria) setTopics(ts); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar tópicos.'));
  }, [filtroMateria, toast]);

  function mudarMateria(m: 'all' | 'none' | string) {
    setFiltroMateria(m);
    setFiltroTopico('');
  }

  const subjectNameById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const boardNameById = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards]);
  const topicNameById = useMemo(() => new Map(topics.map((t) => [t.id, t.name])), [topics]);

  const countPorMateria = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of erros ?? []) {
      const k = n.subject_id ?? 'none';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [erros]);

  const errosFiltrados = useMemo(() => {
    let out = erros ?? [];
    if (filtroMateria === 'none') out = out.filter((n) => !n.subject_id);
    else if (filtroMateria !== 'all') out = out.filter((n) => n.subject_id === filtroMateria);
    if (filtroTopico === 'none') out = out.filter((n) => !n.topic_id);
    else if (filtroTopico) out = out.filter((n) => n.topic_id === filtroTopico);
    if (filtroBanca) out = out.filter((n) => n.board_id === filtroBanca);
    if (modo === 'recentes') {
      const corte = cutoffDaysAgo(Number(periodo));
      out = out.filter((n) => new Date(n.created_at).getTime() >= corte);
    }
    const termo = busca.trim().toLowerCase();
    if (termo) {
      out = out.filter((n) =>
        (n.title ?? '').toLowerCase().includes(termo)
        || (n.content_text ?? '').toLowerCase().includes(termo));
    }
    return out;
  }, [erros, filtroMateria, filtroTopico, filtroBanca, modo, periodo, busca]);

  const criticalsFiltrados = useMemo(() => {
    if (filtroMateria === 'all') return criticals;
    if (filtroMateria === 'none') return [];
    return criticals.filter((c) => c.subjectId === filtroMateria);
  }, [criticals, filtroMateria]);

  // Painel de detalhe nunca fica estruturalmente vazio: com a lista carregada e
  // nada aberto, abre o primeiro erro (padrão Gmail). Mobile fica de fora — lá
  // abrir significa trocar de tela.
  useEffect(() => {
    if (isMobile || openNoteId || selected || creating || modo === 'criticos') return;
    if (!erros || errosFiltrados.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seleção derivada da lista carregada
    setSelected(errosFiltrados[0]);
  }, [isMobile, openNoteId, selected, creating, modo, erros, errosFiltrados]);

  function abrirCritico(c: CriticalTopic) {
    setModo('todos');
    setFiltroMateria(c.subjectId);
    setFiltroTopico(c.topicId);
  }

  function handleNovo() {
    setSelected(null);
    setCreating(true);
  }

  async function handleSaved() {
    toast.success('Erro salvo no caderno.');
    try {
      const fresh = await recarregar();
      if (creating) {
        setCreating(false);
        setSelected(fresh[0] ?? null);
      } else if (selected) {
        setSelected(fresh.find((n) => n.id === selected.id) ?? null);
      }
    } catch {
      // lista fica como está; o save em si já foi confirmado
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Apagar este erro?', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteNote(id);
      toast.success('Erro apagado.');
      setSelected(null);
      setCreating(false);
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao apagar a anotação. Tente novamente.');
    }
  }

  function handleCancel() {
    if (creating) { setCreating(false); return; }
    // Descartar alterações do erro aberto: remonta o editor no estado salvo.
    setEditorEpoch((e) => e + 1);
  }

  function acColor(pct: number): string {
    if (pct >= 75) return theme.ok;
    if (pct >= 50) return theme.warn;
    return theme.crit;
  }

  const totalErros = erros?.length ?? 0;

  const rail = (
    <>
      <SubjectPill
        className="touch-target"
        name="Todos"
        count={totalErros}
        alwaysShowCount
        active={filtroMateria === 'all'}
        onClick={() => mudarMateria('all')}
      />
      {subjects.map((sub) => (
        <SubjectPill
          className="touch-target"
          key={sub.id}
          color={sub.color}
          name={sub.name}
          count={countPorMateria.get(sub.id) ?? 0}
          active={filtroMateria === sub.id}
          onClick={() => mudarMateria(sub.id)}
        />
      ))}
      {(countPorMateria.get('none') ?? 0) > 0 && (
        <SubjectPill
          className="touch-target"
          name="Sem matéria"
          count={countPorMateria.get('none')}
          active={filtroMateria === 'none'}
          onClick={() => mudarMateria('none')}
        />
      )}
      {subjects.length === 0 && erros !== null && (
        <Link href="/subjects" style={s.railLink}>Adicionar matéria →</Link>
      )}
      <span style={s.railCrumb}>Visões</span>
      <SubjectPill
        className="touch-target"
        name="Recentes"
        active={modo === 'recentes'}
        onClick={() => setModo(modo === 'recentes' ? 'todos' : 'recentes')}
      />
      <SubjectPill
        className="touch-target"
        name="Críticos"
        color={theme.crit}
        count={criticals.length}
        active={modo === 'criticos'}
        onClick={() => setModo(modo === 'criticos' ? 'todos' : 'criticos')}
      />
    </>
  );

  const materiEspecifica = filtroMateria !== 'all' && filtroMateria !== 'none';

  const extraTools = modo === 'criticos' ? null : (
    <div style={s.filtrosRow}>
      {materiEspecifica && topics.length > 0 && (
        <Select value={filtroTopico} onChange={(e) => setFiltroTopico(e.target.value)} style={{ flex: '1 1 0', minWidth: 120, fontSize: 13 }} aria-label="Filtrar por tópico">
          <option value="">Todos os tópicos</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="none">Sem tópico</option>
        </Select>
      )}
      <Select value={filtroBanca} onChange={(e) => setFiltroBanca(e.target.value)} style={{ flex: '1 1 0', minWidth: 120, fontSize: 13 }} aria-label="Filtrar por banca">
        <option value="">Todas as bancas</option>
        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      {modo === 'recentes' && (
        <SegmentedControl options={PERIODOS} value={periodo} onChange={setPeriodo} equalWidth={false} />
      )}
    </div>
  );

  const lista = (
    <ListPanel
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar nos erros…"
      onNovo={handleNovo}
      novoLabel="+ Novo"
      extraTools={extraTools}
    >
      {erros === null ? (
        <p style={s.vazio}>Abrindo seu caderno de erros…</p>
      ) : modo === 'criticos' ? (
        criticalsFiltrados.length === 0 ? (
          <p style={s.muted}>Nenhum erro com tópico ainda. Registre erros vinculados a tópicos para ver suas prioridades.</p>
        ) : criticalsFiltrados.map((c) => (
          <div key={c.topicId} onClick={() => abrirCritico(c)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirCritico(c); } }}
            className="caderno-item-card"
            style={{ ...s.critItem, ...(c.isAlert ? s.critAlert : {}) }}>
            <div style={s.critTop}>
              <span style={s.critName}>{c.topicName}</span>
              {c.isAlert && <span style={s.critBadge}>crítico</span>}
            </div>
            <span style={s.critSubject}>{c.subjectName}</span>
            <div style={s.critStats}>
              <span style={s.critErrors}>{c.errorCount} {c.errorCount === 1 ? 'erro' : 'erros'}</span>
              <span style={s.critDot}>·</span>
              <span style={s.critAcerto}>
                {c.acertoPct === null ? '— acerto' : (
                  <>acerto <b style={{ color: acColor(c.acertoPct) }}>{c.acertoPct}%</b></>
                )}
              </span>
            </div>
          </div>
        ))
      ) : errosFiltrados.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={s.vazioTitulo}>{busca ? 'Nada encontrado.' : 'Nenhum erro aqui ainda.'}</p>
          {!busca && (
            <p style={s.vazioSub}>Registre o que você errou — com matéria, tópico e banca — e ataque os críticos. Comece com “+ Novo”.</p>
          )}
        </div>
      ) : (
        errosFiltrados.map((n) => (
          <ItemCard
            key={n.id}
            title={n.title || '(sem título)'}
            preview={(n.content_text ?? '').trim().slice(0, 130)}
            chip={{ label: n.error_type ?? 'Erro', bg: theme.clayBg, ink: theme.clayDeep }}
            meta={[
              filtroMateria === 'all' ? (n.subject_id ? subjectNameById.get(n.subject_id) : null) : (n.topic_id ? topicNameById.get(n.topic_id) : null),
              n.board_id ? boardNameById.get(n.board_id) : null,
            ]}
            when={n.updated_at}
            active={!creating && selected?.id === n.id}
            onClick={() => { setCreating(false); setSelected(n); }}
          />
        ))
      )}
    </ListPanel>
  );

  const detalhe = (creating || selected) ? (
    <>
      {isMobile && (
        <button onClick={() => { setSelected(null); setCreating(false); }} style={s.backToList}>
          ← Voltar à lista
        </button>
      )}
      <NoteEditor
        key={creating ? 'novo' : `${selected!.id}-${editorEpoch}`}
        note={creating ? null : selected}
        presetSubjectId={creating && materiEspecifica ? filtroMateria : null}
        presetTopicId={creating && filtroTopico && filtroTopico !== 'none' ? filtroTopico : null}
        onSaved={handleSaved}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onScheduleReview={async (topicId, days) => {
          await scheduleReviewFromError(topicId, days);
          // Agendar revisão pelo erro ativa o tópico na fila — o Plano de Hoje
          // precisa recontar (ver lib/review-counts.ts).
          invalidateReviewCounts(queryClient);
        }}
      />
    </>
  ) : (
    <div style={s.editorVazio}>
      <ClipboardX size={34} strokeWidth={1.3} style={{ marginBottom: 8 }} />
      <p style={s.vazioTitulo}>Erro registrado é erro que não se repete.</p>
      <p style={s.vazioSub}>
        Selecione um erro ao lado para revisar — ou registre um novo com matéria,
        tópico e banca.
      </p>
      <Button style={{ marginTop: 16 }} onClick={handleNovo}>+ Novo erro</Button>
    </div>
  );

  return (
    <>
      {dialog}
      <CadernoShell
        rail={rail}
        lista={lista}
        detalhe={detalhe}
        mobileDetalhe={isMobile && (creating || selected !== null)}
      />
    </>
  );
}

const s: Record<string, CSSProperties> = {
  railCrumb: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, padding: '10px 10px 2px', flexShrink: 0, alignSelf: 'center' },
  railLink: { display: 'inline-block', padding: '8px 10px', fontSize: 13, color: theme.teal, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' },
  filtrosRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },

  vazio: { fontSize: 13, color: theme.inkFaint, padding: '16px 4px' },
  muted: { color: theme.inkFaint, fontSize: 14, lineHeight: 1.5, padding: '8px 4px' },
  vazioBox: { textAlign: 'center', padding: '28px 12px' },
  vazioTitulo: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  vazioSub: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, maxWidth: 320, margin: '0 auto' },
  editorVazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: 24, color: theme.inkSoft },

  critItem: { display: 'flex', flexDirection: 'column', gap: 3, background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, padding: '11px 13px', cursor: 'pointer' },
  critAlert: { borderWidth: 1.5, borderColor: theme.crit, background: theme.bg },
  critTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  critName: { fontSize: 14, color: theme.ink, fontWeight: 600, lineHeight: 1.35 },
  critBadge: { fontSize: 10, fontWeight: 700, color: theme.onDanger, background: theme.crit, padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 },
  critSubject: { fontSize: 12, color: theme.inkFaint },
  critStats: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, color: theme.inkSoft },
  critErrors: { fontWeight: 600, color: theme.ink },
  critDot: { color: theme.inkFaint },
  critAcerto: { color: theme.inkSoft },

  backToList: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', marginBottom: 14 },
};
