// services/flashcards.service.ts
// Camada de aplicação: orquestra auth, repositório e algoritmo SM-2.
// Sem acesso direto ao Supabase. Sem duplicação de auth.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import { calculateNextReview, daysOverdue, type RecallGrade } from '@/lib/spaced-repetition';
import { fromDbRow, toDbRow } from '@/lib/spaced-repetition.mapper';
import { localDateInDays, toLocalDateString } from '@/lib/local-date';
import { getArchivedSubjectIds } from '@/services/archivedCache';
import * as repo from '@/services/flashcards.repository';

export type ReviewRating = 'dificil' | 'intermediario' | 'facil';
const RATING_TO_GRADE: Record<ReviewRating, RecallGrade> = {
  dificil: 'dificil', intermediario: 'bom', facil: 'facil',
};

const DAILY_NEW_LIMIT = 20;

// ---------- Tipos de domínio ----------

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic_id: string | null;
  subject_id: string | null;
  source_error_id: string | null;
  is_review_active: boolean;
  next_review_date: string | null;
  created_at: string;
}

export interface FlashcardInput {
  front: string;
  back: string;
  topicId: string | null;
  subjectId: string | null;
  sourceErrorId: string | null;
  addToReview: boolean;
}

export interface DueCard extends Flashcard {
  subjectName: string;
  subjectColor: string;
  overdueDays: number;
}

export interface QueueCard {
  id: string;
  front: string;
  back: string;
  subjectName?: string;
  subjectColor?: string;
  isNew?: boolean;
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
}

// ---------- Helpers privados ----------

function toQueueCard(c: repo.FlashcardQueueRow): QueueCard {
  const subj = Array.isArray(c.subjects) ? c.subjects[0] : c.subjects;
  return {
    id: c.id, front: c.front, back: c.back,
    subjectName: subj?.name ?? 'Sem matéria',
    subjectColor: subj?.color ?? '#C9B8DD',
    isNew: c.next_review_date === null,
    easeFactor: c.ease_factor ?? undefined,
    intervalDays: c.interval_days ?? undefined,
    repetitions: c.repetitions ?? undefined,
  };
}

// ---------- Mutations ----------

export async function createFlashcard(input: FlashcardInput): Promise<void> {
  const { supabase, userId } = await requireUser();

  const reviewFields = input.addToReview ? {
    is_review_active: true,
    next_review_date: localDateInDays(1),
    interval_days: 1,
    repetitions: 0,
    ease_factor: 2.5,
  } : {};

  await repo.insertFlashcard(supabase, userId, {
    front: input.front,
    back: input.back,
    topic_id: input.topicId,
    subject_id: input.subjectId,
    source_error_id: input.sourceErrorId,
    ...reviewFields,
  });
}

export async function submitCardReview(cardId: string, rating: ReviewRating): Promise<void> {
  const { supabase, userId } = await requireUser();
  const row = await repo.fetchCardSRState(supabase, userId, cardId);
  const result = calculateNextReview(fromDbRow(row), RATING_TO_GRADE[rating]);
  await repo.updateFlashcard(supabase, userId, cardId, { ...toDbRow(result), is_review_active: true });
}

export async function activateCardReview(cardId: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await repo.updateFlashcard(supabase, userId, cardId, {
    is_review_active: true,
    next_review_date: localDateInDays(1),
    interval_days: 1,
    repetitions: 0,
    ease_factor: 2.5,
  });
}

export async function updateFlashcardContent(id: string, front: string, back: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await repo.updateFlashcard(supabase, userId, id, { front: front.trim(), back: back.trim() });
}

export async function deleteFlashcard(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await repo.deleteFlashcard(supabase, userId, id);
}

// ---------- Queries ----------

export async function listFlashcards(filters?: {
  subjectId?: string | null;
  topicId?: string | null;
}): Promise<Flashcard[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  return repo.fetchFlashcards(auth.supabase, auth.userId, filters);
}

