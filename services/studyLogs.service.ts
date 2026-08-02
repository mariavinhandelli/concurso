// services/studyLogs.service.ts
import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import type { LogMode, PendingSession } from '@/lib/timer-storage';
import { activateReview, deactivateReview } from '@/services/reviews.service';
import { recalcularSaude } from '@/services/metrics.service';
import { autoCompleteByTopic } from '@/services/studyBlocks.service';
import { findCycleItemForSubject, completeCycleSubject } from '@/services/cycleEngine.service';
import { validateStudyLogInput } from '@/lib/study-log-validation';
import { track, EV } from '@/lib/analytics';
import { emitSessionSaved } from '@/lib/session-celebration';
import { toLocalDateString } from '@/lib/local-date';

export type ErrorCause = 'teoria' | 'interpretacao' | 'tempo';

export interface SessionFeedback {
  mode: LogMode;
  subjectId: string | null;
  topicId: string | null;
  qualitativeFeedback: string;
  energyLevel: number;
  insight: string;
  questionsTotal?: number;
  questionsCorrect?: number;
  // Causa predominante do erro na sessão. Só preenchido quando houve erro.
  errorCause?: ErrorCause | null;
  // Intenção de revisão: active = quer estar em revisão; was = estado anterior
  reviewIntent?: { active: boolean; was: boolean } | null;
}

/** Por que a sessão não entrou no ciclo. `materia_fora_do_ciclo` é o caso comum
 *  e legítimo (estudou algo que não está no ciclo); `erro` é falha real. */
export type CycleSkipReason = 'sem_materia' | 'materia_fora_do_ciclo' | 'curta_demais' | 'erro';

export interface SaveStudyLogResult {
  cycleCredited: boolean;
  cycleSkipReason?: CycleSkipReason;
}

