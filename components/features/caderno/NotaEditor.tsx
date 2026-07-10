// components/features/caderno/NotaEditor.tsx
// Painel de edição de uma anotação: título inline grande, metadados discretos
// (matéria/tópico/tipo/fixar) e editor Tiptap com AUTO-SAVE (debounce 1.2s +
// flush no unmount — nunca existe botão "Salvar" pra esquecer).
// IMPORTANTE: montar com key={nota.id} — o Tiptap só lê initialContent no mount.
'use client';

import { useEffect, useRef, useState } from 'react';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FlashcardModal } from '@/components/features/notebook/FlashcardModal';
import {
  updateStudyNote, deleteStudyNote, NOTA_KINDS,
  type StudyNote, type NotaKind, type StudyNotePatch,
} from '@/services/studyNotes.service';
import { listTopics, type Topic } from '@/services/topics.service';
import type { Subject } from '@/services/subjects.service';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { KIND_CORES } from './notaCores';

type SaveStatus = 'salvo' | 'pendente' | 'salvando' | 'erro';

interface Props {
  nota: StudyNote;
  subjects: Subject[];
  onPatched: (id: string, patch: Partial<StudyNote>) => void;
  onDeleted: (id: string) => void;
  onVoltar?: () => void; // mobile: volta pra lista
}

