// services/blueprints.service.ts
// Pesos das disciplinas (exam_blueprints) para um concurso-alvo.
// Cada linha diz: "neste alvo, a matéria X pesa W e cai ~N questões".

import { createClient } from '@/lib/supabase/client';

export interface Blueprint {
  id: string;
  user_id: string;
  target_exam_id: string;
  subject_id: string;
  weight: number;
  num_questions_expected: number | null;
}

// Lista os pesos já definidos para um alvo (mapa subject_id -> blueprint).
export async function listBlueprints(targetExamId: string): Promise<Blueprint[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exam_blueprints')
    .select('*')
    .eq('target_exam_id', targetExamId);

  if (error) throw new Error('Erro ao listar pesos: ' + error.message);
  return data ?? [];
}

// Cria ou atualiza o peso de uma disciplina num alvo (upsert pela única chave
// target_exam_id + subject_id que definimos no SQL).
export async function upsertBlueprint(input: {
  targetExamId: string;
  subjectId: string;
  weight: number;
  numQuestionsExpected?: number | null;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('exam_blueprints')
    .upsert({
      user_id: user.id,
      target_exam_id: input.targetExamId,
      subject_id: input.subjectId,
      weight: input.weight,
      num_questions_expected: input.numQuestionsExpected ?? null,
    }, { onConflict: 'target_exam_id,subject_id' });

  if (error) throw new Error('Erro ao salvar peso: ' + error.message);
}

// Remove o peso de uma disciplina num alvo (volta ao default implícito).
export async function deleteBlueprint(targetExamId: string, subjectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('exam_blueprints')
    .delete()
    .eq('target_exam_id', targetExamId)
    .eq('subject_id', subjectId);

  if (error) throw new Error('Erro ao remover peso: ' + error.message);
}