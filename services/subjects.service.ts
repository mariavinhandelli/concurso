// services/subjects.service.ts
// CRUD de Matérias Base (subjects). Única camada que fala com o Supabase.

import { createClient } from '@/lib/supabase/client';

// Formato de uma matéria como vem do banco.
export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  status: 'ativo' | 'arquivado';
  created_at: string;
}

// Paleta pastel padrão — usada como sugestão ao criar uma matéria.
export const SUBJECT_COLORS = [
  '#75f9a5', // verde sálvia
  '#86d39b',
  '#0bd8b6',
  '#5f91bf', // azul névoa
  '#3892f8',
  '#ae67ff', // lavanda
  '#9c3a9f', // rosa antigo
  '#38134d',
  '#fe2273',
  '#da457c', // areia
  '#ff90b3',
  '#f85838', // amarelo suave
  '#771b09',
  '#ffad6b',
  '#f5f84e',
  '#fff9a0',
];

// Lista matérias ATIVAS do usuário logado — não inclui arquivadas.
export async function listSubjects(): Promise<Subject[]> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error('Erro ao listar matérias: ' + error.message);
  return data ?? [];
}

// Cria uma nova matéria. O user_id é resolvido a partir da sessão.
export async function createSubject(name: string, color: string): Promise<Subject> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: user.id, name: name.trim(), color })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar matéria: ' + error.message);
  return data;
}

// Atualiza nome e/ou cor de uma matéria existente.
export async function updateSubject(
  id: string,
  updates: { name?: string; color?: string },
): Promise<Subject> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const payload: { name?: string; color?: string } = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.color !== undefined) payload.color = updates.color;

  const { data, error } = await supabase
    .from('subjects')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar matéria: ' + error.message);
  return data;
}

// Apaga uma matéria. (Os tópicos dela são apagados em cascata pelo banco.)
export async function deleteSubject(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar matéria: ' + error.message);
}