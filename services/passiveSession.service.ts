// services/passiveSession.service.ts
// Registro PASSIVO de sessão: os players (fila unificada, revisão/simulado de
// lei seca, revisão de jurisprudência, flashcards) gravam UMA study_log agregada
// ao concluir, sem o usuário cronometrar nada. Fecha a maior lacuna do motor de
// progresso: estudar por revisões/flashcards/VM/juris não contava para streak,
// metas, conquistas nem Performance — só o timer contava.
//
// Decisões de desenho:
// - UMA linha por sessão concluída, nunca uma por item (200 flashcards = 200
//   micro-rows envenenariam médias, contagem de sessões e o histórico).
// - Duração MEDIDA no cliente (agora - início do player), com teto de 3h para
//   não inflar streak/metas se a aba ficou aberta esquecida, e piso de 30s
//   para ignorar aberturas acidentais.
// - Dedupe pelo mesmo mecanismo do timer: upsert por (user_id,
//   client_session_id) com ignoreDuplicates — reenvio/duplo clique não duplica.
// - NÃO passa por saveStudyLog: os efeitos colaterais de lá (auto-completar
//   bloco, recalcular saúde de tópico) pressupõem tópico escolhido pelo usuário;
//   a sessão passiva é agregada e sem tópico. EXCEÇÃO: o ciclo é creditado aqui
//   mesmo (quando a sessão inteira é de uma matéria só), porque estudo real da
//   matéria não pode ficar de fora do ciclo — a Home dizia "2h30 hoje" e o ciclo
//   "0min" logo abaixo, sem explicação possível para o usuário.
// - questions_total/correct só para modos onde acerto agregado faz sentido
//   (simulado de lei). Avaliações de SRS (fácil/difícil) NÃO são "questões".

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { track, EV } from '@/lib/analytics';
import { emitSessionSaved } from '@/lib/session-celebration';
import { toLocalDateString } from '@/lib/local-date';
import { findCycleItemForSubject, completeCycleSubject } from '@/services/cycleEngine.service';

export type PassiveMode = 'revisao' | 'leitura_lei' | 'jurisprudencia' | 'flashcards' | 'questoes';

const MIN_DURACAO_SEC = 30;            // abaixo disso foi abertura acidental
const MAX_DURACAO_SEC = 3 * 3600;      // teto: aba esquecida não vira "3h de estudo"

export interface PassiveSessionInput {
  mode: PassiveMode;
  /** epoch ms de quando o player começou (Date.now() na montagem da fila). */
  startedAtMs: number;
  /** Itens concluídos — vai no qualitative_feedback para o Histórico ter contexto. */
  itemsLabel: string;             // ex.: "12 revisões (5 tópicos, 4 flashcards, 3 leis)"
  questionsTotal?: number;        // só para simulados (acerto real)
  questionsCorrect?: number;
  subjectId?: string | null;      // quando o player inteiro é de uma matéria só
}

/**
 * Grava a sessão passiva. Nunca lança: o registro é um bônus — falhar aqui não
 * pode quebrar a tela de conclusão do player. Retorna true se gravou.
 */
export async function savePassiveSession(input: PassiveSessionInput): Promise<boolean> {
  try {
    const endedMs = Date.now();
    const durationSec = Math.min(
      MAX_DURACAO_SEC,
      Math.round((endedMs - input.startedAtMs) / 1000),
    );
    if (!Number.isFinite(durationSec) || durationSec < MIN_DURACAO_SEC) return false;

    const user = await getCachedUser();
    if (!user) return false;

    const supabase = createClient();
    // Prefixo "passive-" + início: identifica a origem e deduplica reenvios da
    // MESMA sessão do player (mesmo startedAtMs ⇒ mesmo id).
    const clientSessionId = `passive-${input.mode}-${input.startedAtMs}`;

    const { error } = await supabase.from('study_logs').upsert({
      user_id: user.id,
      client_session_id: clientSessionId,
      topic_id: null,
      subject_id: input.subjectId ?? null,
      board_id: null,
      mode: input.mode,
      started_at: new Date(input.startedAtMs).toISOString(),
      ended_at: new Date(endedMs).toISOString(),
      duration_sec: durationSec,
      questions_total: input.questionsTotal ?? 0,
      questions_correct: input.questionsCorrect ?? 0,
      qualitative_feedback: input.itemsLabel,
      energy_level: null,
      insight: '',
      error_cause: null,
    }, {
      onConflict: 'user_id,client_session_id',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error('Sessão passiva não registrada:', error.message);
      return false;
    }

    // Credita o ciclo quando a sessão toda é de uma matéria só. Mesmo
    // clientSessionId da study_log: o índice único (user_id, client_session_id)
    // impede crédito duplo em reenvio, e editar/apagar a sessão propaga.
    const minutos = Math.round(durationSec / 60);
    if (input.subjectId && minutos > 0) {
      try {
        const cycleItem = await findCycleItemForSubject(input.subjectId);
        if (cycleItem) {
          await completeCycleSubject({
            ruleId: cycleItem.ruleId,
            itemId: cycleItem.itemId,
            subjectId: input.subjectId,
            minutes: minutos,
            source: 'timer',
            clientSessionId,
            sessionDate: toLocalDateString(new Date(input.startedAtMs)),
          });
        }
      } catch (e) {
        // Nunca quebra a tela de conclusão do player.
        console.error('Ciclo não atualizado (sessão passiva registrada mesmo assim):', e);
      }
    }

    track(EV.studyCompleted, {
      minutes: Math.round(durationSec / 60),
      mode: input.mode,
      passive: true,
    });
    // Mesma celebração imediata do timer — a recompensa vale para todo estudo.
    emitSessionSaved({
      minutes: Math.round(durationSec / 60),
      dateLocal: toLocalDateString(new Date(input.startedAtMs)),
    });
    return true;
  } catch (e) {
    console.error('Sessão passiva não registrada:', e);
    return false;
  }
}
