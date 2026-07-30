// components/features/caderno/AnotacoesView.tsx
// Aba "Anotações" do hub Caderno: notas livres ricas (resumos, dicas, esquemas)
// por matéria/tópico, sobre o CadernoShell (rail | lista | editor) compartilhado
// com as demais abas. O hub cuida de header/abas e passa `openNotaId` para
// abrir uma nota vinda do deep-link ?nota= ou da aba "Tudo".
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Pencil } from 'lucide-react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import {
  listStudyNotes, getStudyNote, createStudyNote,
  type StudyNoteMeta, type StudyNote, type NotaKind,
} from '@/services/studyNotes.service';
import { CadernoShell } from '@/components/features/caderno/CadernoShell';
import { ItemCard } from '@/components/features/caderno/ItemCard';
import { ListPanel } from '@/components/features/caderno/ListPanel';
import { NotaEditor } from '@/components/features/caderno/NotaEditor';
import { SubjectPill } from '@/components/features/caderno/SubjectPill';
import { KIND_CORES } from '@/components/features/caderno/notaCores';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

const KIND_LABEL: Record<NotaKind, string> = {
  resumo: 'Resumo', dica: 'Dica', esquema: 'Esquema', outro: 'Outro',
};

function ordena(notas: StudyNoteMeta[]): StudyNoteMeta[] {
  return [...notas].sort((a, b) =>
    Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
}

type Filtro = 'all' | 'none' | string;

export function AnotacoesView({ openNotaId }: { openNotaId?: string | null }) {
  const { isMobile } = useUI();
  const toast = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notas, setNotas] = useState<StudyNoteMeta[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('all');
  const [busca, setBusca] = useState('');
  const [notaAberta, setNotaAberta] = useState<StudyNote | null>(null);
  const abrindoRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSubjects(), listStudyNotes()])
      .then(([subs, ns]) => { if (!cancelled) { setSubjects(subs); setNotas(ns); } })
      .catch((e) => { if (!cancelled) { setNotas([]); toast.error(e instanceof Error ? e.message : 'Erro ao carregar o caderno.'); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNota = useCallback(async (id: string) => {
    if (abrindoRef.current) return;
    abrindoRef.current = true;
    try {
      const full = await getStudyNote(id);
      if (full) setNotaAberta(full);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir anotação.');
    } finally {
      abrindoRef.current = false;
    }
  }, [toast]);

  // Deep-link (?nota=) ou clique vindo da aba "Tudo": abre a nota pedida.
  // (setState acontece de forma assíncrona, após o fetch dentro de abrirNota.)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openNotaId) void abrirNota(openNotaId);
  }, [openNotaId, abrirNota]);

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

  // Painel de detalhe nunca fica estruturalmente vazio: com a lista carregada e
  // nada aberto (nem deep-link pendente), abre a primeira nota — padrão Gmail.
  // Mobile fica de fora: lá abrir = trocar de tela.
  useEffect(() => {
    if (isMobile || openNotaId || notaAberta || !notas || notasFiltradas.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seleção derivada da lista carregada (setState é assíncrono, após o fetch)
    void abrirNota(notasFiltradas[0].id);
  }, [isMobile, openNotaId, notaAberta, notas, notasFiltradas, abrirNota]);

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

  const totalNotas = notas?.length ?? 0;

  const rail = (
    <>
      <SubjectPill
        className="touch-target"
        name="Todas"
        count={totalNotas}
        alwaysShowCount
        active={filtro === 'all'}
        onClick={() => setFiltro('all')}
      />
      {subjects.map((sub) => (
        <SubjectPill
          className="touch-target"
          key={sub.id}
          color={sub.color ?? '#C9B8DD'}
          name={sub.name}
          count={countPorMateria.get(sub.id) ?? 0}
          active={filtro === sub.id}
          onClick={() => setFiltro(sub.id)}
        />
      ))}
      {(countPorMateria.get('none') ?? 0) > 0 && (
        <SubjectPill
          className="touch-target"
          name="Sem matéria"
          count={countPorMateria.get('none')}
          active={filtro === 'none'}
          onClick={() => setFiltro('none')}
        />
      )}
    </>
  );

  const lista = (
    <ListPanel
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar no caderno…"
      onNovo={novaNota}
      novoLabel="+ Nova"
    >
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
          const cor = KIND_CORES[n.kind];
          return (
            <ItemCard
              key={n.id}
              title={n.title || 'Sem título'}
              preview={(n.content_text ?? '').trim().slice(0, 130)}
              pinned={n.is_pinned}
              chip={{ label: KIND_LABEL[n.kind], bg: cor.bg, ink: cor.ink }}
              meta={[n.topicName]}
              when={n.updated_at}
              active={notaAberta?.id === n.id}
              onClick={() => abrirNota(n.id)}
            />
          );
        })
      )}
    </ListPanel>
  );

  const detalhe = notaAberta ? (
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
      <Pencil size={34} strokeWidth={1.3} style={{ marginBottom: 8 }} />
      <p style={s.vazioTitulo}>Seu caderno, do seu jeito.</p>
      <p style={s.vazioSub}>
        Escolha uma anotação ao lado — ou crie uma nova. Selecione qualquer trecho
        do texto para transformá-lo em flashcard.
      </p>
      <Button style={{ marginTop: 16 }} onClick={novaNota}>+ Nova anotação</Button>
    </div>
  );

  return (
    <CadernoShell
      rail={rail}
      lista={lista}
      detalhe={detalhe}
      mobileDetalhe={isMobile && notaAberta !== null}
    />
  );
}

const s: Record<string, CSSProperties> = {
  editorVazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: 24, color: theme.inkSoft },
  vazio: { fontSize: 13, color: theme.inkFaint, padding: '16px 4px' },
  vazioBox: { textAlign: 'center', padding: '28px 12px' },
  vazioTitulo: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  vazioSub: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55, maxWidth: 320, margin: '0 auto' },
};
