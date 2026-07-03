'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import { countDueReviews } from '@/services/reviews.service';
import { countDueCards } from '@/services/flashcards.service';
import {
  getGoalsSummary, setDailyTarget, type GoalsSummary,
  getQuestionsSummary, setDailyTargetQuestions, type QuestionsSummary,
} from '@/services/goals.service';
import { fmtMin } from '@/lib/format/time';
import { GoalEditorPopover } from './GoalEditorPopover';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

export const TodayBlock = memo(function TodayBlock() {
  const router = useRouter();
  const { isMobile } = useUI();
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Dados via TanStack Query — cache, deduplicação e refetch ao focar são automáticos ──
  const { data: revisoes } = useQuery<number>({
    queryKey: ['due-reviews-count'],
    queryFn: countDueReviews,
  });
  const { data: flashcards } = useQuery<number>({
    queryKey: ['due-cards-count'],
    queryFn: countDueCards,
  });
  const { data: goals } = useQuery<GoalsSummary>({
    queryKey: ['goals-summary'],
    queryFn: getGoalsSummary,
  });
  const { data: qGoals } = useQuery<QuestionsSummary>({
    queryKey: ['questions-summary'],
    queryFn: getQuestionsSummary,
  });

  // ── Estado dos popovers de edição ──
  const [editingHours, setEditingHours] = useState(false);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  const [editingQ, setEditingQ] = useState(false);
  const [qTarget, setQTarget] = useState('');
  const [savingQ, setSavingQ] = useState(false);

  // Refs: impedem que o refetch silencioso sobrescreva inputs abertos.
  const editingHoursRef = useRef(false);
  const editingQRef = useRef(false);
  useEffect(() => { editingHoursRef.current = editingHours; }, [editingHours]);
  useEffect(() => { editingQRef.current = editingQ; }, [editingQ]);

  // Sincroniza dados do servidor → estado do formulário (nunca sobrescreve input aberto).
  useEffect(() => {
    if (!goals || editingHoursRef.current) return;
    setHours(String(Math.floor(goals.targetMinutesPerDay / 60)));
    setMins(String(goals.targetMinutesPerDay % 60));
  }, [goals]);

  useEffect(() => {
    if (!qGoals || editingQRef.current) return;
    setQTarget(String(qGoals.targetQuestionsPerDay));
  }, [qGoals]);

  async function saveHoursGoal() {
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (total <= 0) { toast.error('Defina uma meta maior que 0 minutos.'); return; }
    setSavingHours(true);
    try {
      await setDailyTarget(total);
      setEditingHours(false);
      // Invalida goals + streak (streak lê dailyTarget para calcular metGoal).
      queryClient.invalidateQueries({ queryKey: ['goals-summary'] });
      queryClient.invalidateQueries({ queryKey: ['questions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar meta de horas.');
    } finally {
      setSavingHours(false);
    }
  }

  async function saveQGoal() {
    const count = Number(qTarget) || 0;
    if (count <= 0) { toast.error('Defina uma meta maior que 0 questões.'); return; }
    setSavingQ(true);
    try {
      await setDailyTargetQuestions(count);
      setEditingQ(false);
      queryClient.invalidateQueries({ queryKey: ['questions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['goals-summary'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar meta de questões.');
    } finally {
      setSavingQ(false);
    }
  }

  const metaHoursPct = goals && goals.targetMinutesPerDay > 0
    ? Math.min(100, Math.round((goals.todayMinutes / goals.targetMinutesPerDay) * 100))
    : 0;

  const metaQPct = qGoals && qGoals.targetQuestionsPerDay > 0
    ? Math.min(100, Math.round((qGoals.todayQuestions / qGoals.targetQuestionsPerDay) * 100))
    : 0;

  // P15 — celebrar quando a meta de horas passa de <100% para 100%
  const prevHoursPct = useRef(metaHoursPct);
  useEffect(() => {
    if (prevHoursPct.current < 100 && metaHoursPct >= 100) {
      toast.success('Meta de horas atingida! 🎉');
    }
    prevHoursPct.current = metaHoursPct;
  }, [metaHoursPct]);

  const hoursTotal = (Number(hours) || 0) * 60 + (Number(mins) || 0);

  // P16 — cor do acerto proporcional ao desempenho
  const acertoColor = qGoals?.todayAcerto == null
    ? theme.inkSoft
    : qGoals.todayAcerto >= 80 ? theme.ok
    : qGoals.todayAcerto >= 60 ? theme.warn
    : theme.crit;

  // P16 — delta vs ontem
  const acrDelta = (qGoals?.todayAcerto != null && qGoals?.yesterdayAcerto != null)
    ? qGoals.todayAcerto - qGoals.yesterdayAcerto
    : null;
  const deltaColor = acrDelta == null ? undefined
    : acrDelta > 0 ? theme.ok
    : acrDelta < 0 ? theme.crit
    : theme.inkSoft;

  // P11 — "tudo em dia" quando ambos carregaram e são zero
  const tudoEmDia = revisoes === 0 && flashcards === 0;

  return (
    <div style={styles.wrap}>
      {/* Dois cards de pendentes */}
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
                {revisoes === undefined ? <span style={styles.loadingNum}>…</span> : revisoes}{' '}
                {revisoes === 1 ? 'revisão' : 'revisões'}
              </div>
              <div style={styles.cardLabel}>
                {revisoes && revisoes > 0 ? `vencendo hoje · ~${revisoes * 3} min` : 'vencendo hoje'}
              </div>
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
                {flashcards === undefined ? <span style={styles.loadingNum}>…</span> : flashcards}{' '}
                {flashcards === 1 ? 'flashcard' : 'flashcards'}
              </div>
              <div style={styles.cardLabel}>
                {flashcards && flashcards > 0 ? `na fila de revisão · ~${Math.ceil(flashcards * 1.5)} min` : 'na fila de revisão'}
              </div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* P11 — banner "tudo em dia" quando ambos carregaram e são zero */}
      {tudoEmDia && (
        <div style={styles.allDoneBanner}>
          <span>Você está em dia com revisões e flashcards! 🎉</span>
          <button style={styles.allDoneLink} onClick={() => router.push('/flashcards/create')}>
            Criar novos flashcards →
          </button>
        </div>
      )}

      {/* ── Linha 1: meta de horas ── */}
      <div style={{ ...styles.strip, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={styles.metaWrap}>
          <button
            style={styles.stripBtn}
            onClick={() => { setEditingHours((v) => !v); setEditingQ(false); }}
            title="Ajustar meta de horas"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            H. Estudo{' '}
            <b style={styles.stripVal}>{goals ? `${fmtMin(goals.todayMinutes)} / ${fmtMin(goals.targetMinutesPerDay)}` : '…'}</b>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: editingHours ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {editingHours && (
            <GoalEditorPopover
              label="Meta diária de estudo"
              weeklyHint={hoursTotal > 0 ? `Meta semanal: ${fmtMin(hoursTotal * 7)}` : undefined}
              saving={savingHours}
              onSave={saveHoursGoal}
              onClose={() => setEditingHours(false)}
            >
              <div style={styles.popRow}>
                <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min="0" style={styles.popInput} />
                <span style={styles.popUnit}>h</span>
                <input value={mins} onChange={(e) => setMins(e.target.value)} type="number" min="0" max="59" style={styles.popInput} />
                <span style={styles.popUnit}>min</span>
              </div>
            </GoalEditorPopover>
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
          <button
            style={styles.stripBtn}
            onClick={() => { setEditingQ((v) => !v); setEditingHours(false); }}
            title="Ajustar meta de questões"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/></svg>
            Questões{' '}
            <b style={styles.stripVal}>
              {qGoals ? `${qGoals.todayQuestions} / ${qGoals.targetQuestionsPerDay || '—'}` : '…'}
            </b>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: editingQ ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {editingQ && (
            <GoalEditorPopover
              label="Meta diária de questões"
              weeklyHint={Number(qTarget) > 0 ? `Meta semanal: ${Number(qTarget) * 7} questões` : undefined}
              saving={savingQ}
              onSave={saveQGoal}
              onClose={() => setEditingQ(false)}
            >
              <div style={styles.popRow}>
                <input value={qTarget} onChange={(e) => setQTarget(e.target.value)} type="number" min="0" style={{ ...styles.popInput, width: 64 }} />
                <span style={styles.popUnit}>questões/dia</span>
              </div>
            </GoalEditorPopover>
          )}
        </div>

        <div style={{ ...styles.bar, order: isMobile ? 3 : 0, flexBasis: isMobile ? '100%' : undefined }}>
          <div style={{ ...styles.barFill, width: `${metaQPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h3m14 0h3M12 2v3m0 14v3"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
          Acerto <b style={{ ...styles.stripVal, color: acertoColor }}>{qGoals?.todayAcerto == null ? '—' : `${qGoals.todayAcerto}%`}</b>
          {acrDelta != null && acrDelta !== 0 && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: deltaColor }}>
              {acrDelta > 0 ? '↑' : '↓'}&nbsp;{acrDelta > 0 ? '+' : ''}{acrDelta}%
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 },
  loadingNum: { opacity: 0.4, fontWeight: 400 },
  allDoneBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '12px 16px', borderRadius: theme.radiusSm, background: 'var(--ok-bg)', border: '0.5px solid var(--ok)', marginBottom: 14, fontSize: 14, color: 'var(--ok-deep)', fontWeight: 500 },
  allDoneLink: { border: 'none', background: 'transparent', color: theme.ok, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' },
  cards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14, minWidth: 0 },
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
  popRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  popInput: { width: 48, padding: '7px 8px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  popUnit: { fontSize: 13, color: theme.inkSoft },
};
