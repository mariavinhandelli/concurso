// components/features/schedule/BlockModal.tsx
// Cria ou edita um bloco manual. Sem editBlock = cria; com editBlock = pré-preenche
// e atualiza ao salvar.
'use client';

import { useEffect, useState } from 'react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listTopics, type Topic } from '@/services/topics.service';
import { createBlock, updateBlock } from '@/services/studyBlocks.service';
import { theme } from '@/lib/theme';

interface EditTarget {
  id: string;
  subjectId: string;
  topicId: string | null;
  plannedMinutes: number;
}

interface Props {
  blockDate: string;
  dateLabel: string;
  onClose: () => void;
  onCreated: () => void;
  editBlock?: EditTarget | null;   // se presente, modo edição
}

export function BlockModal({ blockDate, dateLabel, onClose, onCreated, editBlock = null }: Props) {
  const isEdit = !!editBlock;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectId, setSubjectId] = useState(editBlock?.subjectId ?? '');
  const [topicId, setTopicId] = useState(editBlock?.topicId ?? '');
  const [minutes, setMinutes] = useState(String(editBlock?.plannedMinutes ?? 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => {});
  }, []);

  // Carrega tópicos da matéria. No modo edição, preserva o tópico inicial.
  useEffect(() => {
    if (!subjectId) { setTopics([]); setTopicId(''); return; }
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
    // só limpa o tópico se a matéria mudou em relação à original (modo edição)
    if (!isEdit || subjectId !== editBlock?.subjectId) setTopicId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function handleSave() {
    if (!subjectId) { setError('Escolha uma matéria.'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit && editBlock) {
        await updateBlock(editBlock.id, {
          plannedMinutes: Number(minutes) || 60,
          topicId: topicId || null,
        });
        // Nota: editar matéria de um bloco existente não é suportado aqui
        // (mudaria a cor/contexto); se trocou a matéria, ignoramos por ora.
      } else {
        await createBlock({
          blockDate,
          subjectId,
          topicId: topicId || null,
          plannedMinutes: Number(minutes) || 60,
        });
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>{isEdit ? 'Editar bloco' : `Novo bloco · ${dateLabel}`}</h2>

        <label style={styles.label}>Matéria</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={styles.select} disabled={isEdit}>
          <option value="">Selecione…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {isEdit && <p style={styles.hint}>A matéria não muda na edição. Para trocá-la, exclua e crie outro bloco.</p>}

        <label style={styles.label}>Tópico (opcional)</label>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={styles.select} disabled={!subjectId || topics.length === 0}>
          <option value="">— sem tópico específico —</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {subjectId && (
          <p style={styles.hint}>Com tópico, o bloco se completa sozinho ao estudá-lo no timer.</p>
        )}

        <label style={styles.label}>Minutos planejados</label>
        <input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" min="5" step="5" style={styles.input} />

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={styles.save}>
            {saving ? 'Salvando…' : (isEdit ? 'Salvar' : 'Adicionar bloco')}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 380, fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: '0 0 18px' },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  input: { width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  hint: { fontSize: 11.5, color: theme.inkFaint, margin: '6px 0 0', lineHeight: 1.4 },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};