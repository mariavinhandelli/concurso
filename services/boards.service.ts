// services/boards.service.ts
// CRUD de bancas (exam_boards). Alimenta os selects e filtros de banca do app
// (caderno de erros, sessões de estudo, vínculo de tópicos).
'use client';

import { requireUser } from '@/lib/supabase/requireUser';

export interface Board {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_BOARD_COLOR = '#6BA89A';

export async function listAllBoards(): Promise<Board[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('exam_boards')
    .select('id, name, color')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw new Error('Erro ao listar bancas: ' + error.message);
  return data ?? [];
}

export async function createBoard(name: string): Promise<Board> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from('exam_boards').insert({
    user_id: userId,
    name: name.trim(),
    color: DEFAULT_BOARD_COLOR,
  }).select('id, name, color').single();
  if (error) throw new Error('Erro ao criar banca: ' + error.message);
  return data as Board;
}

export async function updateBoard(id: string, name: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('exam_boards')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao renomear banca: ' + error.message);
}

export async function deleteBoard(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('exam_boards')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao apagar banca: ' + error.message);
}
