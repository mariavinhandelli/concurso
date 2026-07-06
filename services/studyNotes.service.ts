// services/studyNotes.service.ts
// Caderno de Anotações: notas livres (resumos, dicas, esquemas) por matéria/
// tópico. A lista carrega metadados + texto plano (preview/busca client-side);
// o conteúdo Tiptap (jsonb) só é buscado ao abrir a nota no editor.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';

export type NotaKind = 'resumo' | 'dica' | 'esquema' | 'outro';

export const NOTA_KINDS: { value: NotaKind; label: string }[] = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'dica', label: 'Dica' },
  { value: 'esquema', label: 'Esquema' },
  { value: 'outro', label: 'Outro' },
];

// Metadados para a lista (sem o content jsonb — pesado e desnecessário ali).
export interface StudyNoteMeta {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  content_text: string | null;
  kind: NotaKind;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  topicName: string | null;
}

export interface StudyNote extends StudyNoteMeta {
  content: object | null;
}

interface TopicRel { name: string | null }

function topicNameOf(rel: TopicRel | TopicRel[] | null): string | null {
  const t = Array.isArray(rel) ? rel[0] : rel;
  return t?.name ?? null;
}

export async function listStudyNotes(): Promise<StudyNoteMeta[]> {
  const auth = await tryGetUser();
  if (!auth) return [];

  const { data, error } = await auth.supabase
    .from('study_notes')
    .select('id, subject_id, topic_id, title, content_text, kind, is_pinned, created_at, updated_at, topics(name)')
    .eq('user_id', auth.userId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro ao listar anotações: ' + error.message);

  return (data ?? []).map((n) => ({
    id: n.id,
    subject_id: n.subject_id,
    topic_id: n.topic_id,
    title: n.title,
    content_text: n.content_text,
    kind: n.kind as NotaKind,
    is_pinned: n.is_pinned,
    created_at: n.created_at,
    updated_at: n.updated_at,
    topicName: topicNameOf(n.topics as TopicRel | TopicRel[] | null),
  }));
}

export async function getStudyNote(id: string): Promise<StudyNote | null> {
  const { supabase, userId } = await requireUser();

  const { data, error } = await supabase
    .from('study_notes')
    .select('*, topics(name)')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('Erro ao abrir anotação: ' + error.message);
  if (!data) return null;
  return { ...data, kind: data.kind as NotaKind, topicName: topicNameOf(data.topics) } as StudyNote;
}

export async function createStudyNote(input: {
  subjectId?: string | null;
  topicId?: string | null;
  kind?: NotaKind;
}): Promise<StudyNote> {
  const { supabase, userId } = await requireUser();

  const { data, error } = await supabase
    .from('study_notes')
    .insert({
      user_id: userId,
      subject_id: input.subjectId ?? null,
      topic_id: input.topicId ?? null,
      kind: input.kind ?? 'resumo',
      title: '',
    })
    .select('*, topics(name)')
    .single();

  if (error) throw new Error('Erro ao criar anotação: ' + error.message);
  return { ...data, kind: data.kind as NotaKind, topicName: topicNameOf(data.topics) } as StudyNote;
}

export interface StudyNotePatch {
  title?: string;
  content?: object;
  contentText?: string;
  kind?: NotaKind;
  subjectId?: string | null;
  topicId?: string | null;
  isPinned?: boolean;
}

export async function updateStudyNote(id: string, patch: StudyNotePatch): Promise<void> {
  const { supabase, userId } = await requireUser();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.content !== undefined) payload.content = patch.content;
  if (patch.contentText !== undefined) payload.content_text = patch.contentText;
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.subjectId !== undefined) payload.subject_id = patch.subjectId;
  if (patch.topicId !== undefined) payload.topic_id = patch.topicId;
  if (patch.isPinned !== undefined) payload.is_pinned = patch.isPinned;

  const { error } = await supabase
    .from('study_notes')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao salvar anotação: ' + error.message);
}

export async function deleteStudyNote(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from('study_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Erro ao excluir anotação: ' + error.message);
}

// Contagem de notas por tópico, em lote — mesmo padrão de getSaudeMap
// (uma query para todos os tópicos da matéria, sem N+1).
export async function countNotesByTopics(topicIds: string[]): Promise<Record<string, number>> {
  if (topicIds.length === 0) return {};
  const auth = await tryGetUser();
  if (!auth) return {};

  const { data, error } = await auth.supabase
    .from('study_notes')
    .select('topic_id')
    .eq('user_id', auth.userId)
    .in('topic_id', topicIds);

  if (error) throw new Error('Erro ao contar anotações: ' + error.message);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.topic_id) continue;
    counts[row.topic_id] = (counts[row.topic_id] ?? 0) + 1;
  }
  return counts;
}

export async function listNotesByTopic(topicId: string): Promise<StudyNoteMeta[]> {
  const auth = await tryGetUser();
  if (!auth) return [];

  const { data, error } = await auth.supabase
    .from('study_notes')
    .select('id, subject_id, topic_id, title, content_text, kind, is_pinned, created_at, updated_at, topics(name)')
    .eq('user_id', auth.userId)
    .eq('topic_id', topicId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro ao listar anotações do tópico: ' + error.message);

  return (data ?? []).map((n) => ({
    id: n.id,
    subject_id: n.subject_id,
    topic_id: n.topic_id,
    title: n.title,
    content_text: n.content_text,
    kind: n.kind as NotaKind,
    is_pinned: n.is_pinned,
    created_at: n.created_at,
    updated_at: n.updated_at,
    topicName: topicNameOf(n.topics as TopicRel | TopicRel[] | null),
  }));
}

// Nota editada mais recentemente — atalho "continuar de onde parou" na Home.
export async function getLastEditedNote(): Promise<StudyNoteMeta | null> {
  const auth = await tryGetUser();
  if (!auth) return null;

  const { data, error } = await auth.supabase
    .from('study_notes')
    .select('id, subject_id, topic_id, title, content_text, kind, is_pinned, created_at, updated_at, topics(name)')
    .eq('user_id', auth.userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Erro ao buscar última anotação: ' + error.message);
  if (!data) return null;

  return {
    id: data.id,
    subject_id: data.subject_id,
    topic_id: data.topic_id,
    title: data.title,
    content_text: data.content_text,
    kind: data.kind as NotaKind,
    is_pinned: data.is_pinned,
    created_at: data.created_at,
    updated_at: data.updated_at,
    topicName: topicNameOf(data.topics as TopicRel | TopicRel[] | null),
  };
}
