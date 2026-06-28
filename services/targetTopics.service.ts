// services/targetTopics.service.ts
// Vínculo entre tópicos da biblioteca e um edital (topic_target_exams).
// O mesmo tópico pode estar em vários editais; aqui controlamos quais e o
// ajuste fino de peso por tópico (topic_weight; NULL = herda o da disciplina).

import { createClient } from '@/lib/supabase/client';

export interface TargetTopicLink {
  topic_id: string;
  target_exam_id: string;
  topic_weight: number | null;
}

// IDs dos tópicos já vinculados a um edital (pra marcar os checkboxes).
// A RLS em topic_target_exams garante isolamento via topics.user_id.
export async function listLinkedTopicIds(targetExamId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('topic_id')
    .eq('target_exam_id', targetExamId);

  if (error) throw new Error('Erro ao listar vínculos: ' + error.message);
  return new Set((data ?? []).map((r) => r.topic_id));
}

// Mapa topic_id -> topic_weight (só dos que têm ajuste fino definido).
export async function listTopicWeights(targetExamId: string): Promise<Record<string, number | null>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('topic_id, topic_weight')
    .eq('target_exam_id', targetExamId);

  if (error) throw new Error('Erro ao listar pesos: ' + error.message);
  const mapa: Record<string, number | null> = {};
  for (const r of data ?? []) mapa[r.topic_id] = r.topic_weight;
  return mapa;
}

// Vincula um tópico ao edital (idempotente — ignora se já existe).
export async function linkTopic(topicId: string, targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .insert({ topic_id: topicId, target_exam_id: targetExamId });
  if (error && error.code !== '23505')
    throw new Error('Erro ao vincular: ' + error.message);
}

// Desvincula um tópico do edital.
export async function unlinkTopic(topicId: string, targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .delete()
    .eq('topic_id', topicId)
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao desvincular: ' + error.message);
}

// Vincula VÁRIOS tópicos de uma vez ("marcar tudo" de uma matéria).
export async function linkTopicsBulk(topicIds: string[], targetExamId: string): Promise<void> {
  if (topicIds.length === 0) return;
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const linhas = topicIds.map((id) => ({ topic_id: id, target_exam_id: targetExamId }));
  const { error } = await supabase
    .from('topic_target_exams')
    .upsert(linhas, { onConflict: 'topic_id,target_exam_id', ignoreDuplicates: true });
  if (error) throw new Error('Erro ao vincular em lote: ' + error.message);
}

// Desvincula VÁRIOS de uma vez ("desmarcar tudo" de uma matéria).
export async function unlinkTopicsBulk(topicIds: string[], targetExamId: string): Promise<void> {
  if (topicIds.length === 0) return;
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .delete()
    .eq('target_exam_id', targetExamId)
    .in('topic_id', topicIds);
  if (error) throw new Error('Erro ao desvincular em lote: ' + error.message);
}

// Define (ou limpa) o ajuste fino de peso de um tópico no edital.
export async function setTopicWeight(
  topicId: string, targetExamId: string, weight: number | null,
): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .update({ topic_weight: weight })
    .eq('topic_id', topicId)
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao definir peso do tópico: ' + error.message);
}