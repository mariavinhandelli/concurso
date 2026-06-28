// services/boards.service.ts
// CRUD de bancas (exam_boards). Alimenta os selects e filtros de banca do app
// (caderno de erros, sessões de estudo, vínculo de tópicos).

import { createClient } from '@/lib/supabase/client';

export interface Board {
  id: string;
  name: string;
  color: string;
}

// Cor neutra padrão para toda banca (marcador sóbrio, alinhado ao tema).
export const DEFAULT_BOARD_COLOR = '#6BA89A'; // teal-soft do sistema

export async function listAllBoards(): Promise<Board[]> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('exam_boards')
    .select('id, name, color')
    .eq('user_id', user.id)
    .order('name', { ascending: true });
  if (error) throw new Error('Erro ao listar bancas: ' + error.message);
  return data ?? [];
}

export async function createBoard(name: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('exam_boards').insert({
    user_id: user.id,
    name: name.trim(),
    color: DEFAULT_BOARD_COLOR,
  });
  if (error) throw new Error('Erro ao criar banca: ' + error.message);
}

export async function updateBoard(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('exam_boards')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao renomear banca: ' + error.message);
}

export async function deleteBoard(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('exam_boards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar banca: ' + error.message);
}