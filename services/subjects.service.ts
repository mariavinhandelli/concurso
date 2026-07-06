// services/subjects.service.ts
// CRUD de Matérias Base (subjects).
'use client';

import { requireUser } from '@/lib/supabase/requireUser';

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

export type PickerOption = { id: string; name: string };

export { SUBJECT_COLORS } from '@/lib/subject-colors';

export async function listSubjects(): Promise<Subject[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error('Erro ao listar matérias: ' + error.message);
  return data ?? [];
}

export async function createSubject(name: string, color: string): Promise<Subject> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name: name.trim(), color })
    .select()
    .single();
  if (error) throw new Error('Erro ao criar matéria: ' + error.message);
  return data;
}

export async function updateSubject(
  id: string,
  updates: { name?: string; color?: string },
): Promise<Subject> {
  const { supabase, userId } = await requireUser();
  const payload: { name?: string; color?: string } = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.color !== undefined) payload.color = updates.color;
  const { data, error } = await supabase
    .from('subjects')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error('Erro ao atualizar matéria: ' + error.message);
  return data;
}

export async function getSubject(id: string): Promise<Subject | null> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function listActive(): Promise<{ id: string; name: string }[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .order('name', { ascending: true })
    .limit(200);
  if (error) throw new Error('Erro ao carregar matérias: ' + error.message);
  return data ?? [];
}

export async function deleteSubject(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao apagar matéria: ' + error.message);
}
