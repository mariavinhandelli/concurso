// services/targetWeights.service.ts
// Ajuste fino de peso por tópico dentro de um edital (topic_target_exams.topic_weight).
// NULL = herda o peso da disciplina definido em exam_blueprints.
// Separado do serviço de composição (targetTopics) porque são responsabilidades distintas:
// composição define *quais* tópicos estão no edital; pesos definem *quanto* cada um vale.
'use client';

import { requireUser } from '@/lib/supabase/requireUser';

export async function listTopicWeights(targetExamId: string): Promise<Record<string, number | null>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('topic_target_exams')
    .select('topic_id, topic_weight')
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao listar pesos: ' + error.message);
  const mapa: Record<string, number | null> = {};
  for (const r of data ?? []) mapa[r.topic_id] = r.topic_weight;
  return mapa;
}

export async function setTopicWeight(
  topicId: string,
  targetExamId: string,
  weight: number | null,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('topic_target_exams')
    .upsert(
      { topic_id: topicId, target_exam_id: targetExamId, topic_weight: weight },
      { onConflict: 'topic_id,target_exam_id' },
    );
  if (error) throw new Error('Erro ao definir peso do tópico: ' + error.message);
}