export async function saveStudyLog(
  session: PendingSession,
  feedback: SessionFeedback,
): Promise<SaveStudyLogResult> {
  validateStudyLogInput(session, feedback);
  const supabase = createClient();

  const user = await getCachedUser();
  if (!user) {
    throw new Error('Você precisa estar logado para salvar uma sessão.');
  }

  const topicId = feedback.topicId ?? session.topicId;

  const { error } = await supabase
    .from('study_logs')
    .upsert({
      user_id: user.id,
      client_session_id: session.sessionId,
      topic_id: topicId,
      subject_id: feedback.subjectId ?? session.subjectId,
      board_id: session.boardId,
      mode: feedback.mode,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: new Date(session.endedAt).toISOString(),
      duration_sec: session.durationSec,
      questions_total: feedback.questionsTotal ?? 0,
      questions_correct: feedback.questionsCorrect ?? 0,
      qualitative_feedback: feedback.qualitativeFeedback,
      energy_level: feedback.energyLevel > 0 ? feedback.energyLevel : null,
      insight: feedback.insight,
      error_cause: feedback.errorCause ?? null,
    }, {
      onConflict: 'user_id,client_session_id',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error('Erro ao salvar a sessão: ' + error.message);
  }

  track(EV.studyCompleted, { minutes: Math.round(session.durationSec / 60), mode: feedback.mode });

  // Momento de recompensa (Tiny Habits): o card de celebração aparece logo após
  // o save — em todos os pontos de entrada (timer, registro rápido, manual).
  emitSessionSaved({
    minutes: Math.round(session.durationSec / 60),
    dateLocal: toLocalDateString(new Date(session.startedAt)),
  });

  // Aplica a intenção de revisão (só se mudou de estado).
  if (topicId && feedback.reviewIntent) {
    try {
      const { active, was } = feedback.reviewIntent;
      if (active && !was) await activateReview(topicId);
      else if (!active && was) await deactivateReview(topicId);
    } catch (e) {
      console.error('Intenção de revisão não aplicada (sessão salva mesmo assim):', e);
    }
  }

  // Recalcula a Saúde do tópico estudado (cache topic_metrics).
  // Falha aqui não deve impedir o save da sessão — por isso o try/catch.
  if (topicId) {
    try {
      await recalcularSaude(topicId);
    } catch (e) {
      console.error('Saúde não recalculada (sessão salva mesmo assim):', e);
    }
  }

  // Auto-cumpre um bloco do cronograma se houver um pendente do mesmo tópico hoje.
  // Também não deve impedir o save — try/catch isolado.
  if (topicId) {
    try {
      // Data LOCAL da sessão (não "hoje"): registro retroativo precisa cumprir o
      // bloco daquele dia, e uma sessão virada de meia-noite pertence ao dia em
      // que começou — mesma referência usada no crédito do ciclo abaixo.
      await autoCompleteByTopic(
        topicId,
        session.sessionId,
        toLocalDateString(new Date(session.startedAt)),
      );
    } catch (e) {
      console.error('Bloco não auto-cumprido (sessão salva mesmo assim):', e);
    }
  }

  // Se a matéria estudada pertence a um ciclo ativo, soma os minutos da sessão
  // ao ciclo (modelo de acúmulo). Isolado em try/catch — nunca bloqueia o save.
  // O motivo de NÃO ter creditado é devolvido ao chamador: engolir isso num
  // console.error deixava o usuário com a sessão salva e o ciclo parado, sem
  // nenhuma explicação possível do lado dele.
  const subjectIdUsed = feedback.subjectId ?? session.subjectId;
  const minutos = Math.round(session.durationSec / 60);
  let cycleResult: SaveStudyLogResult = { cycleCredited: false, cycleSkipReason: 'sem_materia' };

  if (subjectIdUsed) {
    try {
      const cycleItem = await findCycleItemForSubject(subjectIdUsed);
      if (!cycleItem) {
        cycleResult = { cycleCredited: false, cycleSkipReason: 'materia_fora_do_ciclo' };
      } else if (minutos <= 0) {
        cycleResult = { cycleCredited: false, cycleSkipReason: 'curta_demais' };
      } else {
        await completeCycleSubject({
          ruleId: cycleItem.ruleId,
          itemId: cycleItem.itemId,
          subjectId: subjectIdUsed,
          minutes: minutos,
          source: session.source ?? 'timer',
          clientSessionId: session.sessionId,
          sessionDate: toLocalDateString(new Date(session.startedAt)),
        });
        cycleResult = { cycleCredited: true };
      }
    } catch (e) {
      console.error('Ciclo não atualizado (sessão salva mesmo assim):', e);
      cycleResult = { cycleCredited: false, cycleSkipReason: 'erro' };
    }
  }

  return cycleResult;
}

// ─── Correções pós-registro (Histórico) ─────────────────────────────────────
// Um registro manual com a duração errada (10h em vez de 1h) contaminaria as
// estatísticas, o streak e a meta para sempre — por isso duração é editável e a
// sessão é apagável. Ambos propagam para o ciclo (via client_session_id) e
// recalculam a Saúde do tópico.

export async function updateStudyLogDuration(logId: string, durationMinutes: number): Promise<void> {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Informe uma duração maior que zero.');
  }
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { data: log, error: readErr } = await supabase
    .from('study_logs')
    .select('id, started_at, topic_id, client_session_id')
    .eq('id', logId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (readErr || !log) throw new Error('Sessão não encontrada.');

  const durationSec = Math.round(durationMinutes * 60);
  const endedAt = new Date(new Date(log.started_at).getTime() + durationSec * 1000).toISOString();

  const { error } = await supabase
    .from('study_logs')
    .update({ duration_sec: durationSec, ended_at: endedAt })
    .eq('id', logId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao corrigir a duração: ' + error.message);

  // Propaga para o ciclo, se esta sessão gerou uma completion.
  // supabase-js NÃO lança em erro de banco — devolve { error }. O try/catch
  // sozinho era decorativo e engolia falha (ex.: violar o CHECK de 1440 min).
  if (log.client_session_id) {
    const { error: cycleErr } = await supabase
      .from('cycle_completions')
      .update({ minutes: Math.round(durationMinutes) })
      .eq('user_id', user.id)
      .eq('client_session_id', log.client_session_id);
    if (cycleErr) {
      throw new Error(
        'A duração foi corrigida, mas o ciclo não pôde ser ajustado: ' + cycleErr.message,
      );
    }
  }

  if (log.topic_id) {
    try { await recalcularSaude(log.topic_id); } catch { /* não bloqueia */ }
  }
}

export async function deleteStudyLog(logId: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { data: log, error: readErr } = await supabase
    .from('study_logs')
    .select('id, topic_id, client_session_id')
    .eq('id', logId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (readErr || !log) throw new Error('Sessão não encontrada.');

  const { error } = await supabase
    .from('study_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar a sessão: ' + error.message);

  // Mesmo motivo do update acima: sem checar `error`, a sessão sumia e o ciclo
  // seguia contando os minutos dela para sempre.
  if (log.client_session_id) {
    const { error: cycleErr } = await supabase
      .from('cycle_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('client_session_id', log.client_session_id);
    if (cycleErr) {
      throw new Error(
        'A sessão foi apagada, mas o ciclo não pôde ser atualizado: ' + cycleErr.message,
      );
    }
  }

  if (log.topic_id) {
    try { await recalcularSaude(log.topic_id); } catch { /* não bloqueia */ }
  }
}
