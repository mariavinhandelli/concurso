// services/picker.service.ts
// Funções leves para os seletores de matéria/tópico no modal de feedback.
// Reaproveita as tabelas subjects e topics, trazendo só o necessário (id + nome).

import { createClient } from '@/lib/supabase/client';

export interface PickerOption {
  id: string;
  name: string;
}

// Lista matérias ATIVAS (não arquivadas) do usuário logado para o seletor.
export async function listSubjectOptions(): Promise<PickerOption[]> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .order('name', { ascending: true })
    .limit(200);

  if (error) throw new Error('Erro ao carregar matérias: ' + error.message);
  return data ?? [];
}

// Lista tópicos FOLHA (estudáveis) de uma matéria — exclui pastas-pai.
// Um tópico é pasta se outro tópico referencia seu id em parent_id.
export async function listTopicOptions(subjectId: string): Promise<PickerOption[]> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('topics')
    .select('id, name, parent_id')
    .eq('subject_id', subjectId)
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .limit(500);

  if (error) throw new Error('Erro ao carregar tópicos: ' + error.message);

  // Remove os tópicos que são pastas (têm ao menos um filho referenciando seu id).
  const allTopics = data ?? [];
  const parentIds = new Set(allTopics.filter((t) => t.parent_id !== null).map((t) => t.parent_id!));
  return allTopics
    .filter((t) => !parentIds.has(t.id))
    .map(({ id, name }) => ({ id, name }));
}