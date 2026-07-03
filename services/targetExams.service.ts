// services/targetExams.service.ts
// CRUD do concurso-alvo (banca estruturada + órgão + cargo + ano).
// A banca referencia exam_boards via board_id (null = a definir).
// O nome da banca é resolvido por mapa (sem join, evita ambiguidade de FK).

import { createClient } from '@/lib/supabase/client';

export interface TargetExam {
  id: string;
  user_id: string;
  board_id: string | null;
  boardName: string | null;
  orgao: string | null;
  cargo: string | null;
  ano_alvo: number | null;
  exam_date: string | null; // 'YYYY-MM-DD' — alimenta a contagem regressiva no home
  slug: string;
  is_primary: boolean;
  phase: 'pre' | 'pos';
  created_at: string;
}

function buildSlug(banca: string | null, orgao?: string | null, cargo?: string | null, ano?: number | null): string {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
     .replace(/[^a-z0-9]+/g, '').slice(0, 20);
  return [banca, orgao, cargo, ano]
    .filter(Boolean)
    .map((p) => (typeof p === 'number' ? String(p) : norm(p as string)))
    .join('-') || 'concurso';
}

async function getBoardName(boardId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('exam_boards')
    .select('name')
    .eq('id', boardId)
    .single();
  return data?.name ?? null;
}

export async function listTargetExams(): Promise<TargetExam[]> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('target_exams')
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, created_at')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw new Error('Erro ao listar concursos-alvo: ' + error.message);

  // Resolve o nome da banca via mapa (sem join).
  const { data: boards } = await supabase.from('exam_boards').select('id, name');
  const boardMap: Record<string, string> = {};
  for (const b of boards ?? []) boardMap[b.id] = b.name;

  return (data ?? []).map((row) => ({
    ...row,
    boardName: row.board_id ? boardMap[row.board_id] ?? null : null,
  })) as TargetExam[];
}

export async function updateTargetExamDate(id: string, examDate: string | null): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('target_exams')
    .update({ exam_date: examDate })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao atualizar data da prova: ' + error.message);
}

export async function createTargetExam(input: {
  board_id?: string | null;
  orgao?: string | null;
  cargo?: string | null;
  ano_alvo?: number | null;
  exam_date?: string | null;
  phase?: 'pre' | 'pos';
}): Promise<TargetExam> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const phase = input.phase ?? 'pre';
  const boardId = input.board_id ?? null;

  if (phase === 'pos' && !boardId) {
    throw new Error('No pós-edital a banca é obrigatória.');
  }

  const bancaNome = boardId ? await getBoardName(boardId) : null;
  const slug = buildSlug(bancaNome, input.orgao, input.cargo, input.ano_alvo);

  const { data, error } = await supabase
    .from('target_exams')
    .insert({
      user_id: user.id,
      board_id: boardId,
      orgao: input.orgao?.trim() || null,
      cargo: input.cargo?.trim() || null,
      ano_alvo: input.ano_alvo ?? null,
      exam_date: input.exam_date ?? null,
      phase,
      slug,
    })
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Você já tem um concurso-alvo igual a esse.');
    throw new Error('Erro ao criar concurso-alvo: ' + error.message);
  }

  return { ...data, boardName: bancaNome } as TargetExam;
}

export async function promoteToPos(targetExamId: string, boardId?: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const updates: { phase: 'pos'; board_id?: string } = { phase: 'pos' };
  if (boardId) updates.board_id = boardId;

  const { error } = await supabase
    .from('target_exams')
    .update(updates)
    .eq('id', targetExamId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao promover concurso: ' + error.message);
}

export async function setPrimaryTargetExam(targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  // RPC atômica: troca o primário em um único UPDATE, sem janela de estado inconsistente.
  const { error } = await supabase.rpc('set_primary_target_exam', { p_target_id: targetExamId });
  if (error) throw new Error(error.message);
}

export async function deleteTargetExam(targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('target_exams')
    .delete()
    .eq('id', targetExamId)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao excluir concurso-alvo: ' + error.message);
}

export async function linkTopicToTarget(topicId: string, targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { data: exam } = await supabase
    .from('target_exams').select('id').eq('id', targetExamId).eq('user_id', user.id).single();
  if (!exam) throw new Error('Concurso-alvo não encontrado.');

  const { data: topic } = await supabase
    .from('topics').select('id').eq('id', topicId).eq('user_id', user.id).single();
  if (!topic) throw new Error('Tópico não encontrado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .insert({ topic_id: topicId, target_exam_id: targetExamId });
  if (error && error.code !== '23505')
    throw new Error('Erro ao vincular tópico: ' + error.message);
}

export async function unlinkTopicFromTarget(topicId: string, targetExamId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Você precisa estar logado.');

  const { data: exam } = await supabase
    .from('target_exams').select('id').eq('id', targetExamId).eq('user_id', user.id).single();
  if (!exam) throw new Error('Concurso-alvo não encontrado.');

  const { data: topic } = await supabase
    .from('topics').select('id').eq('id', topicId).eq('user_id', user.id).single();
  if (!topic) throw new Error('Tópico não encontrado.');

  const { error } = await supabase
    .from('topic_target_exams')
    .delete()
    .eq('topic_id', topicId)
    .eq('target_exam_id', targetExamId);
  if (error) throw new Error('Erro ao desvincular tópico: ' + error.message);
}