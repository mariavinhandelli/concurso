// services/targetExams.service.ts
// CRUD do concurso-alvo (banca estruturada + órgão + cargo + ano).
// A banca referencia exam_boards via board_id (null = a definir).
// O nome da banca é resolvido por mapa (sem join, evita ambiguidade de FK).
'use client';

import { requireUser } from '@/lib/supabase/requireUser';
import { buildTargetSlug } from '@/lib/targets';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TargetExam {
  id: string;
  user_id: string;
  board_id: string | null;
  boardName: string | null;
  orgao: string | null;
  cargo: string | null;
  ano_alvo: number | null;
  exam_date: string | null;
  slug: string;
  is_primary: boolean;
  phase: 'pre' | 'pos';
  catalog_edital_id: string | null;
  created_at: string;
}

async function getBoardName(supabase: SupabaseClient, boardId: string): Promise<string | null> {
  const { data } = await supabase
    .from('exam_boards')
    .select('name')
    .eq('id', boardId)
    .single();
  return data?.name ?? null;
}

export async function getTargetExam(id: string): Promise<TargetExam | null> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('target_exams')
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, catalog_edital_id, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Erro ao buscar concurso-alvo: ' + error.message);
  if (!data) return null;
  const boardName = data.board_id ? await getBoardName(supabase, data.board_id) : null;
  return { ...data, boardName } as TargetExam;
}

export async function listTargetExams(): Promise<TargetExam[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('target_exams')
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, catalog_edital_id, created_at')
    .eq('user_id', userId)
    .is('archived_at', null) // M11: concursos arquivados somem de countdown/cobertura/lista ativa
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error('Erro ao listar concursos-alvo: ' + error.message);

  const { data: boards } = await supabase.from('exam_boards').select('id, name').eq('user_id', userId);
  const boardMap: Record<string, string> = {};
  for (const b of boards ?? []) boardMap[b.id] = b.name;

  return (data ?? []).map((row) => ({
    ...row,
    boardName: row.board_id ? boardMap[row.board_id] ?? null : null,
  })) as TargetExam[];
}

export async function updateTargetExamDate(id: string, examDate: string | null): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('target_exams')
    .update({ exam_date: examDate })
    .eq('id', id)
    .eq('user_id', userId);
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
  const { supabase, userId } = await requireUser();
  const phase = input.phase ?? 'pre';
  const boardId = input.board_id ?? null;

  if (phase === 'pos' && !boardId) throw new Error('No pós-edital a banca é obrigatória.');

  const bancaNome = boardId ? await getBoardName(supabase, boardId) : null;
  const slug = buildTargetSlug(bancaNome, input.orgao, input.cargo, input.ano_alvo);

  const { data, error } = await supabase
    .from('target_exams')
    .insert({
      user_id: userId,
      board_id: boardId,
      orgao: input.orgao?.trim() || null,
      cargo: input.cargo?.trim() || null,
      ano_alvo: input.ano_alvo ?? null,
      exam_date: input.exam_date ?? null,
      phase,
      slug,
    })
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, catalog_edital_id, created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Você já tem um concurso-alvo igual a esse.');
    throw new Error('Erro ao criar concurso-alvo: ' + error.message);
  }

  return { ...data, boardName: bancaNome } as TargetExam;
}

export async function promoteToPos(targetExamId: string, boardId?: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const updates: { phase: 'pos'; board_id?: string; slug?: string } = { phase: 'pos' };
  if (boardId) {
    updates.board_id = boardId;
    const bancaNome = await getBoardName(supabase, boardId);
    const { data: exam } = await supabase
      .from('target_exams')
      .select('orgao, cargo, ano_alvo')
      .eq('id', targetExamId)
      .eq('user_id', userId)
      .single();
    if (exam) updates.slug = buildTargetSlug(bancaNome, exam.orgao, exam.cargo, exam.ano_alvo);
  }
  const { error } = await supabase
    .from('target_exams')
    .update(updates)
    .eq('id', targetExamId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao promover concurso: ' + error.message);
}

export async function setPrimaryTargetExam(targetExamId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('set_primary_target_exam', { p_target_id: targetExamId });
  if (error) throw new Error(error.message);
}

export async function deleteTargetExam(targetExamId: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('target_exams')
    .delete()
    .eq('id', targetExamId)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao excluir concurso-alvo: ' + error.message);
}

// ── M11: arquivamento (não-destrutivo, reversível via archived_at) ──────────

export async function listArchivedTargetExams(): Promise<TargetExam[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('target_exams')
    .select('id, user_id, board_id, orgao, cargo, ano_alvo, exam_date, slug, is_primary, phase, catalog_edital_id, created_at')
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Erro ao listar concursos arquivados: ' + error.message);

  const { data: boards } = await supabase.from('exam_boards').select('id, name').eq('user_id', userId);
  const boardMap: Record<string, string> = {};
  for (const b of boards ?? []) boardMap[b.id] = b.name;

  return (data ?? []).map((row) => ({
    ...row,
    boardName: row.board_id ? boardMap[row.board_id] ?? null : null,
  })) as TargetExam[];
}

// Arquiva o concurso (não apaga). Deixa de ser primário para sumir do countdown.
export async function archiveTargetExam(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('target_exams')
    .update({ archived_at: new Date().toISOString(), is_primary: false })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao arquivar concurso: ' + error.message);
}

export async function unarchiveTargetExam(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('target_exams')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao restaurar concurso: ' + error.message);
}
