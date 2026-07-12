'use client';

import React, { useState } from 'react';
import { X, Pencil, RefreshCw } from 'lucide-react';
import type { Topic } from '@/services/topics.service';
import { HealthBar } from '@/components/features/topics/HealthBar';
import { theme } from '@/lib/theme';

interface Props {
  topic: Topic;
  saudeValue: number | undefined;
  noteCount?: number;
  isEditing: boolean;
  editText: string;
  indented: boolean;
  isMobile: boolean;
  onToggle: (topic: Topic) => void;
  onToggleReview: (topic: Topic) => void;
  onStartEdit: (topic: Topic) => void;
  onCommitEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onDelete: (id: string) => void;
  onStudy: (id: string) => void;
  onViewNotes: (topic: Topic) => void;
}

function TopicLeafRowInner({
  topic, saudeValue, noteCount = 0, isEditing, editText, indented, isMobile,
  onToggle, onToggleReview, onStartEdit, onCommitEdit, onCancelEdit,
  onEditTextChange, onDelete, onStudy, onViewNotes,
}: Props) {
  const [checkAnim, setCheckAnim] = useState(false);

  function handleToggle() {
    setCheckAnim(true);
    onToggle(topic);
  }

  return (
    // Em desktop, className="topic-row" ativa hover-reveal das ações via globals.css.
    // Em mobile as ações ficam sempre visíveis (sem a classe).
    <div
      className={isMobile ? undefined : 'topic-row'}
      style={{ ...styles.row, ...(indented ? styles.rowChild : {}), flexWrap: isMobile ? 'wrap' : 'nowrap' }}
    >
      <button
        onClick={handleToggle}
        onAnimationEnd={() => setCheckAnim(false)}
        className={checkAnim ? 'checkbox-pop' : undefined}
        style={{ ...styles.checkbox, ...(topic.is_completed ? styles.checkboxOn : {}) }}
        aria-label={topic.is_completed ? 'Concluído — clique para desmarcar' : 'Marcar como concluído'}
      >
        {topic.is_completed ? '✓' : ''}
      </button>

      {isEditing ? (
        <input
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit(topic.id, editText);
            if (e.key === 'Escape') onCancelEdit();
          }}
          onBlur={() => onCommitEdit(topic.id, editText)}
          autoFocus
          style={styles.editInput}
        />
      ) : (
        <span style={{ ...styles.topicName, ...(topic.is_completed ? styles.topicNameDone : {}) }}>
          {topic.name}
        </span>
      )}

      <HealthBar saude={saudeValue} />

      {/* Em desktop a div fica invisível (opacity:0) e aparece no hover via .topic-row:hover .topic-actions */}
      <div
        className={isMobile ? undefined : 'topic-actions'}
        style={{ ...styles.actions, ...(isMobile ? styles.actionsMobile : {}), ...(isEditing ? { opacity: 1 } : {}) }}
      >
        <button
          onClick={() => isEditing ? onCommitEdit(topic.id, editText) : onStartEdit(topic)}
          style={{ ...styles.iconBtn, color: isEditing ? theme.teal : theme.inkSoft }}
          title="Editar nome" aria-label="Editar tópico"
        >
          <Pencil size={15} strokeWidth={1.8} />
        </button>

        {/* "Revisar" como texto quando inativo — torna a função óbvia sem ícone ambíguo */}
        <button
          onClick={() => onToggleReview(topic)}
          style={{
            ...styles.reviewBtn,
            color: topic.is_review_active ? theme.teal : theme.inkSoft,
            background: topic.is_review_active ? theme.tealBg : 'transparent',
            fontFamily: theme.font,
          }}
          title={topic.is_review_active ? 'Em revisão — clique para desativar' : 'Ativar revisão espaçada'}
          aria-label="Alternar revisão espaçada"
        >
          {topic.is_review_active ? (
            <RefreshCw size={15} strokeWidth={1.8} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Revisar</span>
          )}
        </button>

        <button
          onClick={() => onViewNotes(topic)}
          style={{ ...styles.iconBtn, color: noteCount > 0 ? theme.teal : theme.inkSoft, position: 'relative' }}
          title={noteCount > 0 ? `${noteCount} ${noteCount === 1 ? 'anotação' : 'anotações'}` : 'Anotar sobre este tópico'}
          aria-label="Ver anotações do tópico"
        >
          <Pencil size={15} strokeWidth={1.8} />
          {noteCount > 0 && <span style={styles.noteBadge}>{noteCount}</span>}
        </button>

        <button
          onClick={() => onStudy(topic.id)}
          style={{ ...styles.iconBtn, color: theme.teal }}
          title="Estudar este tópico" aria-label="Estudar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>

        <button onClick={() => onDelete(topic.id)} style={styles.deleteBtn} aria-label="Apagar tópico" title="Apagar">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export const TopicLeafRow = React.memo(TopicLeafRowInner);

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    padding: '12px 16px', minWidth: 0,
  },
  rowChild: { background: theme.bg, borderRadius: 10 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${theme.line}`,
    background: theme.card, color: 'transparent', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: theme.onTeal },
  topicName: { flex: 1, fontSize: 15, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  topicNameDone: { color: theme.inkFaint, textDecoration: 'line-through' },
  editInput: {
    flex: 1, minWidth: 0, width: '100%', padding: '7px 10px', borderRadius: theme.radiusXs,
    border: `1.5px solid ${theme.teal}`, background: theme.card,
    fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none',
  },
  actions: { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 },
  actionsMobile: { width: '100%', justifyContent: 'flex-end', marginTop: 4 },
  iconBtn: {
    width: 32, height: 32, borderRadius: theme.radiusXs, border: 'none', background: 'transparent',
    display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
  },
  reviewBtn: {
    minWidth: 32, height: 32, borderRadius: theme.radiusXs, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 8px', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
  },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', opacity: 0.6, width: 30, height: 30, borderRadius: theme.radiusXs, display: 'grid', placeItems: 'center', flexShrink: 0, padding: 0 },
  noteBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 13, height: 13, borderRadius: theme.radiusPill,
    background: theme.teal, color: theme.onTeal, fontSize: 9, fontWeight: 700, lineHeight: '13px',
    textAlign: 'center', padding: '0 2px',
  },
};
