'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Clock, CircleCheckBig, ClipboardCheck, Crosshair } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getGoalsSummary, setDailyTarget, type GoalsSummary,
  getQuestionsSummary, setDailyTargetQuestions, type QuestionsSummary,
} from '@/services/goals.service';
import { fmtMin } from '@/lib/format/time';
import { GoalEditorPopover } from './GoalEditorPopover';
import { theme, perfColor } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

export const TodayBlock = memo(function TodayBlock() {
  const { isMobile } = useUI();
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Dados via TanStack Query — cache, deduplicação e refetch ao focar são automáticos ──
  const { data: goals, isError: goalsErr, refetch: refetchGoals, isRefetching: goalsRefetching } = useQuery<GoalsSummary>({
    queryKey: ['goals-summary'],
    queryFn: getGoalsSummary,
  });
  const { data: qGoals, isError: qErr, refetch: refetchQ, isRefetching: qRefetching } = useQuery<QuestionsSummary>({
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

  // (P15 removido) A meta batida agora é celebrada pelo SessionCelebration no
  // momento do save — o toast daqui duplicava o mesmo aviso.

  const hoursTotal = (Number(hours) || 0) * 60 + (Number(mins) || 0);

  // P16 — cor do acerto proporcional ao desempenho.
  // H14 — usa a MESMA régua de theme.perfColor (80/65) que HealthBar,
  // AccuracyChart e JurisSimulado já seguem; antes era 80/60 só aqui.
  const acertoColor = qGoals?.todayAcerto == null
    ? theme.inkSoft
    : perfColor(qGoals.todayAcerto / 100).fg;

  // P16 — delta vs ontem
  const acrDelta = (qGoals?.todayAcerto != null && qGoals?.yesterdayAcerto != null)
    ? qGoals.todayAcerto - qGoals.yesterdayAcerto
    : null;
  const deltaColor = acrDelta == null ? undefined
    : acrDelta > 0 ? theme.ok
    : acrDelta < 0 ? theme.crit
    : theme.inkSoft;

  // Sem meta de questões e sem nenhum registro na semana: a linha ficaria
  // permanentemente "0 / — · Acerto —" ocupando espaço nobre sem informar nada.
  // Só aparece quando há meta definida ou algum questionário já resolvido.
  // Erro tem prioridade sobre esse cálculo — nunca decide "esconder" por falha de rede.
  const mostrarQuestoes = !qErr && (!qGoals || qGoals.targetQuestionsPerDay > 0 || qGoals.weekQuestions > 0);

  return (
    <div style={styles.wrap}>
      {/* ── Linha 1: meta de horas — H11: erro vira aviso+retry, nunca "0min/0min" silencioso ── */}
      {goalsErr && !goals ? (
        <p style={styles.errorRow}>
          Não consegui carregar sua meta de horas.{' '}
          <button style={styles.retryLink} onClick={() => refetchGoals()} disabled={goalsRefetching}>
            {goalsRefetching ? 'tentando…' : 'tentar de novo'}
          </button>
        </p>
      ) : (
      <div style={{ ...styles.strip, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={styles.metaWrap}>
          <button
            style={styles.stripBtn}
            onClick={() => { setEditingHours((v) => !v); setEditingQ(false); }}
            title="Ajustar meta de horas"
            data-popover-trigger
            aria-haspopup="dialog"
            aria-expanded={editingHours}
          >
            <Clock size={15} color={theme.inkSoft} strokeWidth={1.8} />
            {/* H16 — "H. Estudo" era críptico (abreviação ambígua); "Estudo hoje" é direto. */}
            Estudo hoje{' '}
            <b style={styles.stripVal}>{goals ? `${fmtMin(goals.todayMinutes)} / ${fmtMin(goals.targetMinutesPerDay)}` : '…'}</b>
            <ChevronDown size={12} color={theme.inkFaint} strokeWidth={2} style={{ transform: editingHours ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
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
                <input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min="0" aria-label="Horas" style={styles.popInput} />
                <span style={styles.popUnit}>h</span>
                <input value={mins} onChange={(e) => setMins(e.target.value)} type="number" min="0" max="59" aria-label="Minutos" style={styles.popInput} />
                <span style={styles.popUnit}>min</span>
              </div>
            </GoalEditorPopover>
          )}
        </div>

        <div
          style={{ ...styles.bar, order: isMobile ? 3 : 0, flexBasis: isMobile ? '100%' : undefined }}
          role="progressbar"
          aria-label="Meta diária de horas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metaHoursPct}
        >
          <div style={{ ...styles.barFill, width: `${metaHoursPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <CircleCheckBig size={15} color={theme.inkSoft} strokeWidth={1.8} />
          Progresso <b style={styles.stripVal}>{metaHoursPct}%</b>
        </span>
      </div>
      )}

      {/* ── Linha 2: meta de questões — só quando há meta ou histórico. Sem
          nenhum dos dois, a linha ficaria "0 / — · Acerto —" pra sempre; em
          vez disso um link discreto mantém a função descobrível sob interação. ── */}
      {mostrarQuestoes ? (
      <div style={{ ...styles.strip, flexWrap: isMobile ? 'wrap' : 'nowrap', marginTop: 8 }}>
        <div style={styles.metaWrap}>
          <button
            style={styles.stripBtn}
            onClick={() => { setEditingQ((v) => !v); setEditingHours(false); }}
            title="Ajustar meta de questões"
            data-popover-trigger
            aria-haspopup="dialog"
            aria-expanded={editingQ}
          >
            <ClipboardCheck size={15} color={theme.inkSoft} strokeWidth={1.8} />
            Questões{' '}
            <b style={styles.stripVal}>
              {qGoals ? `${qGoals.todayQuestions} / ${qGoals.targetQuestionsPerDay || '—'}` : '…'}
            </b>
            <ChevronDown size={12} color={theme.inkFaint} strokeWidth={2} style={{ transform: editingQ ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
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
                <input value={qTarget} onChange={(e) => setQTarget(e.target.value)} type="number" min="0" aria-label="Questões por dia" style={{ ...styles.popInput, width: 64 }} />
                <span style={styles.popUnit}>questões/dia</span>
              </div>
            </GoalEditorPopover>
          )}
        </div>

        <div
          style={{ ...styles.bar, order: isMobile ? 3 : 0, flexBasis: isMobile ? '100%' : undefined }}
          role="progressbar"
          aria-label="Meta diária de questões"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metaQPct}
        >
          <div style={{ ...styles.barFill, width: `${metaQPct}%` }} />
        </div>

        <span style={styles.stripItem}>
          <Crosshair size={15} color={theme.inkSoft} strokeWidth={1.8} />
          Acerto <b style={{ ...styles.stripVal, color: acertoColor }}>{qGoals?.todayAcerto == null ? '—' : `${qGoals.todayAcerto}%`}</b>
          {acrDelta != null && acrDelta !== 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor }}>
              {acrDelta > 0 ? '↑' : '↓'}&nbsp;{acrDelta > 0 ? '+' : ''}{acrDelta}%
            </span>
          )}
        </span>
      </div>
      ) : qErr ? (
        <p style={{ ...styles.errorRow, marginTop: 6 }}>
          Não consegui carregar suas questões.{' '}
          <button style={styles.retryLink} onClick={() => refetchQ()} disabled={qRefetching}>
            {qRefetching ? 'tentando…' : 'tentar de novo'}
          </button>
        </p>
      ) : (
        <div style={{ ...styles.metaWrap, marginTop: 6 }}>
          <button
            style={styles.addQLink}
            onClick={() => { setEditingQ((v) => !v); setEditingHours(false); }}
            data-popover-trigger
            aria-haspopup="dialog"
            aria-expanded={editingQ}
          >
            + meta de questões (opcional)
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
                <input value={qTarget} onChange={(e) => setQTarget(e.target.value)} type="number" min="0" aria-label="Questões por dia" style={{ ...styles.popInput, width: 64 }} />
                <span style={styles.popUnit}>questões/dia</span>
              </div>
            </GoalEditorPopover>
          )}
        </div>
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 },
  strip: { display: 'flex', alignItems: 'center', gap: 16, padding: '4px 4px' },
  metaWrap: { position: 'relative', flexShrink: 0 },
  stripBtn: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: theme.inkSoft, whiteSpace: 'nowrap', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  stripItem: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: theme.inkSoft, whiteSpace: 'nowrap', flexShrink: 0 },
  stripVal: { color: theme.ink, fontWeight: 600 },
  bar: { flex: 1, height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', minWidth: 40 },
  barFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width .4s ease' },
  popRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 },
  popInput: { width: 48, padding: '7px 8px', borderRadius: theme.radiusXs, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  popUnit: { fontSize: 13, color: theme.inkSoft },
  addQLink: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  errorRow: { fontSize: 14, color: theme.crit, margin: 0, padding: '4px 4px' },
  retryLink: { border: 'none', background: 'transparent', color: theme.crit, fontSize: 14, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
