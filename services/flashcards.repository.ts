// services/flashcards.repository.ts
// Acesso a dados de flashcards. Sem lógica de negócio, sem auth.
// Recebe supabase + userId já resolvidos pelo serviço.
// excludeSubjectIds é parâmetro explícito — sem cross-domain import de catalog.

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- Tipos de linha do banco ----------

export interface FlashcardRow {
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

export interface FlashcardSRStateRow {
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  subject_id: string | null;
}

interface SubjectRef { name: string; color: string; }

export interface FlashcardQueueRow {
  id: string;
  front: string;
  back: string;
  subject_id?: string | null;
  next_review_date: string | null;
  ease_factor?: number | null;
  interval_days?: number | null;
  repetitions?: number | null;
  subjects?: SubjectRef | SubjectRef[] | null;
}

export interface FlashcardWithSubjectRow extends FlashcardRow {
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  subjects?: SubjectRef | SubjectRef[] | null;
}

// ---------- Queries ----------

export async function fetchFlashcards(
  supabase: SupabaseClient,
  userId: string,
  filters?: { subjectId?: string | null; topicId?: string | null },
): Promise<FlashcardRow[]> {
  let query = supabase
    .from('flashcards')
    .select('id, front, back, topic_id, subject_id, source_error_id, is_review_active, next_review_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters?.topicId === null) query = query.is('topic_id', null);
  else if (filters?.topicId) query = query.eq('topic_id', filters.topicId);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar flashcards: ' + error.message);
  return data ?? [];
}

export async function fetchCardSRState(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<FlashcardSRStateRow> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('ease_factor, interval_days, repetitions, subject_id')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Erro ao ler card: ' + error?.message);
  return data;
}

export async function fetchPendingCards(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  excludeSubjectIds: string[] = [],
  includeSubjectIds: string[] = [],
): Promise<FlashcardQueueRow[]> {
  let query = supabase
    .from('flashcards')
    .select('id, front, back, subject_id, next_review_date, ease_factor, interval_days, repetitions, subjects(name, color)')
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .lte('next_review_date', today);

  // includeSubjectIds restringe a fila a um conjunto (ex.: matérias de um
  // concurso-alvo) — diferente de excludeSubjectIds, que só tira as arquivadas.
  if (includeSubjectIds.length > 0) query = query.in('subject_id', includeSubjectIds);

  const { data, error } = await query.order('next_review_date', { ascending: true });

  if (error) throw new Error('Erro ao listar revisões: ' + error.message);

  const rows = data ?? [];
  if (excludeSubjectIds.length === 0) return rows;
  const excluded = new Set(excludeSubjectIds);
  return rows.filter(c => !c.subject_id || !excluded.has(c.subject_id));
}

export async function fetchNewCards(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  excludeSubjectIds: string[] = [],
  includeSubjectIds: string[] = [],
): Promise<FlashcardQueueRow[]> {
  let base = supabase
    .from('flashcards')
    .select('id, front, back, subject_id, next_review_date, ease_factor, interval_days, repetitions, subjects(name, color)')
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .is('next_review_date', null);

  if (includeSubjectIds.length > 0) base = base.in('subject_id', includeSubjectIds);

  // NULL-safe: cards sem subject_id nunca devem ser excluídos (subject_id.not.in
  // sozinho descartaria NULL, pois NULL NOT IN (...) é NULL/false em SQL).
  const query = excludeSubjectIds.length > 0
    ? base.or(`subject_id.is.null,subject_id.not.in.(${excludeSubjectIds.join(',')})`)
    : base;

  // Exclusão aplicada ANTES do limit — senão os N primeiros novos podem ser
  // todos de matérias arquivadas e a fila retorna vazia mesmo havendo cards elegíveis.
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error('Erro ao listar novos: ' + error.message);
  return data ?? [];
}

export async function fetchTopicCards(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string,
  topicId: string | null | undefined,
  today: string,
): Promise<FlashcardQueueRow[]> {
  let query = supabase
    .from('flashcards')
    .select('id, front, back, subject_id, next_review_date, ease_factor, interval_days, repetitions, subjects(name, color)')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .eq('is_review_active', true)
    .or(`next_review_date.is.null,next_review_date.lte.${today}`);

  if (topicId === null) query = query.is('topic_id', null);
  else if (topicId) query = query.eq('topic_id', topicId);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao montar fila de estudo: ' + error.message);
  return data ?? [];
}

export async function fetchDueCardsWithSubject(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  excludeSubjectIds: string[] = [],
): Promise<FlashcardWithSubjectRow[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, front, back, topic_id, subject_id, source_error_id, is_review_active, next_review_date, created_at, ease_factor, interval_days, repetitions, subjects(name, color)')
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });

