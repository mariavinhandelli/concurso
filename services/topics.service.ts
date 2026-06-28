// services/topics.service.ts
// CRUD de Tópicos (assuntos de uma matéria) + toggle de "já estudei" + bancas.
// Agora com hierarquia pai/filho via parent_id (pai = pasta; filho = folha estudável).

import { createClient } from '@/lib/supabase/client';

export type Confidence = 'baixa' | 'media' | 'alta' | 'dominado';

export interface Topic {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id: string | null;   // null = pai/pasta OU tópico simples; preenchido = filho
  name: string;
  notes: string | null;
  confidence: Confidence;
  is_completed: boolean;
  // campos de revisão espaçada (usados em outro bloco)
  is_review_active: boolean;
  last_reviewed: string | null;
  next_review_date: string | null;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  position: number;
  created_at: string;
}

// Lista os tópicos de UMA matéria, em ordem.
export async function listTopics(subjectId: string): Promise<Topic[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw new Error('Erro ao listar tópicos: ' + error.message);
  return data ?? [];
}

// Cria um tópico dentro de uma matéria. parentId opcional:
//   null/undefined → tópico solto (pai ou simples)
//   preenchido      → filho daquele pai
export async function createTopic(
  subjectId: string,
  name: string,
  parentId: string | null = null,
): Promise<Topic> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: user.id, subject_id: subjectId, name: name.trim(), parent_id: parentId })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar tópico: ' + error.message);
  return data;
}

// Liga/desliga o "já estudei" — é o que o checkbox chama.
export async function toggleCompleted(id: string, value: boolean): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topics')
    .update({ is_completed: value })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error('Erro ao atualizar tópico: ' + error.message);
}

// Atualiza nome, notas ou nível de domínio.
export async function updateTopic(
  id: string,
  updates: { name?: string; notes?: string; confidence?: Confidence },
): Promise<Topic> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('topics')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar tópico: ' + error.message);
  return data;
}

// Apaga um tópico. (Se for um pai, os filhos caem em cascata pelo banco — FK on delete cascade.)
export async function deleteTopic(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar tópico: ' + error.message);
}

// ----- Vínculo com Bancas (para o filtro "só FCC" mais à frente) -----

// Lista os ids das bancas vinculadas a um tópico.
export async function getTopicBoards(topicId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('topic_boards')
    .select('board_id')
    .eq('topic_id', topicId);

  if (error) throw new Error('Erro ao buscar bancas do tópico: ' + error.message);
  return (data ?? []).map((row) => row.board_id);
}

// Vincula um tópico a uma banca.
export async function linkTopicToBoard(topicId: string, boardId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('topic_boards')
    .insert({ topic_id: topicId, board_id: boardId });

  if (error) throw new Error('Erro ao vincular banca: ' + error.message);
}

// Desvincula um tópico de uma banca.
export async function unlinkTopicFromBoard(topicId: string, boardId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('topic_boards')
    .delete()
    .eq('topic_id', topicId)
    .eq('board_id', boardId);

  if (error) throw new Error('Erro ao desvincular banca: ' + error.message);
}

// Cria vários tópicos de uma vez, a partir de um texto colado (um por linha).
// Limpa numeração ("1.", "1.1", "a)", "-", "•"), ignora linhas vazias e
// duplicatas, e respeita a ordem da colagem via position.
// parentId opcional: cria todos como filhos de um pai, ou soltos.
export async function createTopicsBulk(
  subjectId: string,
  nomes: string[],
  parentId: string | null = null,
): Promise<number> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  if (nomes.length === 0) return 0;

  // Descobre a maior position atual pra continuar a ordem (não sobrescrever).
  const { data: existentes } = await supabase
    .from('topics')
    .select('position')
    .eq('subject_id', subjectId)
    .order('position', { ascending: false })
    .limit(1);
  const startPos = (existentes?.[0]?.position ?? -1) + 1;

  const linhas = nomes.map((nome, i) => ({
    user_id: user.id,
    subject_id: subjectId,
    name: nome,
    parent_id: parentId,
    position: startPos + i,
  }));

  const { data, error } = await supabase.from('topics').insert(linhas).select('id');
  if (error) throw new Error('Erro ao importar tópicos: ' + error.message);
  return data?.length ?? 0;
}