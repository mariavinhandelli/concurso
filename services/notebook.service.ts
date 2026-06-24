// services/notebook.service.ts
import { createClient } from '@/lib/supabase/client';

export const ERROR_TYPES = [
  'Pegadinha',
  'Falta de conhecimento',
  'Erro de interpretação',
  'Desatenção',
] as const;

export interface ErrorNote {
  id: string;
  user_id: string;
  title: string | null;
  content: object;
  content_text: string | null;
  error_type: string | null;
  subject_id: string | null;
  topic_id: string | null;
  board_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  title: string;
  content: object;
  contentText: string;
  errorType: string | null;
  subjectId: string | null;
  topicId: string | null;
  boardId: string | null;
}

export async function listNotes(filters?: {
  subjectId?: string | null;
  topicId?: string | null;
  boardId?: string | null;
}): Promise<ErrorNote[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters?.topicId === null) query = query.is('topic_id', null);
  else if (filters?.topicId) query = query.eq('topic_id', filters.topicId);
  if (filters?.boardId) query = query.eq('board_id', filters.boardId);

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar notas: ' + error.message);
  return data ?? [];
}

export async function searchNotes(term: string): Promise<ErrorNote[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  if (!term.trim()) return listNotes();

  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', user.id)
    .textSearch('content_text', term, { type: 'websearch', config: 'portuguese' })
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro na busca: ' + error.message);
  return data ?? [];
}

export async function getNote(id: string): Promise<ErrorNote | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Erro ao buscar nota: ' + error.message);
  return data;
}

export async function createNote(input: NoteInput): Promise<ErrorNote> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('error_notebooks')
    .insert({
      user_id: user.id,
      title: input.title.trim() || null,
      content: input.content,
      content_text: input.contentText,
      error_type: input.errorType,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      board_id: input.boardId,
    })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar nota: ' + error.message);
  return data;
}

export async function updateNote(id: string, input: NoteInput): Promise<ErrorNote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('error_notebooks')
    .update({
      title: input.title.trim() || null,
      content: input.content,
      content_text: input.contentText,
      error_type: input.errorType,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      board_id: input.boardId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar nota: ' + error.message);
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('error_notebooks').delete().eq('id', id);
  if (error) throw new Error('Erro ao apagar nota: ' + error.message);
}

export async function listBoards(): Promise<{ id: string; name: string; color: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exam_boards')
    .select('id, name, color')
    .order('name', { ascending: true });
  if (error) throw new Error('Erro ao listar bancas: ' + error.message);
  return data ?? [];
}

// Conta quantos erros existem por matéria (para a navegação nível 1).
export async function countNotesBySubject(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('error_notebooks')
    .select('subject_id')
    .eq('user_id', user.id);

  if (error) throw new Error('Erro ao contar: ' + error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = row.subject_id ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Lista erros de uma banca específica (atravessa a hierarquia).
export async function listNotesByBoard(boardId: string): Promise<ErrorNote[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', user.id)
    .eq('board_id', boardId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro ao filtrar por banca: ' + error.message);
  return data ?? [];
}

// Lista erros criados nos últimos N dias (atravessa toda a hierarquia).
export async function listRecentNotes(days: number): Promise<ErrorNote[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const desde = new Date();
  desde.setDate(desde.getDate() - days);

  const { data, error } = await supabase
    .from('error_notebooks')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', desde.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao listar recentes: ' + error.message);
  return data ?? [];
}
// Tópico crítico: agrupa erros por tópico, conta, e cruza com a taxa de acerto.
export interface CriticalTopic {
  topicId: string;
  topicName: string;
  subjectName: string;
  errorCount: number;
  acertoPct: number | null;  // null se não há questões
  isAlert: boolean;          // muitos erros + acerto baixo
}

export async function listCriticalTopics(): Promise<CriticalTopic[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1) Todos os erros que têm tópico, com nome do tópico e da matéria.
  const { data: notes, error } = await supabase
    .from('error_notebooks')
    .select('topic_id, topics(name, subjects(name))')
    .eq('user_id', user.id)
    .not('topic_id', 'is', null);

  if (error) throw new Error('Erro ao agrupar críticos: ' + error.message);

  // 2) Conta erros por tópico (e guarda os nomes).
  const porTopico = new Map<string, { topicName: string; subjectName: string; count: number }>();
  for (const n of notes ?? []) {
    if (!n.topic_id) continue;
    const topic = Array.isArray(n.topics) ? n.topics[0] : n.topics;
    const subj = topic?.subjects ? (Array.isArray(topic.subjects) ? topic.subjects[0] : topic.subjects) : null;
    const cur = porTopico.get(n.topic_id) ?? {
      topicName: topic?.name ?? 'Tópico',
      subjectName: subj?.name ?? 'Matéria',
      count: 0,
    };
    cur.count += 1;
    porTopico.set(n.topic_id, cur);
  }

  const topicIds = Array.from(porTopico.keys());
  if (topicIds.length === 0) return [];

  // 3) Taxa de acerto de cada tópico (sessões de questões).
  const { data: logs } = await supabase
    .from('study_logs')
    .select('topic_id, questions_total, questions_correct')
    .eq('user_id', user.id)
    .eq('mode', 'questoes')
    .in('topic_id', topicIds);

  const acertoMap: Record<string, { total: number; acertos: number }> = {};
  for (const l of logs ?? []) {
    if (!l.topic_id) continue;
    const cur = acertoMap[l.topic_id] ?? { total: 0, acertos: 0 };
    cur.total += l.questions_total ?? 0;
    cur.acertos += l.questions_correct ?? 0;
    acertoMap[l.topic_id] = cur;
  }

  // 4) Monta a lista.
  const out: CriticalTopic[] = topicIds.map((id) => {
    const info = porTopico.get(id)!;
    const ac = acertoMap[id];
    const acertoPct = ac && ac.total > 0 ? Math.round((ac.acertos / ac.total) * 100) : null;
    const isAlert = info.count >= 3 && acertoPct !== null && acertoPct < 50;
    return {
      topicId: id,
      topicName: info.topicName,
      subjectName: info.subjectName,
      errorCount: info.count,
      acertoPct,
      isAlert,
    };
  });

  // 5) Ordena: mais erros primeiro; empate → menor acerto (null vai por último no empate).
  out.sort((a, b) => {
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
    const aAc = a.acertoPct ?? 101; // sem acerto = "menos crítico" no desempate
    const bAc = b.acertoPct ?? 101;
    return aAc - bAc;
  });

  return out;
}