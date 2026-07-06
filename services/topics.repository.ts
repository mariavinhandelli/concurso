// services/topics.repository.ts
// Acesso a dados de tópicos. Sem lógica de negócio.
// Recebe supabase + userId já resolvidos pelo serviço (auth é responsabilidade do chamador).

import type { SupabaseClient } from '@supabase/supabase-js';

export type Confidence = 'baixa' | 'media' | 'alta' | 'dominado';

export interface Topic {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  notes: string | null;
  confidence: Confidence;
  is_completed: boolean;
  is_review_active: boolean;
  last_reviewed: string | null;
  next_review_date: string | null;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  position: number;
  created_at: string;
}

export async function fetchTopics(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string,
): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error('Erro ao listar tópicos: ' + error.message);
  return data ?? [];
}

// Busca TODOS os tópicos do usuário em uma única query.
// Usar no módulo targets para eliminar N queries paralelas (1 por matéria).
export async function fetchAllTopics(
  supabase: SupabaseClient,
  userId: string,
): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', userId)
    .order('subject_id', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw new Error('Erro ao listar tópicos: ' + error.message);
  return data ?? [];
}

export async function insertTopic(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string,
  name: string,
  parentId: string | null,
): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: userId, subject_id: subjectId, name: name.trim(), parent_id: parentId })
    .select()
    .single();
  if (error) throw new Error('Erro ao criar tópico: ' + error.message);
  return data;
}

export async function setTopicCompleted(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  value: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('topics')
    .update({ is_completed: value })
    .eq('id', topicId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error('Erro ao atualizar tópico: ' + error.message);
  if (!data?.length) throw new Error('Tópico não encontrado.');
}

export async function patchTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  updates: { name?: string; notes?: string; confidence?: Confidence },
): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .update(updates)
    .eq('id', topicId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error('Erro ao atualizar tópico: ' + error.message);
  return data;
}

export async function removeTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
): Promise<void> {
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', topicId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao apagar tópico: ' + error.message);
}

export async function fetchMaxTopicPosition(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<number> {
  const { data } = await supabase
    .from('topics')
    .select('position')
    .eq('subject_id', subjectId)
    .order('position', { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

export async function insertTopicsBulk(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string,
  names: string[],
  parentId: string | null,
  startPos: number,
): Promise<number> {
  const rows = names.map((name, i) => ({
    user_id: userId,
    subject_id: subjectId,
    name,
    parent_id: parentId,
    position: startPos + i,
  }));
  const { data, error } = await supabase.from('topics').insert(rows).select('id');
  if (error) throw new Error('Erro ao importar tópicos: ' + error.message);
  return data?.length ?? 0;
}
