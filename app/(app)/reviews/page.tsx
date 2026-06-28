// app/(app)/reviews/page.tsx
// Central de Revisões: resumo de tópicos + flashcards no topo, depois a
// revisão de tópicos do dia.
'use client';

import { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useRouter } from 'next/navigation';
import {
  listDueReviews, submitReview, deactivateReview, rescheduleReview, dateInDays,
  type ReviewItem, type ReviewRating,
} from '@/services/reviews.service';
import { countDailyQueue } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';

const RATINGS: { key: ReviewRating; label: string; fg: string; bg: string }[] = [
  { key: 'dificil', label: 'Difícil', fg: theme.crit, bg: theme.critBg },
  { key: 'intermediario', label: 'Intermediário', fg: theme.warn, bg: theme.warnBg },
  { key: 'facil', label: 'Fácil', fg: theme.ok, bg: theme.okBg },
];

const QUICK = [
  { label: '+1 dia', days: 1 },
  { label: '+3 dias', days: 3 },
  { label: '+1 semana', days: 7 },
  { label: '+1 mês', days: 30 },
];

export default function ReviewsPage() {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openReschedule, setOpenReschedule] = useState<string | null>(null);
  const [cardCounts, setCardCounts] = useState<{ pending: number; news: number } | null>(null);

  async function load() {
    try {
      setItems(await listDueReviews());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    countDailyQueue().then(setCardCounts).catch(() => setCardCounts({ pending: 0, news: 0 }));
  }, []);

  async function handleRate(topicId: string, rating: ReviewRating) {
    setItems((prev) => prev.filter((i) => i.id !== topicId));
    try { await submitReview(topicId, rating); }
    catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro ao revisar.'); }
  }

  async function handleReschedule(topicId: string, dateStr: string) {
    setOpenReschedule(null);
    setItems((prev) => prev.filter((i) => i.id !== topicId));
    try { await rescheduleReview(topicId, dateStr); }
    catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro ao reagendar.'); }
  }

  async function handleRemove(topicId: string) {
    if (!await confirm({ title: 'Tirar este tópico do ciclo de revisão?', description: 'Ele saíra das revisões agendadas.' })) return;
    setItems((prev) => prev.filter((i) => i.id !== topicId));
    try { await deactivateReview(topicId); }
    catch (e) { load(); setError(e instanceof Error ? e.message : 'Erro ao remover.'); }
  }

  const cardTotal = cardCounts ? cardCounts.pending + cardCounts.news : 0;

  return (
    <>
    {dialog}
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Revisões de hoje</h1>
        <p style={styles.sub}>Repetição espaçada — avalie cada tópico e o sistema reagenda.</p>
      </div>

      {/* Cartões-resumo */}
      <div style={styles.summary}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{items.length}</span>
          <span style={styles.summaryLabel}>tópicos para revisar</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={{ ...styles.summaryNum, color: theme.teal }}>{cardTotal}</span>
          <span style={styles.summaryLabel}>flashcards pendentes</span>
          {cardTotal > 0 && (
            <button onClick={() => router.push('/flashcards?study=now')} style={styles.summaryBtn}>
              Estudar →
            </button>
          )}
        </div>
      </div>

      <div style={styles.sectionTitle}>Tópicos</div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>✓</span>
          <p style={styles.muted}>Nenhum tópico para revisar. Tudo em dia!</p>
        </div>
      ) : (
        <div style={styles.list}>
          {items.map((it) => (
            <div key={it.id} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={{ ...styles.badge, background: it.subjectColor }}>{it.subjectName}</span>
                {it.overdueDays > 0 && (
                  <span style={styles.overdue}>atrasada {it.overdueDays} {it.overdueDays === 1 ? 'dia' : 'dias'}</span>
                )}
                <button onClick={() => handleRemove(it.id)} style={styles.removeBtn} title="Tirar da revisão" aria-label="Tirar da revisão">✕</button>
              </div>
              <p style={styles.topicName}>{it.name}</p>

              <div style={styles.ratings}>
                {RATINGS.map((r) => (
                  <button key={r.key} onClick={() => handleRate(it.id, r.key)}
                    style={{ ...styles.ratingBtn, color: r.fg, background: r.bg }}>{r.label}</button>
                ))}
              </div>

              <button onClick={() => setOpenReschedule(openReschedule === it.id ? null : it.id)}
                style={styles.reschedToggle}>
                {openReschedule === it.id ? 'Fechar' : 'Adiar / escolher data'}
              </button>

              {openReschedule === it.id && (
                <div style={styles.reschedBox}>
                  <div style={styles.quickRow}>
                    {QUICK.map((q) => (
                      <button key={q.days} onClick={() => handleReschedule(it.id, dateInDays(q.days))}
                        style={styles.quickBtn}>{q.label}</button>
                    ))}
                  </div>
                  <div style={styles.dateRow}>
                    <input type="date"
                      onChange={(e) => e.target.value && handleReschedule(it.id, e.target.value)}
                      style={styles.dateInput} />
                    <span style={styles.dateHint}>ou escolha uma data exata</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 680, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font },
  header: { marginBottom: 24 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  summary: { display: 'flex', gap: 14, marginBottom: 28 },
  summaryCard: { flex: 1, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  summaryNum: { fontSize: 34, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' },
  summaryLabel: { fontSize: 12, color: theme.inkFaint, textAlign: 'center', fontWeight: 500 },
  summaryBtn: { marginTop: 10, padding: '8px 18px', borderRadius: 10, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  sectionTitle: { fontSize: 11, color: theme.inkFaint, fontWeight: 600, marginBottom: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyIcon: { fontSize: 36, color: theme.ok, display: 'block', marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 20 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { fontSize: 12, color: '#fff', padding: '3px 10px', borderRadius: 8, fontWeight: 600 },
  overdue: { fontSize: 12, color: theme.crit, fontWeight: 500 },
  removeBtn: { marginLeft: 'auto', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', opacity: 0.6 },
  topicName: { fontSize: 17, color: theme.ink, margin: '0 0 16px', fontWeight: 600 },
  ratings: { display: 'flex', gap: 10, marginBottom: 12 },
  ratingBtn: { flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
  reschedToggle: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  reschedBox: { marginTop: 12, padding: 14, background: theme.bg, borderRadius: 12 },
  quickRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  quickBtn: { padding: '8px 14px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  dateRow: { display: 'flex', alignItems: 'center', gap: 10 },
  dateInput: { padding: 8, borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit' },
  dateHint: { fontSize: 12, color: theme.inkFaint },
};