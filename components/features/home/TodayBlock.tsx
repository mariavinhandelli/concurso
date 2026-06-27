// components/features/home/TodayBlock.tsx
// Bloco "hoje": dois cards de pendentes (revisões + flashcards) clicáveis,
// e uma faixa fina com meta do dia (editável via popover) + acerto recente.
// No mobile os cards empilham (1 coluna) e a faixa quebra em linhas.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { countDueReviews } from '@/services/reviews.service';
import { buildDailyQueue } from '@/services/flashcards.service';
import {
  getGoalsSummary, setDailyTarget, type GoalsSummary,
  getQuestionsSummary, setDailyTargetQuestions, type QuestionsSummary,
} from '@/services/goals.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

export function TodayBlock() {
  const router = useRouter();
  const { isMobile } = useUI();
  const [revisoes, setRevisoes] = useState<number | null>(null);
  const [flashcards, setFlashcards] = useState<number | null>(null);
  const [goals, setGoals] = useState<GoalsSummary | null>(null);
  const [qGoals, setQGoals] = useState<QuestionsSummary | null>(null);

  // Popover — horas
  const [editingHours, setEditingHours] = useState(false);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  // Popover — questões
  const [editingQ, setEditingQ] = useState(false);
  const [qTarget, setQTarget] = useState('');
  const [savingQ, setSavingQ] = useState(false);

  function loadGoals() {
    getGoalsSummary().then((s) => {
      setGoals(s);
      setHours(String(Math.floor(s.targetMinutesPerDay / 60)));
      setMins(String(s.targetMinutesPerDay % 60));
    }).catch(() => {});
    getQuestionsSummary().then((s) => {
      setQGoals(s);
      setQTarget(String(s.targetQuestionsPerDay));
    }).catch(() => {});
  }

  useEffect(() => {
    countDueReviews().then(setRevisoes).catch(() => setRevisoes(0));
    buildDailyQueue().then((q) => setFlashcards(q.length)).catch(() => setFlashcards(0));
    loadGoals();
  }, []);

  async function saveHoursGoal() {
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    setSavingHours(true);
    try { await setDailyTarget(total); setEditingHours(false); loadGoals(); }
    catch { /* silencia */ } finally { setSavingHours(false); }
  }

  async function saveQGoal() {
    const count = Number(qTarget) || 0;
    setSavingQ(true);
    try { await setDailyTargetQuestions(count); setEditingQ(false); loadGoals(); }
    catch { /* silencia */ } finally { setSavingQ(false); }
  }

  const metaHoursPct = goals && goals.targetMinutesPerDay > 0
    ? Math.min(100, Math.round((goals.todayMinutes / goals.targetMinutesPerDay) * 100))
    : 0;

  const metaQPct = qGoals && qGoals.targetQuestionsPerDay > 0
    ? Math.min(100, Math.round((qGoals.todayQuestions / qGoals.targetQuestionsPerDay) * 100))
    : 0;

  function fmtMin(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
  }

  return (
    <div style={styles.wrap}>
      {/* Dois cards de pendentes — empilham no mobile */}
      <div style={{ ...styles.cards, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
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

      {/* ── Linha 1: meta de horas ── */}
      <div style={{ ...styles.strip, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={styles.metaWrap}>
          <button style={styles.stripBtn} onClick={() => { setEditingHours((v) => !v); setEditingQ(false); }} title="Ajustar meta de horas">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            Meta <b style={styles.stripVal}>{goals ? `${fmtMin(goals.todayMinutes)} / ${fmtMin(goals.targetMinutesPerDay)}` : '…'}</b>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: editingHours ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {editingHours && (
            <div style={styles.popover}>
              <div style={styles.popLabel}>Meta diária de estudo</div>
              <div style={styles.popRow}>
                <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min="0" style={styles.popInput} />
                <span style={styles.popUnit}>h</span>
                <input value={mins} onChange={(e) => setMins(e.target.value)} type="number" min="0" max="59" style={styles.popInput} />
                <span style={styles.popUnit}>min</span>
              </div>
              {Number(hours) > 0 || Number(mins) > 0 ? (
                <div style={styles.popHint}>
                  Meta semanal: {fmtMin(((Number(hours) || 0) * 60 + (Number(mins) || 0)) * 7)}
                </div>
              ) : null}
              <div style={styles.popActions}>
                <button style={styles.popCancel} onClick={() => setEditingHours(false)}>Cancelar</button>
                <button style={styles.popSave} onClick={saveHoursGoal} disabled={savingHours}>{savingHours ? '…' : 'Salvar'}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...styles.bar, order: isMobile ? 3 : 0, flexBasis: isMobile ? '100%' : undefined }}>
          <div style={{ ...styles.barFill, width: `${metaHoursPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          Progresso <b style={styles.stripVal}>{metaHoursPct}%</b>
        </span>
      </div>

      {/* ── Linha 2: meta de questões ── */}
      <div style={{ ...styles.strip, flexWrap: isMobile ? 'wrap' : 'nowrap', marginTop: 8 }}>
        <div style={styles.metaWrap}>
          <button style={styles.stripBtn} onClick={() => { setEditingQ((v) => !v); setEditingHours(false); }} title="Ajustar meta de questões">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/></svg>
            Questões <b style={styles.stripVal}>
              {qGoals ? `${qGoals.todayQuestions} / ${qGoals.targetQuestionsPerDay || '—'}` : '…'}
            </b>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: editingQ ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {editingQ && (
            <div style={styles.popover}>
              <div style={styles.popLabel}>Meta diária de questões</div>
              <div style={styles.popRow}>
                <input value={qTarget} onChange={(e) => setQTarget(e.target.value)} type="number" min="0" style={{ ...styles.popInput, width: 64 }} />
                <span style={styles.popUnit}>questões/dia</span>
              </div>
              {Number(qTarget) > 0 ? (
                <div style={styles.popHint}>
                  Meta semanal: {Number(qTarget) * 7} questões
                </div>
              ) : null}
              <div style={styles.popActions}>
                <button style={styles.popCancel} onClick={() => setEditingQ(false)}>Cancelar</button>
                <button style={styles.popSave} onClick={saveQGoal} disabled={savingQ}>{savingQ ? '…' : 'Salvar'}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...styles.bar, order: isMobile ? 3 : 0, flexBasis: isMobile ? '100%' : undefined }}>
          <div style={{ ...styles.barFill, width: `${metaQPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h3m14 0h3M12 2v3m0 14v3"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
          Acerto <b style={styles.stripVal}>{qGoals?.todayAcerto == null ? '—' : `${qGoals.todayAcerto}%`}</b>
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, minWidth: 0 },
  cards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', minWidth: 0 },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  iconBox: { width: 44, height: 44, borderRadius: 11, background: theme.tealBg, display: 'grid', placeItems: 'center', flexShrink: 0 },
  cardText: { minWidth: 0 },
  cardNum: { fontSize: 22, fontWeight: 700, color: theme.ink, lineHeight: 1.1 },
  cardLabel: { fontSize: 13, color: theme.inkSoft, marginTop: 2 },
  strip: { display: 'flex', alignItems: 'center', gap: 16, padding: '4px 4px' },
  metaWrap: { position: 'relative', flexShrink: 0 },
  stripBtn: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: theme.inkSoft, whiteSpace: 'nowrap', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  stripItem: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: theme.inkSoft, whiteSpace: 'nowrap', flexShrink: 0 },
  stripVal: { color: theme.ink, fontWeight: 600 },
  bar: { flex: 1, height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden', minWidth: 40 },
  barFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width .4s ease' },
  popover: { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 14, width: 200 },
  popLabel: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, marginBottom: 10 },
  popRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  popInput: { width: 48, padding: '7px 8px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  popUnit: { fontSize: 13, color: theme.inkSoft },
  popHint: { fontSize: 11.5, color: theme.inkFaint, marginBottom: 10, marginTop: -4 },
  popActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  popCancel: { padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  popSave: { padding: '7px 14px', borderRadius: 8, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};