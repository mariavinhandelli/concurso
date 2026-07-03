// services/reviews.service.ts
// Camada de aplicação: orquestra requireUser, repositório e algoritmo SM-2.
// Sem acesso direto ao Supabase. Sem duplicação de auth.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import {
  calculateNextReview, daysOverdue,
  type RecallGrade,
} from '@/lib/spaced-repetition';
import { fromDbRow, toDbRow } from '@/lib/spaced-repetition.mapper';
import { localDateInDays, toLocalDateString, parseLocalDate } from '@/lib/local-date';
import { getArchivedSubjectIds } from '@/services/catalog.service';
import * as repo from '@/services/reviews.repository';

export type ReviewRating = 'dificil' | 'intermediario' | 'facil';
const RATING_TO_GRADE: Record<ReviewRating, RecallGrade> = {
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
  nextIntervals: { dificil: number; intermediario: number; facil: number };
}

// ---------- Queries ----------

export async function listDueReviews(): Promise<ReviewItem[]> {
  const auth = await tryGetUser();
  if (!auth) return [];

  // Paralelo: não espera getArchivedSubjectIds() para iniciar fetchDueTopicReviews.
  const [archivedIds, rows] = await Promise.all([
    getArchivedSubjectIds(),
    repo.fetchDueTopicReviews(auth.supabase, auth.userId),
  ]);

  const excludeSet = new Set(archivedIds);
  const filtered = excludeSet.size > 0 ? rows.filter(t => !excludeSet.has(t.subject_id)) : rows;

  return filtered.map(t => {
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    const srState = fromDbRow({ ease_factor: t.ease_factor, interval_days: t.interval_days, repetitions: t.repetitions });
    return {
      id: t.id,
      name: t.name,
      subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#C9B8DD',
      nextReviewDate: t.next_review_date,
      overdueDays: daysOverdue(t.next_review_date),
      nextIntervals: {
        dificil:      calculateNextReview(srState, RATING_TO_GRADE.dificil).intervalDays,
        intermediario: calculateNextReview(srState, RATING_TO_GRADE.intermediario).intervalDays,
        facil:        calculateNextReview(srState, RATING_TO_GRADE.facil).intervalDays,
      },
    };
  });
}

// Retorna a data da próxima revisão agendada (para o empty state após a sessão).
export async function getNextScheduledDate(): Promise<string | null> {
  const auth = await tryGetUser();
  if (!auth) return null;
  const { data } = await auth.supabase
    .from('topics')
    .select('next_review_date')
    .eq('user_id', auth.userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
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

export async function getReviewStatus(topicId: string): Promise<boolean> {
  const auth = await tryGetUser();
  if (!auth) return false;
  return repo.fetchTopicReviewActive(auth.supabase, auth.userId, topicId);
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
  const topic = await repo.fetchTopicSRState(supabase, userId, topicId);
  const result = calculateNextReview(fromDbRow(topic), RATING_TO_GRADE[rating]);
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
  });
}
