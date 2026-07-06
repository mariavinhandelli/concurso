// services/targetTopics.service.ts
// Composição do edital: vínculo entre tópicos da biblioteca e um concurso-alvo.
// O mesmo tópico pode estar em vários editais.
// Pesos finos por tópico estão em targetWeights.service.ts.
'use client';

import { requireUser } from '@/lib/supabase/requireUser';

export async function listLinkedTopicIds(targetExamId: string): Promise<Set<string>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('topic_id')
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao listar vínculos: ' + error.message);
  return new Set((data ?? []).map((r) => r.topic_id));
}

// Em quais editais os tópicos aparecem — alimenta os chips "presente nos
// editais" na página da matéria (integração Targets → Subjects).
export interface EditalPresence {
  targetId: string;
  label: string;
  count: number;
}

export async function listEditalPresence(topicIds: string[]): Promise<EditalPresence[]> {
  if (topicIds.length === 0) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('target_exam_id, target_exams(orgao, cargo, ano_alvo)')
    .in('topic_id', topicIds);
  if (error) throw new Error('Erro ao buscar editais do tópico: ' + error.message);

  const byTarget = new Map<string, EditalPresence>();
  for (const row of data ?? []) {
    const existing = byTarget.get(row.target_exam_id);
    if (existing) { existing.count += 1; continue; }
    const t = Array.isArray(row.target_exams) ? row.target_exams[0] : row.target_exams;
    const label = [t?.orgao, t?.cargo, t?.ano_alvo].filter(Boolean).join(' · ') || 'Concurso';
    byTarget.set(row.target_exam_id, { targetId: row.target_exam_id, label, count: 1 });
  }
  return [...byTarget.values()].sort((a, b) => b.count - a.count);
}

// Contagem de tópicos vinculados por alvo — alimenta a listagem de concursos.
export async function countLinkedByTarget(targetIds: string[]): Promise<Record<string, number>> {
  if (targetIds.length === 0) return {};
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('target_exam_id')
    .in('target_exam_id', targetIds);
  if (error) throw new Error('Erro ao contar tópicos: ' + error.message);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.target_exam_id] = (counts[r.target_exam_id] ?? 0) + 1;
  return counts;
}

export async function linkTopic(topicId: string, targetExamId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('topic_target_exams')
    .insert({ topic_id: topicId, target_exam_id: targetExamId });
  if (error && error.code !== '23505')
    throw new Error('Erro ao vincular: ' + error.message);
}

export async function unlinkTopic(topicId: string, targetExamId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('topic_target_exams')
    .delete()
    .eq('topic_id', topicId)
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao desvincular: ' + error.message);
}

export async function linkTopicsBulk(topicIds: string[], targetExamId: string): Promise<void> {
  if (topicIds.length === 0) return;
  const { supabase } = await requireUser();
  const linhas = topicIds.map((id) => ({ topic_id: id, target_exam_id: targetExamId }));
  const { error } = await supabase
    .from('topic_target_exams')
    .upsert(linhas, { onConflict: 'topic_id,target_exam_id', ignoreDuplicates: true });
  if (error) throw new Error('Erro ao vincular em lote: ' + error.message);
}

export async function unlinkTopicsBulk(topicIds: string[], targetExamId: string): Promise<void> {
  if (topicIds.length === 0) return;
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('topic_target_exams')
    .delete()
    .eq('target_exam_id', targetExamId)
    .in('topic_id', topicIds);
  if (error) throw new Error('Erro ao desvincular em lote: ' + error.message);
}
