// services/reviews.service.ts
import { createClient } from '@/lib/supabase/client';
import {
  calculateNextReview, fromDbRow, toDbRow, isDue, daysOverdue,
  type RecallGrade,
} from '@/lib/spaced-repetition';
import { localDateInDays } from '@/lib/local-date';
import { getArchivedSubjectIds } from '@/services/catalog.service';

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
}

export async function activateReview(topicId: string): Promise<void> {
  const supabase = createClient();
  const dateStr = localDateInDays(1);

  const { error } = await supabase
    .from('topics')
    .update({
      is_review_active: true,
      next_review_date: dateStr,
      interval_days: 1,
      repetitions: 0,
      ease_factor: 2.5,
    })
    .eq('id', topicId);

  if (error) throw new Error('Erro ao ativar revisão: ' + error.message);
}

export async function deactivateReview(topicId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('topics')
    .update({ is_review_active: false, next_review_date: null })
    .eq('id', topicId);
  if (error) throw new Error('Erro ao desativar revisão: ' + error.message);
}

export async function listDueReviews(): Promise<ReviewItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const archivedIds = await getArchivedSubjectIds();

  const { data: allTopics, error } = await supabase
    .from('topics')
    .select('id, name, subject_id, next_review_date, subjects(name, color)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .order('next_review_date', { ascending: true });

  // Filtra matérias arquivadas em JS (evita type-depth errors do Supabase builder)
  const archivedSet = new Set(archivedIds);
  const data = archivedIds.length > 0
    ? (allTopics ?? []).filter(t => !archivedSet.has(t.subject_id))
    : (allTopics ?? []);
  if (error) throw new Error('Erro ao listar revisões: ' + error.message);

  return (data ?? [])
    .filter((t) => isDue(t.next_review_date))
    .map((t) => {
      const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
      return {
        id: t.id,
        name: t.name,
        subjectId: t.subject_id,
        subjectName: subj?.name ?? 'Matéria',
        subjectColor: subj?.color ?? '#C9B8DD',
        nextReviewDate: t.next_review_date,
        overdueDays: daysOverdue(t.next_review_date),
      };
    });
}

export async function countDueReviews(): Promise<number> {
  const items = await listDueReviews();
  return items.length;
}

export async function submitReview(topicId: string, rating: ReviewRating): Promise<void> {
  const supabase = createClient();

  const { data: topic, error: readError } = await supabase
    .from('topics')
    .select('ease_factor, interval_days, repetitions')
    .eq('id', topicId)
    .single();

  if (readError || !topic) throw new Error('Erro ao ler tópico: ' + readError?.message);

  const grade = RATING_TO_GRADE[rating];
  const current = fromDbRow(topic);
  const result = calculateNextReview(current, grade);
  const updates = toDbRow(result);

  const { error } = await supabase.from('topics').update(updates).eq('id', topicId);
  if (error) throw new Error('Erro ao salvar revisão: ' + error.message);
}

export async function rescheduleReview(topicId: string, dateStr: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('topics')
    .update({ next_review_date: dateStr, is_review_active: true })
    .eq('id', topicId);
  if (error) throw new Error('Erro ao reagendar: ' + error.message);
}

export function dateInDays(days: number): string {
  return localDateInDays(days);
}

export async function getReviewStatus(topicId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topics')
    .select('is_review_active')
    .eq('id', topicId)
    .maybeSingle();
  if (error) return false;
  return data?.is_review_active ?? false;
}
// Agenda (ou antecipa) a revisão de um tópico a partir de um erro registrado.
// Regra de antecipação limpa: nunca atrasa — fica com a data mais próxima
// entre a já agendada e a nova (hoje + days).
export async function scheduleReviewFromError(topicId: string, days: number): Promise<void> {
  const supabase = createClient();

  // Lê o estado atual da revisão do tópico.
  const { data: topic } = await supabase
    .from('topics')
    .select('next_review_date, is_review_active')
    .eq('id', topicId)
    .maybeSingle();

  const novaData = dateInDays(days); // 'YYYY-MM-DD'

  // Se já há uma data agendada, fica com a MAIS PRÓXIMA (string ISO compara direto).
  let dataFinal = novaData;
  if (topic?.is_review_active && topic?.next_review_date) {
    dataFinal = topic.next_review_date < novaData ? topic.next_review_date : novaData;
  }

  await rescheduleReview(topicId, dataFinal);
}
