// components/features/home/TodayBlock.tsx
// Bloco "hoje": dois cards de pendentes (revisões + flashcards) clicáveis,
// e uma faixa fina com meta do dia (editável via popover) + acerto recente.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { countDueReviews } from '@/services/reviews.service';
import { buildDailyQueue } from '@/services/flashcards.service';
import { getGoalsSummary, setDailyTarget, type GoalsSummary } from '@/services/goals.service';
import { getAcertoRecente } from '@/services/metrics.service';
import { theme } from '@/lib/theme';

export function TodayBlock() {
  const router = useRouter();
  const [revisoes, setRevisoes] = useState<number | null>(null);
  const [flashcards, setFlashcards] = useState<number | null>(null);
  const [goals, setGoals] = useState<GoalsSummary | null>(null);
  const [acerto, setAcerto] = useState<number | null>(null);

  // Edição da meta (popover).
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  function loadGoals() {
    getGoalsSummary().then((s) => {
      setGoals(s);
      setHours(String(Math.floor(s.targetMinutesPerDay / 60)));
      setMins(String(s.targetMinutesPerDay % 60));
    }).catch(() => {});
  }

  useEffect(() => {
    countDueReviews().then(setRevisoes).catch(() => setRevisoes(0));
    buildDailyQueue().then((q) => setFlashcards(q.length)).catch(() => setFlashcards(0));
    loadGoals();
    getAcertoRecente().then(setAcerto).catch(() => setAcerto(null));
  }, []);

  async function saveGoal() {
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    setSavingGoal(true);
    try {
      await setDailyTarget(total);
      setEditing(false);
      loadGoals();
    } catch {
      // silencioso; mantém o popover aberto se falhar
    } finally {
      setSavingGoal(false);
    }
  }

  const metaPct = goals && goals.targetMinutesPerDay > 0
    ? Math.min(100, Math.round((goals.todayMinutes / goals.targetMinutesPerDay) * 100))
    : 0;

  function fmtMin(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
  }

  return (
    <div style={styles.wrap}>
      {/* Dois cards de pendentes */}
      <div style={styles.cards}>
        <button style={styles.card} onClick={() => router.push('/reviews')}>
          <div style={styles.cardLeft}>
            <div style={styles.iconBox}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" />
              </svg>
            </div>
            <div style={styles.cardText}>
              <div style={styles.cardNum}>
                {revisoes === null ? '…' : revisoes} {revisoes === 1 ? 'revisão' : 'revisões'}
              </div>
              <div style={styles.cardLabel}>vencendo hoje</div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        <button style={styles.card} onClick={() => router.push('/flashcards')}>
          <div style={styles.cardLeft}>
            <div style={styles.iconBox}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" />
              </svg>
            </div>
            <div style={styles.cardText}>
              <div style={styles.cardNum}>
                {flashcards === null ? '…' : flashcards} {flashcards === 1 ? 'flashcard' : 'flashcards'}
              </div>
              <div style={styles.cardLabel}>na fila</div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Faixa fina: meta do dia (clicável p/ editar) + acerto recente */}
      <div style={styles.strip}>
        <div style={styles.metaWrap}>
          <button style={styles.stripBtn} onClick={() => setEditing((v) => !v)} title="Ajustar meta">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            Meta <b style={styles.stripVal}>{goals ? `${fmtMin(goals.todayMinutes)} / ${fmtMin(goals.targetMinutesPerDay)}` : '…'}</b>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: editing ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {/* Popover de edição */}
          {editing && (
            <div style={styles.popover}>
              <div style={styles.popLabel}>Meta diária</div>
              <div style={styles.popRow}>
                <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min="0" style={styles.popInput} />
                <span style={styles.popUnit}>h</span>
                <input value={mins} onChange={(e) => setMins(e.target.value)} type="number" min="0" max="59" style={styles.popInput} />
                <span style={styles.popUnit}>min</span>
              </div>
              <div style={styles.popActions}>
                <button style={styles.popCancel} onClick={() => setEditing(false)}>Cancelar</button>
                <button style={styles.popSave} onClick={saveGoal} disabled={savingGoal}>
                  {savingGoal ? '…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.bar}>
          <div style={{ ...styles.barFill, width: `${metaPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"> <path d="M2 12h3m14 0h3M12 2v3m0 14v3"> </path><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>
          Acerto <b style={styles.stripVal}>{acerto === null ? '—' : `${acerto}%`}</b>
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font },
  cards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 11, background: theme.tealBg, display: 'grid', placeItems: 'center', flexShrink: 0 },
  cardText: { minWidth: 0 },
  cardNum: { fontSize: 22, fontWeight: 700, color: theme.ink, lineHeight: 1.1 },
  cardLabel: { fontSize: 13, color: theme.inkSoft, marginTop: 2 },
  strip: { display: 'flex', alignItems: 'center', gap: 16, padding: '4px 4px' },
  metaWrap: { position: 'relative', flexShrink: 0 },
  stripBtn: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: theme.inkSoft, whiteSpace: 'nowrap', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  stripItem: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: theme.inkSoft, whiteSpace: 'nowrap' },
  stripVal: { color: theme.ink, fontWeight: 600 },
  bar: { flex: 1, height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden', minWidth: 40 },
  barFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width .4s ease' },
  popover: { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 14, width: 200 },
  popLabel: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, marginBottom: 10 },
  popRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  popInput: { width: 48, padding: '7px 8px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  popUnit: { fontSize: 13, color: theme.inkSoft },
  popActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  popCancel: { padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  popSave: { padding: '7px 14px', borderRadius: 8, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};