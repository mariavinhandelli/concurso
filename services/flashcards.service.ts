// services/flashcards.service.ts
// CRUD + revisão SM-2 de flashcards. Reusa o motor de spaced-repetition.

import { createClient } from '@/lib/supabase/client';
import {
  calculateNextReview, fromDbRow, toDbRow, isDue, daysOverdue,
  type RecallGrade,
} from '@/lib/spaced-repetition';
import { localDateInDays, toLocalDateString } from '@/lib/local-date';
import { getArchivedSubjectIds } from '@/services/catalog.service';

export type ReviewRating = 'dificil' | 'intermediario' | 'facil';
const RATING_TO_GRADE: Record<ReviewRating, RecallGrade> = {
  dificil: 'dificil', intermediario: 'bom', facil: 'facil',
};

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

export async function createFlashcard(input: FlashcardInput): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  let reviewFields = {};
  if (input.addToReview) {
    reviewFields = {
      is_review_active: true,
      next_review_date: localDateInDays(1),
      interval_days: 1,
      repetitions: 0,
      ease_factor: 2.5,
    };
  }

  const { error } = await supabase.from('flashcards').insert({
    user_id: user.id,
    front: input.front,
    back: input.back,
    topic_id: input.topicId,
    subject_id: input.subjectId,
    source_error_id: input.sourceErrorId,
    ...reviewFields,
  });

  if (error) throw new Error('Erro ao criar flashcard: ' + error.message);
}

