// services/reviews.service.ts
// Camada de aplicação: orquestra requireUser, repositório e algoritmo SM-2.
// Sem acesso direto ao Supabase. Sem duplicação de auth.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import {
  calculateNextReview, daysOverdue, DEFAULT_EASE_FACTOR,
  type RecallGrade,
} from '@/lib/spaced-repetition';
import { fromDbRow, toDbRow } from '@/lib/spaced-repetition.mapper';
import { localDateInDays, toLocalDateString, parseLocalDate } from '@/lib/local-date';
import { getArchivedSubjectIds } from '@/services/archivedCache';
import { getUserFeatures, srsModifierFor } from '@/services/userFeatures.service';
import * as repo from '@/services/reviews.repository';

// 'esqueci' = lapso (quality 0 no SM-2): zera repetições e volta o tópico para
// amanhã — antes o grade 'errou' existia no algoritmo mas era inalcançável.
export type ReviewRating = 'esqueci' | 'dificil' | 'intermediario' | 'facil';
const RATING_TO_GRADE: Record<ReviewRating, RecallGrade> = {
  esqueci: 'errou',
  dificil: 'dificil',
  intermediario: 'bom',
  facil: 'facil',
};

export interface ReviewItem {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  nextReviewDate: string | null;
  overdueDays: number;
  // Próximos intervalos pré-computados — exibidos nos botões de avaliação (inspiração Anki).
  nextIntervals: { esqueci: number; dificil: number; intermediario: number; facil: number };
}

// ---------- Queries ----------

export async function listDueReviews(): Promise<ReviewItem[]> {
  const auth = await tryGetUser();
  if (!auth) return [];

  // getArchivedSubjectIds tem cache de 5s; aguardar para repassar ao repo e filtrar no SQL.
  const [archivedIds, features] = await Promise.all([getArchivedSubjectIds(), getUserFeatures()]);
  const rows = await repo.fetchDueTopicReviews(auth.supabase, auth.userId, archivedIds);

  return rows.map(t => {
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    const srState = fromDbRow({ ease_factor: t.ease_factor, interval_days: t.interval_days, repetitions: t.repetitions });
    // Ajuste pessoal por matéria — os botões mostram o intervalo que será aplicado de fato.
    const mod = srsModifierFor(features, t.subject_id);
    return {
      id: t.id,
      name: t.name,
      subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#C9B8DD',
      nextReviewDate: t.next_review_date,
      overdueDays: daysOverdue(t.next_review_date),
      nextIntervals: {
        esqueci:      calculateNextReview(srState, RATING_TO_GRADE.esqueci, new Date(), mod).intervalDays,
        dificil:      calculateNextReview(srState, RATING_TO_GRADE.dificil, new Date(), mod).intervalDays,
        intermediario: calculateNextReview(srState, RATING_TO_GRADE.intermediario, new Date(), mod).intervalDays,
        facil:        calculateNextReview(srState, RATING_TO_GRADE.facil, new Date(), mod).intervalDays,
      },
    };
  });
}

// Retorna a data da próxima revisão agendada (para o empty state após a sessão).
// Exclui matérias arquivadas — senão um tópico esquecido numa matéria arquivada
// aparece como "próxima revisão" mesmo vencido há meses, contradizendo a fila
// (que já o exclui corretamente).
export async function getNextScheduledDate(): Promise<string | null> {
  const auth = await tryGetUser();
  if (!auth) return null;
  const archivedIds = await getArchivedSubjectIds();
  const base = auth.supabase
    .from('topics')
    .select('next_review_date')
    .eq('user_id', auth.userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null);
  const query = archivedIds.length > 0
    ? base.not('subject_id', 'in', `(${archivedIds.join(',')})`)
    : base;
  const { data } = await query
    .order('next_review_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.next_review_date ?? null;
}

export async function countDueReviews(): Promise<number> {
  const auth = await tryGetUser();
  if (!auth) return 0;
  const archivedIds = await getArchivedSubjectIds();
  return repo.countDueTopicReviews(auth.supabase, auth.userId, archivedIds);
}

export async function getOldestDueTopicDate(): Promise<string | null> {
  const auth = await tryGetUser();
  if (!auth) return null;
  const archivedIds = await getArchivedSubjectIds();
  return repo.fetchOldestDueTopicDate(auth.supabase, auth.userId, archivedIds);
}

export async function getReviewStatus(topicId: string): Promise<boolean> {
  const auth = await tryGetUser();
  if (!auth) return false;
  return repo.fetchTopicReviewActive(auth.supabase, auth.userId, topicId);
}

export interface TopicReviewSchedule {
  isActive: boolean;
  nextReviewDate: string | null;
}

// Estado de agendamento de um tópico (para o Caderno mostrar, ao reabrir um
// erro, se aquele tópico já está em revisão e quando vence).
export async function getTopicReviewSchedule(topicId: string): Promise<TopicReviewSchedule | null> {
  const auth = await tryGetUser();
  if (!auth) return null;
  const row = await repo.fetchTopicSchedule(auth.supabase, auth.userId, topicId);
  if (!row) return null;
  return { isActive: row.is_review_active, nextReviewDate: row.next_review_date };
}

// ---------- Mutations ----------

export async function activateReview(topicId: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await repo.updateTopicReview(supabase, userId, topicId, {
    is_review_active: true,
    next_review_date: localDateInDays(1),
    interval_days: 1,
    repetitions: 0,
    ease_factor: 2.5,
  });
}

export async function deactivateReview(topicId: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await repo.updateTopicReview(supabase, userId, topicId, {
    is_review_active: false,
    next_review_date: null,
  });
}

export async function submitReview(topicId: string, rating: ReviewRating): Promise<void> {
  const { supabase, userId } = await requireUser();
  const [topic, features] = await Promise.all([
    repo.fetchTopicSRState(supabase, userId, topicId),
    getUserFeatures(),
  ]);
  const mod = srsModifierFor(features, topic.subject_id);
  const result = calculateNextReview(fromDbRow(topic), RATING_TO_GRADE[rating], new Date(), mod);
  await repo.updateTopicReview(supabase, userId, topicId, toDbRow(result));
}

export async function rescheduleReview(topicId: string, dateStr: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const todayMs = parseLocalDate(toLocalDateString()).getTime();
  const targetMs = parseLocalDate(dateStr).getTime();
  const intervalDays = Math.max(1, Math.round((targetMs - todayMs) / 86_400_000));
  await repo.updateTopicReview(supabase, userId, topicId, {
    next_review_date: dateStr,
    is_review_active: true,
    interval_days: intervalDays,
  });
}

// Agenda (ou antecipa) a revisão de um tópico a partir de um erro registrado.
// Regra: nunca atrasa — fica com a data mais próxima entre a agendada e a nova.
export async function scheduleReviewFromError(topicId: string, days: number): Promise<void> {
  const { supabase, userId } = await requireUser();
  const current = await repo.fetchTopicSchedule(supabase, userId, topicId);
  const novaData = localDateInDays(days);
  const dataFinal = (current?.is_review_active && current.next_review_date && current.next_review_date < novaData)
    ? current.next_review_date
    : novaData;

  const todayMs = parseLocalDate(toLocalDateString()).getTime();
  const targetMs = parseLocalDate(dataFinal).getTime();
  const intervalDays = Math.max(1, Math.round((targetMs - todayMs) / 86_400_000));
  await repo.updateTopicReview(supabase, userId, topicId, {
    next_review_date: dataFinal,
    is_review_active: true,
    interval_days: intervalDays,
    repetitions: 0,
    ease_factor: DEFAULT_EASE_FACTOR,
  });
}
