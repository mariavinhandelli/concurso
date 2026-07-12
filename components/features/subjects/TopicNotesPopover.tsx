// components/features/subjects/TopicNotesPopover.tsx
// Anotações vinculadas a um tópico — acessível pelo ícone de nota na linha do
// tópico. Lista as notas existentes (abre no Caderno via deep-link ?nota=) e
// permite criar uma nova já vinculada a este tópico/matéria.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  listNotesByTopic, createStudyNote, NOTA_KINDS,
  type StudyNoteMeta,
} from '@/services/studyNotes.service';
import { KIND_CORES } from '@/components/features/caderno/notaCores';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { IconButton } from '@/components/ui/IconButton';
import type { Topic } from '@/services/topics.service';

const KIND_LABEL = Object.fromEntries(NOTA_KINDS.map((k) => [k.value, k.label]));

interface Props {
  topic: Topic;
  subjectId: string;
  onClose: () => void;
  onChanged: () => void; // recarrega a contagem na linha do tópico
}

export function TopicNotesPopover({ topic, subjectId, onClose, onChanged }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [notas, setNotas] = useState<StudyNoteMeta[] | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listNotesByTopic(topic.id)
      .then((n) => { if (!cancelled) setNotas(n); })
      .catch(() => { if (!cancelled) setNotas([]); });
    return () => { cancelled = true; };
  }, [topic.id]);

  function abrirNota(id: string) {
    router.push(`/caderno?nota=${id}`);
  }

  async function novaNota() {
    setCriando(true);
    try {
      const nota = await createStudyNote({ subjectId, topicId: topic.id });
      onChanged();
      router.push(`/caderno?nota=${nota.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar anotação.');
      setCriando(false);
    }
  }

  return (
    <Overlay onClose={onClose} maxWidth={440} labelledBy="topic-notes-title" padding={0} hideClose>
        <div style={s.head}>
          <div style={{ minWidth: 0 }}>
            <span style={s.eyebrow}>Anotações do tópico</span>
            <h2 id="topic-notes-title" style={s.h2}>{topic.name}</h2>
          </div>
          <IconButton onClick={onClose} aria-label="Fechar" size="sm" style={{ fontSize: 15, flexShrink: 0 }}>✕</IconButton>
        </div>

        <div style={s.body}>
          {notas === null ? (
            <p style={s.muted}>Carregando…</p>
          ) : notas.length === 0 ? (
            <p style={s.muted}>Nenhuma anotação vinculada a este tópico ainda.</p>
          ) : (
            <div style={s.lista}>
              {notas.map((n) => {
                const cor = KIND_CORES[n.kind];
                return (
                  <button key={n.id} onClick={() => abrirNota(n.id)} style={s.item}>
                    <span style={s.itemTitulo}>{n.title || 'Sem título'}</span>
                    {n.content_text && <span style={s.itemPreview}>{n.content_text.slice(0, 90)}</span>}
                    <span style={{ ...s.itemKind, background: cor.bg, color: cor.ink }}>{KIND_LABEL[n.kind]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={s.actions}>
          <button onClick={novaNota} disabled={criando} style={s.novaBtn}>
            {criando ? 'Criando…' : '+ Nova anotação'}
          </button>
        </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px' },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  h2: { fontSize: 17, fontWeight: 700, color: theme.ink, margin: '3px 0 0', lineHeight: 1.35 },
  body: { overflowY: 'auto', padding: '0 20px 12px' },
  muted: { fontSize: 13, color: theme.inkFaint, padding: '8px 0 16px' },
  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.bg, cursor: 'pointer', fontFamily: 'inherit' },
  itemTitulo: { fontSize: 14, fontWeight: 700, color: theme.ink },
  itemPreview: { fontSize: 12, color: theme.inkSoft, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' },
  itemKind: { fontSize: 10, fontWeight: 700, borderRadius: theme.radiusPill, padding: '2px 8px', alignSelf: 'flex-start', marginTop: 2 },
  actions: { padding: '12px 20px 18px', borderTop: `0.5px solid ${theme.line}` },
  novaBtn: { width: '100%', padding: '10px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
