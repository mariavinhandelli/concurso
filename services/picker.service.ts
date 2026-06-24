// services/picker.service.ts
// Funções leves para os seletores de matéria/tópico no modal de feedback.
// Reaproveita as tabelas subjects e topics, trazendo só o necessário (id + nome).

import { createClient } from '@/lib/supabase/client';

export interface PickerOption {
  id: string;
  name: string;
}

// Lista matérias (id + nome) para o seletor.
export async function listSubjectOptions(): Promise<PickerOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error('Erro ao carregar matérias: ' + error.message);
  return data ?? [];
}

// Lista tópicos (id + nome) de uma matéria específica, para o seletor.
export async function listTopicOptions(subjectId: string): Promise<PickerOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topics')
    .select('id, name')
    .eq('subject_id', subjectId)
    .order('name', { ascending: true });

  if (error) throw new Error('Erro ao carregar tópicos: ' + error.message);
  return data ?? [];
}