  if (error) throw new Error('Erro ao listar revisões: ' + error.message);

  const rows = data ?? [];
  if (excludeSubjectIds.length === 0) return rows;
  const excluded = new Set(excludeSubjectIds);
  return rows.filter(c => !c.subject_id || !excluded.has(c.subject_id));
}

export async function fetchSubjectIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ subject_id: string | null }[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('subject_id')
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao contar: ' + error.message);
  return data ?? [];
}

export async function fetchReviewDates(
  supabase: SupabaseClient,
  userId: string,
  since: Date,
): Promise<{ last_reviewed: string | null }[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('last_reviewed')
    .eq('user_id', userId)
    .not('last_reviewed', 'is', null)
    .gte('last_reviewed', since.toISOString());

  if (error) return [];
  return data ?? [];
}

// ---------- Counts ----------

export async function countDueFlashcards(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  excludeSubjectIds: string[] = [],
): Promise<number> {
  const base = supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .lte('next_review_date', today);

  // NULL-safe: cards sem subject_id nunca devem ser excluídos da contagem
  // (subject_id.not.in sozinho descartaria NULL, pois NULL NOT IN (...) é NULL/false em SQL) —
  // precisa bater com o filtro em memória usado por fetchPendingCards.
  const query = excludeSubjectIds.length > 0
    ? base.or(`subject_id.is.null,subject_id.not.in.(${excludeSubjectIds.join(',')})`)
    : base;

  const { count, error } = await query;
  // H11 — não engolir erro como 0: viraria "tudo em dia" falso no Plano de Hoje.
  if (error) throw new Error('Erro ao contar flashcards: ' + error.message);
  return count ?? 0;
}

export async function countNewFlashcards(
  supabase: SupabaseClient,
  userId: string,
  excludeSubjectIds: string[] = [],
): Promise<number> {
  const base = supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .is('next_review_date', null);

  const query = excludeSubjectIds.length > 0
    ? base.or(`subject_id.is.null,subject_id.not.in.(${excludeSubjectIds.join(',')})`)
    : base;

  const { count, error } = await query;
  // Mesmo cuidado do H11 em countDueFlashcards: não engolir erro como 0.
  if (error) throw new Error('Erro ao contar novos flashcards: ' + error.message);
  return count ?? 0;
}

export async function countFlashcardsByError(
  supabase: SupabaseClient,
  userId: string,
  errorId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('source_error_id', errorId)
    .eq('user_id', userId);

  if (error) { console.error('countFlashcardsByError:', error); return 0; }
  return count ?? 0;
}

export interface FlashcardByErrorRow {
  id: string;
  front: string;
  is_review_active: boolean;
  next_review_date: string | null;
}

export async function fetchFlashcardsByError(
  supabase: SupabaseClient,
  userId: string,
  errorId: string,
): Promise<FlashcardByErrorRow[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, front, is_review_active, next_review_date')
    .eq('source_error_id', errorId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao buscar flashcards do erro: ' + error.message);
  return data ?? [];
}

// ---------- Mutations ----------

export async function insertFlashcard(
  supabase: SupabaseClient,
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('flashcards').insert({ user_id: userId, ...fields });
  if (error) throw new Error('Erro ao criar flashcard: ' + error.message);
}

export async function updateFlashcard(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('flashcards')
    .update(fields)
    .eq('id', cardId)
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao atualizar flashcard: ' + error.message);
}

export async function deleteFlashcard(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<void> {
  const { error } = await supabase
    .from('flashcards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao apagar flashcard: ' + error.message);
}
