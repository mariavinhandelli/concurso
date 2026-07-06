// app/(app)/caderno/page.tsx
// Caderno de Anotações: resumos, dicas e esquemas organizados por matéria —
// o lugar único que substitui o caderno físico/Notion. Layout em 3 painéis
// (matérias → notas → editor); no mobile vira navegação em níveis.
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { listSubjects, type Subject } from '@/services/subjects.service';
import {
  listStudyNotes, getStudyNote, createStudyNote,
  type StudyNoteMeta, type StudyNote, type NotaKind,
} from '@/services/studyNotes.service';
import { NotaEditor, KIND_CORES } from '@/components/features/caderno/NotaEditor';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

const KIND_LABEL: Record<NotaKind, string> = {
  resumo: 'Resumo', dica: 'Dica', esquema: 'Esquema', outro: 'Outro',
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function ordena(notas: StudyNoteMeta[]): StudyNoteMeta[] {
  return [...notas].sort((a, b) =>
    Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
}

type Filtro = 'all' | 'none' | string;

// Isolado no Suspense — só lê ?nota= pra abrir direto (ex.: vindo da página
// do tópico) sem bloquear a renderização do resto da página.
function NotaDeepLink({ onFound }: { onFound: (id: string) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const id = params.get('nota');
    if (id) {
      onFound(id);
      window.history.replaceState(null, '', '/caderno');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  return null;
}

export default function CadernoPage() {
  const { isMobile } = useUI();
  const toast = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notas, setNotas] = useState<StudyNoteMeta[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('all');
  const [busca, setBusca] = useState('');
  const [notaAberta, setNotaAberta] = useState<StudyNote | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSubjects(), listStudyNotes()])
      .then(([subs, ns]) => { if (!cancelled) { setSubjects(subs); setNotas(ns); } })
      .catch((e) => { if (!cancelled) { setNotas([]); toast.error(e instanceof Error ? e.message : 'Erro ao carregar o caderno.'); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countPorMateria = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notas ?? []) {
      const k = n.subject_id ?? 'none';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [notas]);

  const notasFiltradas = useMemo(() => {
    let out = notas ?? [];
    if (filtro === 'none') out = out.filter((n) => !n.subject_id);
    else if (filtro !== 'all') out = out.filter((n) => n.subject_id === filtro);
    const termo = busca.trim().toLowerCase();
    if (termo) {
      out = out.filter((n) =>
        n.title.toLowerCase().includes(termo)
        || (n.content_text ?? '').toLowerCase().includes(termo));
    }
    return out;
  }, [notas, filtro, busca]);

  async function abrirNota(id: string) {
    if (notaAberta?.id === id || abrindo) return;
    setAbrindo(true);
    try {
      const full = await getStudyNote(id);
      if (full) setNotaAberta(full);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir anotação.');
    } finally {
      setAbrindo(false);
    }
  }

  async function novaNota() {
    try {
      const criada = await createStudyNote({
        subjectId: filtro !== 'all' && filtro !== 'none' ? filtro : null,
      });
      setNotas((prev) => ordena([{ ...criada }, ...(prev ?? [])]));
      setNotaAberta(criada);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar anotação.');
    }
  }

  const handlePatched = useCallback((id: string, patch: Partial<StudyNote>) => {
    setNotas((prev) => prev ? ordena(prev.map((n) => (n.id === id ? { ...n, ...patch } as StudyNoteMeta : n))) : prev);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setNotas((prev) => prev ? prev.filter((n) => n.id !== id) : prev);
    setNotaAberta(null);
  }, []);

  const mostrarEditorMobile = isMobile && notaAberta !== null;
  const totalNotas = notas?.length ?? 0;

  // ── Painel 1: matérias (coluna no desktop; chips horizontais no mobile) ──
  const painelMaterias = (
    <div style={{ ...s.painelMaterias, ...(isMobile ? s.painelMateriasMobile : {}) }}>
      <button
        className="touch-target"
        onClick={() => setFiltro('all')}
        style={{ ...s.materiaItem, ...(filtro === 'all' ? s.materiaItemOn : {}) }}
      >
        <span style={s.materiaNome}>Todas</span>
        <span style={s.materiaCount}>{totalNotas}</span>
      </button>
      {subjects.map((sub) => {
        const n = countPorMateria.get(sub.id) ?? 0;
        return (
          <button
            className="touch-target"
            key={sub.id}
            onClick={() => setFiltro(sub.id)}
            style={{ ...s.materiaItem, ...(filtro === sub.id ? s.materiaItemOn : {}) }}
          >
            <span style={{ ...s.materiaDot, background: sub.color ?? '#C9B8DD' }} />
            <span style={s.materiaNome}>{sub.name}</span>
            {n > 0 && <span style={s.materiaCount}>{n}</span>}
          </button>
        );
      })}
      {(countPorMateria.get('none') ?? 0) > 0 && (
        <button
          onClick={() => setFiltro('none')}
          style={{ ...s.materiaItem, ...(filtro === 'none' ? s.materiaItemOn : {}) }}
        >
          <span style={s.materiaNome}>Sem matéria</span>
          <span style={s.materiaCount}>{countPorMateria.get('none')}</span>
        </button>
      )}
    </div>
  );

  // ── Painel 2: lista de notas ──
  const painelNotas = (
    <div style={s.painelNotas}>
      <div style={s.notasTools}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar no caderno…"
          style={s.buscaInput}
          aria-label="Buscar anotações"
        />
        <button className="touch-target" onClick={novaNota} style={s.novaBtn} title="Nova anotação">+ Nova</button>
      </div>

      {notas === null ? (
        <p style={s.vazio}>Abrindo seu caderno…</p>
      ) : notasFiltradas.length === 0 ? (
        <div style={s.vazioBox}>
          <p style={s.vazioTitulo}>{busca ? 'Nada encontrado.' : 'Nenhuma anotação aqui ainda.'}</p>
          {!busca && (
            <p style={s.vazioSub}>Resumos, dicas e esquemas — tudo num lugar só. Comece com “+ Nova”.</p>
          )}
        </div>
      ) : (
        notasFiltradas.map((n) => {
          const ativa = notaAberta?.id === n.id;
          const cor = KIND_CORES[n.kind];
          const preview = (n.content_text ?? '').trim().slice(0, 130);
          return (
            <button
              key={n.id}
              onClick={() => abrirNota(n.id)}
              style={{ ...s.notaCard, ...(ativa ? s.notaCardOn : {}) }}
            >
              <span style={s.notaTitulo}>
                {n.is_pinned && <span title="Fixada">📌 </span>}
                {n.title || 'Sem título'}
              </span>
              {preview && <span style={s.notaPreview}>{preview}</span>}
              <span style={s.notaMetaRow}>
                <span style={{ ...s.notaKind, background: cor.bg, color: cor.ink }}>{KIND_LABEL[n.kind]}</span>
                {n.topicName && <span style={s.notaTopico}>{n.topicName}</span>}
                <span style={s.notaQuando}>{fmtRelative(n.updated_at)}</span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  // ── Painel 3: editor ──
  const painelEditor = notaAberta ? (
    <NotaEditor
      key={notaAberta.id}
      nota={notaAberta}
      subjects={subjects}
      onPatched={handlePatched}
      onDeleted={handleDeleted}
      onVoltar={isMobile ? () => setNotaAberta(null) : undefined}
    />
  ) : (
    <div style={s.editorVazio}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>✎</div>
      <p style={s.vazioTitulo}>Seu caderno, do seu jeito.</p>
      <p style={s.vazioSub}>
        Escolha uma anotação ao lado — ou crie uma nova. Selecione qualquer trecho
        do texto para transformá-lo em flashcard.
      </p>
      <button onClick={novaNota} style={s.novaBtnGrande}>+ Nova anotação</button>
    </div>
  );

  return (
    <div style={{ ...s.wrap, padding: isMobile ? '16px 12px' : '28px 32px' }}>
      <Suspense fallback={null}><NotaDeepLink onFound={abrirNota} /></Suspense>

      <div style={s.head}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : 28 }}>Caderno</h1>
        <p style={s.sub}>Resumos, dicas e esquemas — organizados por matéria, sempre à mão.</p>
      </div>

      {isMobile ? (
        mostrarEditorMobile ? (
          <div style={s.mobileEditor}>{painelEditor}</div>
        ) : (
          <>
            <div style={s.mobileMaterias}>{painelMaterias}</div>
            {painelNotas}
          </>
        )
      ) : (
        <div style={s.grid}>
          {painelMaterias}
          {painelNotas}
          <div style={s.painelEditor}>{painelEditor}</div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1240, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  head: { marginBottom: 18 },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 13.5, color: theme.inkSoft, margin: '4px 0 0' },

  grid: {
    display: 'grid', gridTemplateColumns: '208px 300px minmax(0, 1fr)', gap: 14,
    height: 'calc(100vh - 205px)', minHeight: 480,
  },

  painelMaterias: { display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', paddingRight: 2 },
  painelMateriasMobile: { flexDirection: 'row', overflowX: 'auto', overflowY: 'visible', gap: 6, paddingBottom: 4 },
  materiaItem: { display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0, flexShrink: 0, whiteSpace: 'nowrap' },
  materiaItemOn: { background: theme.tealBg },
  materiaDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  materiaNome: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  materiaCount: { fontSize: 11.5, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },

  painelNotas: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 2, minWidth: 0 },
  notasTools: { display: 'flex', gap: 8, position: 'sticky', top: 0, background: theme.bg, paddingBottom: 2, zIndex: 1 },
  buscaInput: { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  novaBtn: { padding: '9px 14px', borderRadius: 10, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },

  notaCard: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 12, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 },
  notaCardOn: { borderColor: theme.teal, background: theme.tealBg },
  notaTitulo: { fontSize: 13.5, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  notaPreview: { fontSize: 12, color: theme.inkSoft, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' },
  notaMetaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, minWidth: 0 },
  notaKind: { fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', flexShrink: 0 },
  notaTopico: { fontSize: 11, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  notaQuando: { fontSize: 11, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },

  painelEditor: { overflowY: 'auto', paddingRight: 4, minWidth: 0 },
  editorVazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: 24, color: theme.inkSoft },
  vazio: { fontSize: 13, color: theme.inkFaint, padding: '16px 4px' },
  vazioBox: { textAlign: 'center', padding: '28px 12px' },
  vazioTitulo: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  vazioSub: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, maxWidth: 320, margin: '0 auto' },
  novaBtnGrande: { marginTop: 16, padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  mobileMaterias: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 6 },
  mobileEditor: { minWidth: 0 },
};
