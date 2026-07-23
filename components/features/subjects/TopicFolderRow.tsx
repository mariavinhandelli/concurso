'use client';

import React from 'react';
import { X, Pencil, ChevronDown, Plus } from 'lucide-react';
import type { Topic } from '@/services/topics.service';
import { TopicLeafRow } from './TopicLeafRow';
import { theme } from '@/lib/theme';

interface Props {
  topic: Topic;
  kids: Topic[];
  saudeMap: Record<string, number>;
  noteCountMap: Record<string, number>;
  isCollapsed: boolean;
  editingId: string | null;
  editText: string;
  isAddingChild: boolean;
  childName: string;
  isMobile: boolean;
  onToggleCollapse: (id: string) => void;
  onStartEdit: (topic: Topic) => void;
  onCommitEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteLeaf: (id: string) => void;
  onToggle: (topic: Topic) => void;
  onToggleReview: (topic: Topic) => void;
  onStartAddChild: (parentId: string) => void;
  onCommitAddChild: (parentId: string, name: string) => void;
  onCancelAddChild: () => void;
  onChildNameChange: (name: string) => void;
  onStudy: (id: string) => void;
  onViewNotes: (topic: Topic) => void;
}

function folderPropsEqual(prev: Props, next: Props): boolean {
  if (
    prev.topic !== next.topic ||
    prev.kids !== next.kids ||
    prev.saudeMap !== next.saudeMap ||
    prev.noteCountMap !== next.noteCountMap ||
    prev.isCollapsed !== next.isCollapsed ||
    prev.isMobile !== next.isMobile ||
    prev.onToggleCollapse !== next.onToggleCollapse ||
    prev.onStartEdit !== next.onStartEdit ||
    prev.onCommitEdit !== next.onCommitEdit ||
    prev.onCancelEdit !== next.onCancelEdit ||
    prev.onEditTextChange !== next.onEditTextChange ||
    prev.onDeleteFolder !== next.onDeleteFolder ||
    prev.onDeleteLeaf !== next.onDeleteLeaf ||
    prev.onToggle !== next.onToggle ||
    prev.onToggleReview !== next.onToggleReview ||
    prev.onStartAddChild !== next.onStartAddChild ||
    prev.onCommitAddChild !== next.onCommitAddChild ||
    prev.onCancelAddChild !== next.onCancelAddChild ||
    prev.onChildNameChange !== next.onChildNameChange ||
    prev.onStudy !== next.onStudy ||
    prev.onViewNotes !== next.onViewNotes
  ) return false;

  const topicId = next.topic.id;
  const editAffects = (id: string | null) =>
    id === topicId || (id !== null && next.kids.some((k) => k.id === id));

  if (editAffects(prev.editingId) || editAffects(next.editingId)) {
    if (prev.editingId !== next.editingId || prev.editText !== next.editText) return false;
  }

  if (prev.isAddingChild || next.isAddingChild) {
    if (prev.isAddingChild !== next.isAddingChild || prev.childName !== next.childName) return false;
  }

  return true;
}