export async function countFlashcardsBySubject(): Promise<Record<string, number>> {
  const auth = await tryGetUser();
  if (!auth) return {};
  const rows = await repo.fetchSubjectIds(auth.supabase, auth.userId);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.subject_id ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function listDueCards(): Promise<DueCard[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  const today = toLocalDateString();
  const [archivedIds, rows] = await Promise.all([
    getArchivedSubjectIds(),
    repo.fetchDueCardsWithSubject(auth.supabase, auth.userId, today),
  ]);
  const excluded = new Set(archivedIds);
  const filtered = excluded.size > 0
    ? rows.filter(c => !c.subject_id || !excluded.has(c.subject_id))
    : rows;

  return filtered.map(c => {
      const subj = Array.isArray(c.subjects) ? c.subjects[0] : c.subjects;
      return {
        id: c.id, front: c.front, back: c.back,
        topic_id: c.topic_id, subject_id: c.subject_id,
        source_error_id: c.source_error_id,
        is_review_active: c.is_review_active,
        next_review_date: c.next_review_date,
        created_at: c.created_at,
        subjectName: subj?.name ?? 'Sem matéria',
        subjectColor: subj?.color ?? '#C9B8DD',
        overdueDays: daysOverdue(c.next_review_date),
      };
    });
}

export async function countDueCards(): Promise<number> {
  const auth = await tryGetUser();
  if (!auth) return 0;
  const archivedIds = await getArchivedSubjectIds();
  return repo.countDueFlashcards(auth.supabase, auth.userId, toLocalDateString(), archivedIds);
}

export async function countFlashcardsByError(errorId: string): Promise<number> {
  const auth = await tryGetUser();
  if (!auth) return 0;
  return repo.countFlashcardsByError(auth.supabase, auth.userId, errorId);
}

// ---------- Queue building ----------

export async function buildDailyQueue(): Promise<QueueCard[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  const today = toLocalDateString();
  // Paralelo: archived IDs + fetches simultâneos; filtra archived em JS depois
  const [archivedIds, pendingRaw, newsRaw] = await Promise.all([
    getArchivedSubjectIds(),
    repo.fetchPendingCards(auth.supabase, auth.userId, today, []),
    repo.fetchNewCards(auth.supabase, auth.userId, DAILY_NEW_LIMIT, []),
  ]);

  if (archivedIds.length === 0) {
    return [...pendingRaw.map(toQueueCard), ...newsRaw.map(toQueueCard)];
  }
  const excluded = new Set(archivedIds);
  const filterCard = (c: repo.FlashcardQueueRow) => !c.subject_id || !excluded.has(c.subject_id);
  return [
    ...pendingRaw.filter(filterCard).map(toQueueCard),
    ...newsRaw.filter(filterCard).map(toQueueCard),
  ];
}

// Fila de revisão restrita às matérias de um concurso-alvo (ex.: botão
// "Flashcards" no hub de Targets) — mesma lógica de buildDailyQueue, mas
// com includeSubjectIds em vez de olhar todas as matérias do usuário.
export async function buildTargetQueue(subjectIds: string[]): Promise<QueueCard[]> {
  const auth = await tryGetUser();
  if (!auth || subjectIds.length === 0) return [];
  const today = toLocalDateString();
  const [archivedIds, pendingRaw, newsRaw] = await Promise.all([
    getArchivedSubjectIds(),
    repo.fetchPendingCards(auth.supabase, auth.userId, today, [], subjectIds),
    repo.fetchNewCards(auth.supabase, auth.userId, DAILY_NEW_LIMIT, [], subjectIds),
  ]);

  if (archivedIds.length === 0) {
    return [...pendingRaw.map(toQueueCard), ...newsRaw.map(toQueueCard)];
  }
  const excluded = new Set(archivedIds);
  const filterCard = (c: repo.FlashcardQueueRow) => !c.subject_id || !excluded.has(c.subject_id);
  return [
    ...pendingRaw.filter(filterCard).map(toQueueCard),
    ...newsRaw.filter(filterCard).map(toQueueCard),
  ];
}

export async function buildTopicQueue(
  scope: { subjectId: string; topicId?: string | null },
): Promise<QueueCard[]> {
  const auth = await tryGetUser();
  if (!auth) return [];

  const archivedIds = await getArchivedSubjectIds();
  if (archivedIds.includes(scope.subjectId)) return [];

  const today = toLocalDateString();
  const rows = await repo.fetchTopicCards(
    auth.supabase, auth.userId, scope.subjectId, scope.topicId, today,
  );
  const cards = rows.map(toQueueCard);
  return [...cards.filter(c => !c.isNew), ...cards.filter(c => c.isNew)];
}

export async function countDailyQueue(): Promise<{ pending: number; news: number }> {
  const auth = await tryGetUser();
  if (!auth) return { pending: 0, news: 0 };

  const today = toLocalDateString();
  const archivedIds = await getArchivedSubjectIds();

  const [pendingCount, newCount] = await Promise.all([
    repo.countDueFlashcards(auth.supabase, auth.userId, today, archivedIds),
    repo.countNewFlashcards(auth.supabase, auth.userId, archivedIds),
  ]);

  return { pending: pendingCount, news: Math.min(newCount, DAILY_NEW_LIMIT) };
}
