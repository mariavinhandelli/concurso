// services/reviews.repository.ts
// Acesso a dados de revisões de tópicos. Sem lógica de negócio.
// Recebe supabase + userId já resolvidos pelo serviço (auth é responsabilidade do chamador).
// excludeSubjectIds é parâmetro explícito — sem cross-domain import de catalog.

import type { SupabaseClient } from '@supabase/supabase-js';
import { toLocalDateString } from '@/lib/local-date';

export interface TopicReviewRow {
  id: string;
  name: string;
  subject_id: string;
  next_review_date: string | null;
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  subjects: { name: string; color: string } | { name: string; color: string }[] | null;
}

export interface TopicSRStateRow {
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
}

export interface TopicScheduleRow {
  next_review_date: string | null;
  is_review_active: boolean;
}

export async function fetchDueTopicReviews(
  supabase: SupabaseClient,
  userId: string,
  excludeSubjectIds: string[] = [],
): Promise<TopicReviewRow[]> {
  const base = supabase
    .from('topics')
    .select('id, name, subject_id, next_review_date, ease_factor, interval_days, repetitions, subjects(name, color)')
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .lte('next_review_date', toLocalDateString())
    .order('next_review_date', { ascending: true });

  const query = excludeSubjectIds.length > 0
    ? base.not('subject_id', 'in', `(${excludeSubjectIds.join(',')})`)
    : base;

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar revisões: ' + error.message);
  return data ?? [];
}

export async function fetchTopicSRState(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<TopicSRStateRow> {
  const { data, error } = await supabase
    .from('topics')
    .select('ease_factor, interval_days, repetitions')
    .eq('id', topicId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Erro ao ler tópico: ' + error?.message);
  return data;
}

export async function fetchTopicSchedule(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<TopicScheduleRow | null> {
  const { data, error } = await supabase
    .from('topics')
    .select('next_review_date, is_review_active')
    .eq('id', topicId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error('Erro ao ler agendamento: ' + error.message);
  return data;
}

export async function fetchTopicReviewActive(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('topics')
    .select('is_review_active')
    .eq('id', topicId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return false;
  return data?.is_review_active ?? false;
}

export async function updateTopicReview(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('topics')
    .update(fields)
    .eq('id', topicId)
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao salvar: ' + error.message);
}

export async function countDueTopicReviews(
  supabase: SupabaseClient,
  userId: string,
  excludeSubjectIds: string[] = [],
): Promise<number> {
  const base = supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .lte('next_review_date', toLocalDateString());

  const query = excludeSubjectIds.length > 0
    ? base.not('subject_id', 'in', `(${excludeSubjectIds.join(',')})`)
    : base;

  const { count } = await query;
  return count ?? 0;
}