function TopicFolderRowFn({
  topic, kids, saudeMap, noteCountMap, isCollapsed, editingId, editText,
  isAddingChild, childName, isMobile,
  onToggleCollapse, onStartEdit, onCommitEdit, onCancelEdit, onEditTextChange,
  onDeleteFolder, onDeleteLeaf, onToggle, onToggleReview,
  onStartAddChild, onCommitAddChild, onCancelAddChild, onChildNameChange,
  onStudy, onViewNotes,
}: Props) {
  const isFolderEditing = editingId === topic.id;
  const kidsDone = kids.filter((k) => k.is_completed).length;
  const kidsPct = kids.length === 0 ? 0 : Math.round((kidsDone / kids.length) * 100);

  // Touch targets: 44px em mobile (recomendação WCAG); 32/26px só com mouse.
  const iconBtn = isMobile ? { ...styles.iconBtn, width: 44, height: 44 } : styles.iconBtn;
  const deleteBtn = isMobile ? { ...styles.deleteBtn, width: 44, height: 44 } : styles.deleteBtn;
  const caretBtn = isMobile ? { ...styles.caretBtn, width: 40, height: 40 } : styles.caretBtn;

  return (
    <div style={styles.folderWrap}>
      {/* Cabeçalho da pasta */}
      <div style={styles.folderHead}>
        <button
          onClick={() => onToggleCollapse(topic.id)}
          style={caretBtn}
          aria-label={isCollapsed ? 'Expandir pasta' : 'Recolher pasta'}
        >
          <ChevronDown
            size={14} color={theme.inkSoft} strokeWidth={2.2}
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}
          />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isFolderEditing ? (
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
            <span style={styles.folderName} onClick={() => onToggleCollapse(topic.id)}>
              {topic.name}
            </span>
          )}
          <div style={styles.folderTrack}>
            <div style={{ ...styles.folderFill, width: `${kidsPct}%` }} />
          </div>
          <div style={styles.folderMeta}>{kidsPct}% · {kidsDone}/{kids.length} subtópicos</div>
        </div>

        {/* Ações da pasta: + (adicionar filho), editar, apagar */}
        <div style={styles.folderActions}>
          {/* Botão "+" agora no header — mais acessível que no rodapé da lista */}
          <button
            onClick={() => { if (isCollapsed) onToggleCollapse(topic.id); onStartAddChild(topic.id); }}
            style={{ ...iconBtn, color: theme.teal }}
            title="Adicionar subtópico" aria-label="Adicionar subtópico"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
          <button
            onClick={() => isFolderEditing ? onCommitEdit(topic.id, editText) : onStartEdit(topic)}
            style={{ ...iconBtn, color: isFolderEditing ? theme.teal : theme.inkSoft }}
            title="Editar nome da pasta" aria-label="Editar pasta"
          >
            <Pencil size={15} strokeWidth={1.8} />
          </button>
          <button onClick={() => onDeleteFolder(topic.id)} style={deleteBtn} aria-label="Apagar pasta" title="Apagar pasta">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Filhos */}
      {!isCollapsed && (
        <div style={styles.folderBody}>
          {kids.map((kid) => (
            <TopicLeafRow
              key={kid.id}
              topic={kid}
              saudeValue={saudeMap[kid.id]}
              noteCount={noteCountMap[kid.id]}
              isEditing={editingId === kid.id}
              editText={editingId === kid.id ? editText : ''}
              indented
              isMobile={isMobile}
              onToggle={onToggle}
              onToggleReview={onToggleReview}
              onStartEdit={onStartEdit}
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
              onEditTextChange={onEditTextChange}
              onDelete={onDeleteLeaf}
              onStudy={onStudy}
              onViewNotes={onViewNotes}
            />
          ))}

          {isAddingChild && (
            <div style={{ ...styles.row, ...styles.rowChild }}>
              <input
                value={childName}
                onChange={(e) => onChildNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitAddChild(topic.id, childName);
                  if (e.key === 'Escape') onCancelAddChild();
                }}
                onBlur={() => onCommitAddChild(topic.id, childName)}
                autoFocus
                placeholder="Nome do subtópico…"
                style={styles.editInput}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const TopicFolderRow = React.memo(TopicFolderRowFn, folderPropsEqual);

const styles: Record<string, React.CSSProperties> = {
  folderWrap: {
    background: theme.card, borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`, overflow: 'hidden',
  },
  folderHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' },
  caretBtn: {
    width: 26, height: 26, borderRadius: 7, border: 'none',
    background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  },
  folderName: {
    fontSize: 16, color: theme.ink, fontWeight: 600, cursor: 'pointer',
    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  folderTrack: { height: 5, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginTop: 7 },
  folderFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  folderMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 4 },
  folderBody: { padding: '4px 12px 12px 40px', display: 'flex', flexDirection: 'column', gap: 6 },
  folderActions: { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    padding: '12px 16px', minWidth: 0,
  },
  rowChild: { background: theme.bg, borderRadius: 10 },
  editInput: {
    flex: 1, minWidth: 0, width: '100%', padding: '7px 10px', borderRadius: theme.radiusXs,
    border: `1.5px solid ${theme.teal}`, background: theme.card,
    fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none',
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: theme.radiusXs, border: 'none', background: 'transparent',
    display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
  },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', opacity: 0.6, width: 30, height: 30, borderRadius: theme.radiusXs, display: 'grid', placeItems: 'center', flexShrink: 0, padding: 0 },
};
