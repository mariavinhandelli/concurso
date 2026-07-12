'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useFlashcardNavigation } from '@/hooks/useFlashcardNavigation';
import {
  deleteFlashcard, buildTopicQueue, countFlashcardsBySubject,
  type QueueCard, type Flashcard,
} from '@/services/flashcards.service';
import { listActive as listSubjectOptions, type PickerOption } from '@/services/subjects.service';
import { CardForm } from '@/components/features/flashcards/CardForm';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface Props {
  onStudy: (queue: QueueCard[]) => void;
}

export function CardsTab({ onStudy }: Props) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nav = useFlashcardNavigation();

  useEffect(() => {
    Promise.all([
      listSubjectOptions().then(nav.setSubjects),
      countFlashcardsBySubject().then(nav.setCounts),
    ]).catch(e => {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar matérias. Recarregue a página.';
      nav.setLoadError(msg);
      toast.error(msg);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(c: Flashcard) {
    const preview = c.front.length > 60 ? c.front.slice(0, 60) + '…' : c.front;
    if (!await confirm({
      title: 'Apagar este card?',
      description: `"${preview}" — esta ação não pode ser desfeita.`,
      confirmLabel: 'Apagar',
      danger: true,
    })) return;
    try {
      await deleteFlashcard(c.id);
      toast.success('Card apagado.');
      nav.reloadCards(msg => toast.error(msg));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar o card. Tente novamente.');
    }
  }

  async function studySubject(s: PickerOption) {
    try {
      onStudy(await buildTopicQueue({ subjectId: s.id }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar flashcards. Tente novamente.');
    }
  }

  async function studyCurrentTopic() {
    if (!nav.curSubject) return;
    try {
      const topicId = nav.curTopic === 'none' ? null : (nav.curTopic?.id ?? null);
      onStudy(await buildTopicQueue({ subjectId: nav.curSubject.id, topicId }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar flashcards. Tente novamente.');
    }
  }

  const presetSubjectId = nav.curSubject?.id ?? null;
  const presetTopicId = nav.curTopic === 'none' ? null : (nav.curTopic?.id ?? null);

  return (
    <>
      {dialog}
      <div>
        {nav.loadError && (
          <p role="alert" style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{nav.loadError}</p>
        )}

        {nav.level === 'subjects' && (
          <div style={styles.list}>
            <p style={styles.crumb}>Escolha a matéria</p>
            {nav.subjects.length === 0 && (
              <div style={styles.emptyState}>
                <p style={styles.muted}>Nenhuma matéria cadastrada ainda.</p>
                <Link href="/subjects" style={styles.emptyAction}>Adicionar matéria →</Link>
              </div>
            )}
            {nav.subjects.map(s => (
              <div
                key={s.id}
                style={{ ...styles.navItem, ...(hoveredId === s.id ? styles.navItemHover : {}) }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span onClick={() => nav.openSubject(s, msg => toast.error(msg))} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>{s.name}</span>
                {nav.counts[s.id] ? <span style={styles.count}>{nav.counts[s.id]}</span> : null}
                {nav.counts[s.id] ? (
                  <button onClick={() => studySubject(s)} style={styles.studyBtn}>Estudar</button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {nav.level === 'topics' && nav.curSubject && (
          <div style={styles.list}>
            <button onClick={nav.goBackToSubjects} style={styles.back}><ChevronLeft size={14} strokeWidth={2} />Matérias</button>
            <p style={styles.crumb}>{nav.curSubject.name}</p>
            {nav.topics.map(t => (
              <div
                key={t.id}
                onClick={() => nav.openTopic(t, msg => toast.error(msg))}
                style={{ ...styles.navItem, ...(hoveredId === t.id ? styles.navItemHover : {}) }}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span>{t.name}</span>
              </div>
            ))}
            <div
              onClick={() => nav.openTopic('none', msg => toast.error(msg))}
              style={{ ...styles.navItem, fontStyle: 'italic', color: theme.inkFaint, ...(hoveredId === 'none' ? styles.navItemHover : {}) }}
              onMouseEnter={() => setHoveredId('none')}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span>Sem tópico específico</span>
            </div>
          </div>
        )}

        {nav.level === 'cards' && nav.curSubject && (
          <div style={styles.list}>
            <button onClick={nav.goBackToTopics} style={styles.back}><ChevronLeft size={14} strokeWidth={2} />Tópicos</button>
            <div style={styles.cardsHeader}>
              <p style={styles.crumb}>{nav.curTopic === 'none' ? 'Sem tópico' : (nav.curTopic as PickerOption)?.name}</p>
              {nav.cards.length > 0 && (
                <Button size="sm" onClick={studyCurrentTopic}>▶ Estudar tópico</Button>
              )}
            </div>

            {editingCard ? (
              <CardForm
                subjectId={editingCard.subject_id}
                topicId={editingCard.topic_id}
                card={editingCard}
                onSaved={() => {
                  setEditingCard(null);
                  toast.success('Card atualizado!');
                  nav.reloadCards(msg => toast.error(msg));
                }}
                onCancel={() => setEditingCard(null)}
              />
            ) : creating ? (
              <CardForm
                subjectId={presetSubjectId}
                topicId={presetTopicId}
                onSaved={() => { setCreating(false); toast.success('Card criado!'); nav.reloadCards(msg => toast.error(msg)); }}
                onCreatedAndNew={() => { toast.success('Card criado!'); nav.reloadCards(msg => toast.error(msg)); }}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <Button fullWidth onClick={() => setCreating(true)}>+ Criar card</Button>
            )}

            {nav.cards.length === 0 ? (
              <p style={styles.muted}>Nenhum card aqui ainda.</p>
            ) : nav.cards.map(c => (
              <div
                key={c.id}
                style={{ ...styles.cardItem, ...(hoveredId === c.id ? styles.cardItemHover : {}) }}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div style={styles.cardFront}>{c.front}</div>
                <div style={styles.cardBack}>{c.back}</div>
                <div style={styles.cardActions}>
                  <button
                    onClick={() => { setCreating(false); setEditingCard(c); }}
                    style={styles.editBtn}
                    aria-label="Editar card"
                    title="Editar"
                  ><Pencil size={13} strokeWidth={2} /></button>
                  <button
                    onClick={() => handleDelete(c)}
                    style={styles.delBtn}
                    aria-label="Apagar card"
                    title="Apagar"
                  ><Trash2 size={12} strokeWidth={2} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  crumb: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, margin: '4px 0', textTransform: 'uppercase', letterSpacing: 0.6 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: theme.card, borderRadius: theme.radiusSm, border: `1px solid ${theme.lineStrong}`, padding: '13px 15px', cursor: 'pointer', fontSize: 14, color: theme.ink, fontWeight: 500, minWidth: 0, transition: 'background .12s, transform .12s' },
  navItemHover: { background: 'rgba(15,23,42,.03)', transform: 'translateX(2px)' },
  count: { fontSize: 11, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, flexShrink: 0 },
  studyBtn: { padding: '5px 13px', borderRadius: theme.radiusXs, border: 'none', background: theme.tealBg, color: theme.tealDeep, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  cardsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  studyTopicBtn: { padding: '7px 15px', borderRadius: 10, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  newBtn: { width: '100%', padding: '11px 0', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 4, fontFamily: 'inherit' },
  muted: { color: theme.inkFaint, fontSize: 14 },
  cardItem: { position: 'relative', background: theme.card, borderRadius: theme.radiusSm, border: `1px solid ${theme.lineStrong}`, boxShadow: '0 1px 2px var(--line)', padding: '13px 15px', paddingRight: 72, transition: 'box-shadow .12s' },
  cardItemHover: { boxShadow: 'var(--shadow-hover)' },
  cardFront: { fontSize: 14, color: theme.ink, fontWeight: 600 },
  cardBack: { fontSize: 13, color: theme.inkSoft, marginTop: 4 },
  cardActions: { position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 },
  editBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 },
  delBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 },
  emptyState: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  emptyAction: { fontSize: 14, color: theme.teal, fontWeight: 600, textDecoration: 'none' },
};
