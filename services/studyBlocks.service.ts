// services/studyBlocks.service.ts
// Blocos de estudo planejados (cronograma). CRUD + busca semanal + auto-cumprir
// por tópico (chamado pelo timer ao encerrar) + check manual + editar.

import { createClient } from '@/lib/supabase/client';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface StudyBlock {
  id: string;
  user_id: string;
  block_date: string;
  subject_id: string;
  topic_id: string | null;
  planned_minutes: number;
  is_done: boolean;
  done_at: string | null;
  position: number;
  subjectName?: string;
  subjectColor?: string;
  topicName?: string | null;
}

export async function listBlocks(startDate: string, endDate: string): Promise<StudyBlock[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const { data, error } = await supabase
    .from('study_blocks')
    .select('*, subjects(name, color), topics(name)')
    .eq('user_id', user.id)
    .gte('block_date', startDate)
    .lte('block_date', endDate)
    .order('block_date', { ascending: true })
    .order('position', { ascending: true });

  if (error) throw new Error('Erro ao listar blocos: ' + error.message);

  return (data ?? []).map((b) => {
    const subj = Array.isArray(b.subjects) ? b.subjects[0] : b.subjects;
    const top = Array.isArray(b.topics) ? b.topics[0] : b.topics;
    return {
      id: b.id, user_id: b.user_id, block_date: b.block_date,
      subject_id: b.subject_id, topic_id: b.topic_id,
      planned_minutes: b.planned_minutes, is_done: b.is_done,
      done_at: b.done_at, position: b.position,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#C9B8DD',
      topicName: top?.name ?? null,
    };
  });
}

export async function createBlock(input: {
  blockDate: string;
  subjectId: string;
  topicId?: string | null;
  plannedMinutes?: number;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { data: existentes } = await supabase
    .from('study_blocks')
    .select('position')
    .eq('user_id', user.id)
    .eq('block_date', input.blockDate)
    .order('position', { ascending: false })
    .limit(1);
  const nextPos = (existentes?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from('study_blocks').insert({
    user_id: user.id,
    block_date: input.blockDate,
    subject_id: input.subjectId,
    topic_id: input.topicId ?? null,
    planned_minutes: input.plannedMinutes ?? 60,
    position: nextPos,
  });
  if (error) throw new Error('Erro ao criar bloco: ' + error.message);
}

export async function toggleBlockDone(blockId: string, done: boolean): Promise<void> {
  const supabase = createClient();
  const updates = done
    ? { is_done: true, done_at: new Date().toISOString() }
    : { is_done: false, done_at: null, completed_by_session_id: null };
  const { error } = await supabase
    .from('study_blocks')
    .update(updates)
    .eq('id', blockId);
  if (error) throw new Error('Erro ao atualizar bloco: ' + error.message);
}

export async function deleteBlock(blockId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('study_blocks').delete().eq('id', blockId);
  if (error) throw new Error('Erro ao excluir bloco: ' + error.message);
}

// Edita um bloco manual: minutos e/ou tópico.
export async function updateBlock(
  blockId: string,
  updates: { plannedMinutes?: number; topicId?: string | null },
): Promise<void> {
  const supabase = createClient();
  const payload: { planned_minutes?: number; topic_id?: string | null } = {};
  if (updates.plannedMinutes !== undefined) payload.planned_minutes = updates.plannedMinutes;
  if (updates.topicId !== undefined) payload.topic_id = updates.topicId;

  const { error } = await supabase.from('study_blocks').update(payload).eq('id', blockId);
  if (error) throw new Error('Erro ao editar bloco: ' + error.message);
}

// AUTO-CUMPRIR por tópico exato: chamado pelo timer ao encerrar uma sessão.
export async function autoCompleteByTopic(
  topicId: string | null,
  clientSessionId: string,
): Promise<void> {
  if (!topicId) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const hoje = localDateStr(new Date());

  // Um reenvio da mesma sessão não pode concluir o próximo bloco da fila.
  const { data: jaConcluido } = await supabase
    .from('study_blocks')
    .select('id')
    .eq('user_id', user.id)
    .eq('completed_by_session_id', clientSessionId)
    .limit(1);

  if (jaConcluido && jaConcluido.length > 0) return;

  const { data: blocos } = await supabase
    .from('study_blocks')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_date', hoje)
    .eq('topic_id', topicId)
    .eq('is_done', false)
    .order('position', { ascending: true })
    .limit(1);

  if (!blocos || blocos.length === 0) return;

  const { error } = await supabase
    .from('study_blocks')
    .update({
      is_done: true,
      done_at: new Date().toISOString(),
      completed_by_session_id: clientSessionId,
    })
    .eq('id', blocos[0].id);
  if (error) throw new Error('Erro ao concluir bloco automaticamente: ' + error.message);
}
