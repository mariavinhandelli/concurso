// services/examTargets.service.ts
// CRUD dos alvos de prova (múltiplos concursos com data e cor).

import { createClient } from '@/lib/supabase/client';

export interface ExamTarget {
  id: string;
  user_id: string;
  name: string;
  exam_date: string;   // 'YYYY-MM-DD'
  color: string;
  created_at: string;
}

// Paleta pastel para diferenciar os concursos.
export const EXAM_COLORS = [
  '#d7b5ff', '#c6ffb6', '#ffbe93', '#a1d1ff', '#ff9ec5', '#f6ff91',
];

// Lista os alvos do usuário, ordenados pela data mais próxima primeiro.
export async function listExamTargets(): Promise<ExamTarget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exam_targets')
    .select('*')
    .order('exam_date', { ascending: true });

  if (error) throw new Error('Erro ao listar provas: ' + error.message);
  return data ?? [];
}

export async function createExamTarget(
  name: string, examDate: string, color: string,
): Promise<ExamTarget> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('exam_targets')
    .insert({ user_id: user.id, name: name.trim(), exam_date: examDate, color })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar prova: ' + error.message);
  return data;
}

export async function updateExamTarget(
  id: string,
  updates: { name?: string; exam_date?: string; color?: string },
): Promise<ExamTarget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exam_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar prova: ' + error.message);
  return data;
}

export async function deleteExamTarget(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('exam_targets').delete().eq('id', id);
  if (error) throw new Error('Erro ao apagar prova: ' + error.message);
}

// Calcula dias restantes até a data (negativo = já passou).
export function daysUntil(examDate: string): number {
  const target = new Date(examDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}