// Lista cards, com filtros opcionais (para a aba "Meus Cards").
export async function listFlashcards(filters?: {
  subjectId?: string | null;
  topicId?: string | null;
}): Promise<Flashcard[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('flashcards')
    .select('id, front, back, topic_id, subject_id, source_error_id, is_review_active, next_review_date, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters?.topicId === null) query = query.is('topic_id', null);
  else if (filters?.topicId) query = query.eq('topic_id', filters.topicId);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar flashcards: ' + error.message);
  return data ?? [];
}

// Conta flashcards por matéria (para navegação nível 1).
export async function countFlashcardsBySubject(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('flashcards')
    .select('subject_id')
    .eq('user_id', user.id);

  if (error) throw new Error('Erro ao contar: ' + error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = row.subject_id ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Cards que vencem hoje (modo revisar + hub).
export async function listDueCards(): Promise<DueCard[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const archivedIds = await getArchivedSubjectIds();

  let query = supabase
    .from('flashcards')
    .select('id, front, back, topic_id, subject_id, source_error_id, is_review_active, next_review_date, created_at, subjects(name, color)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .order('next_review_date', { ascending: true });

  if (archivedIds.length > 0) {
    query = query.not('subject_id', 'in', `(${archivedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar revisões: ' + error.message);

  return (data ?? [])
    .filter((c) => isDue(c.next_review_date))
    .map((c) => {
      const subj = Array.isArray(c.subjects) ? c.subjects[0] : c.subjects;
      return {
        id: c.id, front: c.front, back: c.back,
        topic_id: c.topic_id, subject_id: c.subject_id, source_error_id: c.source_error_id,
        is_review_active: c.is_review_active, next_review_date: c.next_review_date, created_at: c.created_at,
        subjectName: subj?.name ?? 'Sem matéria',
        subjectColor: subj?.color ?? '#C9B8DD',
        overdueDays: daysOverdue(c.next_review_date),
      };
    });
}

export async function countDueCards(): Promise<number> {
  const items = await listDueCards();
  return items.length;
}

// Avalia uma revisão de flashcard (mesmo SM-2 dos tópicos).
export async function submitCardReview(cardId: string, rating: ReviewRating): Promise<void> {
  const supabase = createClient();

  const { data: card, error: readError } = await supabase
    .from('flashcards')
    .select('ease_factor, interval_days, repetitions')
    .eq('id', cardId)
    .single();

  if (readError || !card) throw new Error('Erro ao ler card: ' + readError?.message);

  const result = calculateNextReview(fromDbRow(card), RATING_TO_GRADE[rating]);
  const updates = { ...toDbRow(result), is_review_active: true };
  const { error } = await supabase.from('flashcards').update(updates).eq('id', cardId);
  if (error) throw new Error('Erro ao salvar revisão: ' + error.message);

}

// Ativa revisão de um card existente (para cards criados sem revisão).
export async function activateCardReview(cardId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('flashcards').update({
    is_review_active: true,
    next_review_date: localDateInDays(1),
    interval_days: 1, repetitions: 0, ease_factor: 2.5,
  }).eq('id', cardId);
  if (error) throw new Error('Erro ao ativar revisão: ' + error.message);
}

export async function deleteFlashcard(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('flashcards').delete().eq('id', id);
  if (error) throw new Error('Erro ao apagar flashcard: ' + error.message);
}

export async function countFlashcardsByError(errorId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('source_error_id', errorId);
  if (error) return 0;
  return count ?? 0;
}
// ---------- MONTAGEM DA FILA DE ESTUDO (estilo Anki) ----------

const DAILY_NEW_LIMIT = 20;

export interface QueueCard {
  id: string;
  front: string;
  back: string;
  subjectName?: string;
  subjectColor?: string;
  isNew?: boolean;
}

// Converte uma linha do banco em QueueCard.
function toQueueCard(c: {
  id: string; front: string; back: string;
  next_review_date: string | null;
  subjects?: { name: string; color: string } | { name: string; color: string }[] | null;
}): QueueCard {
  const subj = Array.isArray(c.subjects) ? c.subjects[0] : c.subjects;
  return {
    id: c.id, front: c.front, back: c.back,
    subjectName: subj?.name ?? 'Sem matéria',
    subjectColor: subj?.color ?? '#C9B8DD',
    isNew: c.next_review_date === null,
  };
}

// Fila do dia: todos os pendentes + novos (até o limite diário).
export async function buildDailyQueue(): Promise<QueueCard[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = toLocalDateString();
  const archivedIds = await getArchivedSubjectIds();

  // Pendentes: têm data e ela já venceu.
  let pendingQ = supabase
    .from('flashcards')
    .select('id, front, back, next_review_date, subjects(name, color)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });
  if (archivedIds.length > 0) pendingQ = pendingQ.not('subject_id', 'in', `(${archivedIds.join(',')})`);

  // Novos: nunca revisados (sem data).
  let newQ = supabase
    .from('flashcards')
    .select('id, front, back, next_review_date, subjects(name, color)')
    .eq('user_id', user.id)
    .is('next_review_date', null)
    .order('created_at', { ascending: true })
    .limit(DAILY_NEW_LIMIT);
  if (archivedIds.length > 0) newQ = newQ.not('subject_id', 'in', `(${archivedIds.join(',')})`);

  const [{ data: pendingData }, { data: newData }] = await Promise.all([pendingQ, newQ]);

  const pending = (pendingData ?? []).map(toQueueCard);
  const news = (newData ?? []).map(toQueueCard);
  return [...pending, ...news];
}

// Fila de um tópico (ou matéria): pendentes + novos daquele recorte, sem limite.
export async function buildTopicQueue(
  scope: { subjectId: string; topicId?: string | null },
): Promise<QueueCard[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = toLocalDateString();
  let query = supabase
    .from('flashcards')
    .select('id, front, back, next_review_date, created_at, subjects(name, color)')
    .eq('user_id', user.id)
    .eq('subject_id', scope.subjectId)
    .or(`next_review_date.is.null,next_review_date.lte.${today}`);

  if (scope.topicId === null) query = query.is('topic_id', null);
  else if (scope.topicId) query = query.eq('topic_id', scope.topicId);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao montar fila de estudo: ' + error.message);
  const cards = (data ?? []).map(toQueueCard);

  // Pendentes primeiro (não-novos), depois novos.
  const pending = cards.filter((c) => !c.isNew);
  const news = cards.filter((c) => c.isNew);
  return [...pending, ...news];
}

// Contagem para o Dashboard (Quick Start).
export async function countDailyQueue(): Promise<{ pending: number; news: number }> {
  const queue = await buildDailyQueue();
  return {
    pending: queue.filter((c) => !c.isNew).length,
    news: queue.filter((c) => c.isNew).length,
  };
}
