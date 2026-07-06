// services/notebook.repository.ts
// Acesso a dados do caderno de erros. Sem lógica de negócio nem auth.
// Recebe supabase + userId já resolvidos pelo serviço chamador.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ErrorNote {
  id: string;
  user_id: string;
  title: string | null;
  content: object;
  content_text: string | null;
  error_type: string | null;
  subject_id: string | null;
  topic_id: string | null;
  board_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  title: string;
  content: object;
  contentText: string;
  errorType: string | null;
  subjectId: string | null;
  topicId: string | null;
  boardId: string | null;
}

export interface CriticalTopic {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  errorCount: number;
  acertoPct: number | null;
  isAlert: boolean;
}

export async function queryNotes(
  supabase: SupabaseClient,
  userId: string,
  filters?: { subjectId?: string | null; topicId?: string | null; boardId?: string | null },
): Promise<ErrorNote[]> {
  let query = supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters?.topicId === null) query = query.is('topic_id', null);
  else if (filters?.topicId) query = query.eq('topic_id', filters.topicId);
  if (filters?.boardId) query = query.eq('board_id', filters.boardId);

  const { data, error } = await query.limit(500);
  if (error) throw new Error('Erro ao listar notas: ' + error.message);
  return data ?? [];
}

export async function querySearchNotes(
  supabase: SupabaseClient,
  userId: string,
  term: string,
): Promise<ErrorNote[]> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', userId)
    .textSearch('content_text', term, { type: 'websearch', config: 'portuguese' })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) throw new Error('Erro na busca: ' + error.message);
  return data ?? [];
}

export async function queryNote(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<ErrorNote | null> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Erro ao buscar nota: ' + error.message);
  return data;
}

export async function insertNote(
  supabase: SupabaseClient,
  userId: string,
  input: NoteInput,
): Promise<ErrorNote> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .insert({
      user_id: userId,
      title: input.title.trim() || null,
      content: input.content,
      content_text: [input.title.trim(), input.contentText].filter(Boolean).join(' '),
      error_type: input.errorType,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      board_id: input.boardId,
    })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar nota: ' + error.message);
  return data;
}

export async function patchNote(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: NoteInput,
): Promise<ErrorNote> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .update({
      title: input.title.trim() || null,
      content: input.content,
      content_text: [input.title.trim(), input.contentText].filter(Boolean).join(' '),
      error_type: input.errorType,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      board_id: input.boardId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar nota: ' + error.message);
  return data;
}

export async function removeNote(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('error_notebooks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao apagar nota: ' + error.message);
}

export async function queryBoards(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string; color: string }[]> {
  const { data, error } = await supabase
    .from('exam_boards')
    .select('id, name, color')
    .order('name', { ascending: true });
  if (error) throw new Error('Erro ao listar bancas: ' + error.message);
  return data ?? [];
}

export async function queryNoteSubjectIds(
  supabase: SupabaseClient,
  userId: string,
  archivedIds: string[],
): Promise<{ subject_id: string | null }[]> {
  let query = supabase
    .from('error_notebooks')
    .select('subject_id')
    .eq('user_id', userId);
  if (archivedIds.length > 0) query = query.not('subject_id', 'in', `(${archivedIds.join(',')})`);
  const { data, error } = await query;
  if (error) throw new Error('Erro ao contar: ' + error.message);
  return data ?? [];
}

export async function queryNotesByBoard(
  supabase: SupabaseClient,
  userId: string,
  boardId: string,
): Promise<ErrorNote[]> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', userId)
    .eq('board_id', boardId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('Erro ao filtrar por banca: ' + error.message);
  return data ?? [];
}

export async function queryRecentNotes(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
  archivedIds: string[],
): Promise<ErrorNote[]> {
  let query = supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (archivedIds.length > 0) query = query.not('subject_id', 'in', `(${archivedIds.join(',')})`);
  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar recentes: ' + error.message);
  return data ?? [];
}

export async function queryCriticalNotes(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ topic_id: string | null; topics: unknown }[]> {
  const { data, error } = await supabase
    .from('error_notebooks')
    .select('topic_id, topics(name, subject_id, subjects(name))')
    .eq('user_id', userId)
    .not('topic_id', 'is', null);

  if (error) throw new Error('Erro ao agrupar críticos: ' + error.message);
  return (data ?? []) as { topic_id: string | null; topics: unknown }[];
}

export async function queryTopicStudyLogs(
  supabase: SupabaseClient,
  userId: string,
  topicIds: string[],
): Promise<{ topic_id: string | null; questions_total: number | null; questions_correct: number | null }[]> {
  const { data } = await supabase
    .from('study_logs')
    .select('topic_id, questions_total, questions_correct')
    .eq('user_id', userId)
    .eq('mode', 'questoes')
    .in('topic_id', topicIds);
  return data ?? [];
}