export function NotaEditor({ nota, subjects, onPatched, onDeleted, onVoltar }: Props) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [title, setTitle] = useState(nota.title);
  const [kind, setKind] = useState<NotaKind>(nota.kind);
  const [subjectId, setSubjectId] = useState(nota.subject_id ?? '');
  const [topicId, setTopicId] = useState(nota.topic_id ?? '');
  const [isPinned, setIsPinned] = useState(nota.is_pinned);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [status, setStatus] = useState<SaveStatus>('salvo');
  const [flashcardText, setFlashcardText] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(() =>
    (nota.content_text ?? '').trim() ? (nota.content_text ?? '').trim().split(/\s+/).length : 0);

  // O conteúdo mais recente vive em refs — o Tiptap é a fonte de verdade e
  // salvar num estado React a cada tecla re-renderizaria o editor inteiro.
  const contentRef = useRef<{ json: object; text: string } | null>(null);
  const pendingRef = useRef<StudyNotePatch>({});
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tópicos da matéria selecionada.
  useEffect(() => {
    if (!subjectId) { setTopics([]); return; }
    let cancelled = false;
    listTopics(subjectId)
      .then((t) => { if (!cancelled) setTopics(t); })
      .catch(() => { if (!cancelled) setTopics([]); });
    return () => { cancelled = true; };
  }, [subjectId]);

  async function saveNow() {
    if (!dirtyRef.current) return;
    const patch = { ...pendingRef.current };
    pendingRef.current = {};
    dirtyRef.current = false;
    setStatus('salvando');
    try {
      await updateStudyNote(nota.id, patch);
      setStatus(dirtyRef.current ? 'pendente' : 'salvo');
      onPatched(nota.id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.subjectId !== undefined ? { subject_id: patch.subjectId } : {}),
        ...(patch.topicId !== undefined ? { topic_id: patch.topicId } : {}),
        ...(patch.isPinned !== undefined ? { is_pinned: patch.isPinned } : {}),
        ...(patch.contentText !== undefined ? { content_text: patch.contentText } : {}),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // devolve o patch pra fila — a próxima edição tenta de novo
      pendingRef.current = { ...patch, ...pendingRef.current };
      dirtyRef.current = true;
      setStatus('erro');
    }
  }

  function queue(patch: StudyNotePatch, delay = 1200) {
    pendingRef.current = { ...pendingRef.current, ...patch };
    dirtyRef.current = true;
    setStatus('pendente');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveNow(); }, delay);
  }

  // Flush no unmount (troca de nota / saída da página) — nada se perde.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) void saveNow();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEditorChange(json: object, text: string) {
    contentRef.current = { json, text };
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    queue({ content: json, contentText: text });
  }

  async function handleDelete() {
    if (!await confirm({
      title: 'Excluir esta anotação?',
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    })) return;
    try {
      dirtyRef.current = false; // não tenta salvar uma nota que está sendo excluída
      await deleteStudyNote(nota.id);
      onDeleted(nota.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  const statusInfo: Record<SaveStatus, { label: string; color: string }> = {
    salvo:    { label: '✓ salvo', color: theme.ok },
    pendente: { label: '· editando…', color: theme.inkFaint },
    salvando: { label: 'salvando…', color: theme.inkFaint },
    erro:     { label: '⚠ erro ao salvar — tentando de novo', color: theme.danger },
  };

  return (
    <div style={s.wrap}>
      {dialog}

      <div style={s.headRow}>
        {onVoltar && (
          <button onClick={onVoltar} style={s.voltar} aria-label="Voltar para a lista">←</button>
        )}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value }); }}
          placeholder="Título da anotação…"
          style={s.titleInput}
          aria-label="Título da anotação"
        />
        <span style={{ ...s.status, color: statusInfo[status].color }}>{statusInfo[status].label}</span>
      </div>

      <div style={s.metaRow}>
        <select
          value={subjectId}
          onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); queue({ subjectId: e.target.value || null, topicId: null }, 300); }}
          style={s.metaSelect}
          aria-label="Matéria"
        >
          <option value="">Sem matéria</option>
          {subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
        </select>

        <select
          value={topicId}
          onChange={(e) => { setTopicId(e.target.value); queue({ topicId: e.target.value || null }, 300); }}
          style={s.metaSelect}
          disabled={!subjectId || topics.length === 0}
          aria-label="Tópico"
        >
          <option value="">Sem tópico</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <div style={s.kindGroup}>
          {NOTA_KINDS.map((k) => {
            const on = kind === k.value;
            const cor = KIND_CORES[k.value];
            return (
              <button
                key={k.value}
                onClick={() => { setKind(k.value); queue({ kind: k.value }, 300); }}
                style={{ ...s.kindChip, ...(on ? { background: cor.bg, color: cor.ink, borderColor: 'transparent', fontWeight: 700 } : {}) }}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={async () => { await saveNow(); window.open(`/nota-pdf/${nota.id}`, '_blank'); }}
          style={s.iconBtn}
          title="Exportar em PDF"
          aria-label="Exportar em PDF"
        >
          ⭳
        </button>
        <button
          onClick={() => { const v = !isPinned; setIsPinned(v); queue({ isPinned: v }, 300); }}
          style={{ ...s.iconBtn, ...(isPinned ? s.iconBtnOn : {}) }}
          title={isPinned ? 'Desafixar' : 'Fixar no topo'}
          aria-label={isPinned ? 'Desafixar' : 'Fixar no topo'}
        >
          📌
        </button>
        <button onClick={handleDelete} style={s.iconBtn} title="Excluir anotação" aria-label="Excluir anotação">🗑</button>
      </div>

      <RichTextEditor
        initialContent={nota.content}
        onChange={handleEditorChange}
        onCreateFlashcard={(text) => setFlashcardText(text)}
        placeholder="Escreva seu resumo, dica ou esquema… (selecione um trecho para virar flashcard; cole prints com Ctrl+V)"
      />

      <p style={s.footInfo}>
        {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
      </p>

      {flashcardText !== null && (
        <FlashcardModal
          frontText={flashcardText}
          sourceErrorId={null}
          subjectId={subjectId || null}
          topicId={topicId || null}
          onClose={() => setFlashcardText(null)}
          onCreated={() => { setFlashcardText(null); toast.success('Flashcard criado a partir da anotação.'); }}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: theme.font },
  headRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  voltar: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: '0 4px', flexShrink: 0 },
  titleInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 22, fontWeight: 700, color: theme.ink, fontFamily: 'inherit', padding: 0 },
  status: { fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  metaSelect: { maxWidth: 190, padding: '6px 8px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 12.5, color: theme.inkSoft, fontFamily: 'inherit', outline: 'none' },
  kindGroup: { display: 'flex', gap: 4 },
  kindChip: { padding: '5px 11px', borderRadius: 999, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: 'transparent', color: theme.inkFaint, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, opacity: 0.75 },
  iconBtnOn: { borderColor: theme.teal, background: theme.tealBg, opacity: 1 },
  footInfo: { fontSize: 11.5, color: theme.inkFaint, margin: '8px 2px 0', textAlign: 'right' },
};
