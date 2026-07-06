// services/notebook.service.ts
// Camada de aplicação: resolve auth, delega SQL ao repositório, aplica regras de negócio.
'use client';

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';
import { getArchivedSubjectIds } from '@/services/archivedCache';
import { localDateInDays, parseLocalDate } from '@/lib/local-date';
import * as repo from '@/services/notebook.repository';

export type { ErrorNote, NoteInput, CriticalTopic } from '@/services/notebook.repository';

export const ERROR_TYPES = [
  'Pegadinha',
  'Falta de conhecimento',
  'Erro de interpretação',
  'Desatenção',
] as const;

export async function listNotes(filters?: {
  subjectId?: string | null;
  topicId?: string | null;
  boardId?: string | null;
}): Promise<repo.ErrorNote[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  return repo.queryNotes(auth.supabase, auth.userId, filters);
}

export async function searchNotes(term: string): Promise<repo.ErrorNote[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  return repo.querySearchNotes(auth.supabase, auth.userId, term);
}

export async function getNote(id: string): Promise<repo.ErrorNote | null> {
  const { supabase, userId } = await requireUser();
  return repo.queryNote(supabase, userId, id);
}

export async function createNote(input: repo.NoteInput): Promise<repo.ErrorNote> {
  const { supabase, userId } = await requireUser();
  return repo.insertNote(supabase, userId, input);
}

export async function updateNote(id: string, input: repo.NoteInput): Promise<repo.ErrorNote> {
  const { supabase, userId } = await requireUser();
  return repo.patchNote(supabase, userId, id, input);
}

export async function deleteNote(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  return repo.removeNote(supabase, userId, id);
}

export async function listBoards(): Promise<{ id: string; name: string; color: string }[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  return repo.queryBoards(auth.supabase);
}

export async function countNotesBySubject(): Promise<Record<string, number>> {
  const auth = await tryGetUser();
  if (!auth) return {};
  const archivedIds = await getArchivedSubjectIds();
  const rows = await repo.queryNoteSubjectIds(auth.supabase, auth.userId, archivedIds);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.subject_id ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function listNotesByBoard(boardId: string): Promise<repo.ErrorNote[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  return repo.queryNotesByBoard(auth.supabase, auth.userId, boardId);
}

export async function listRecentNotes(days: number): Promise<repo.ErrorNote[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  const archivedIds = await getArchivedSubjectIds();
  // M-2: meia-noite local N dias atrás — sem drift de timezone
  const desde = parseLocalDate(localDateInDays(-days));
  return repo.queryRecentNotes(auth.supabase, auth.userId, desde.toISOString(), archivedIds);
}

interface CriticalNoteTopic {
  name: string | null;
  subject_id: string | null;
  subjects?: { name: string | null } | { name: string | null }[] | null;
}

export async function listCriticalTopics(): Promise<repo.CriticalTopic[]> {
  const auth = await tryGetUser();
  if (!auth) return [];
  const archivedIds = await getArchivedSubjectIds();

  const allNotes = await repo.queryCriticalNotes(auth.supabase, auth.userId);

  // Filtra matérias arquivadas em JS (evita type-depth errors do Supabase builder)
  const archivedSet = new Set(archivedIds);
  const notes = archivedIds.length > 0
    ? allNotes.filter((n) => {
        const topic = Array.isArray(n.topics) ? n.topics[0] : n.topics;
        return !topic?.subject_id || !archivedSet.has(topic.subject_id);
      })
    : allNotes;

  // Conta erros por tópico e coleta metadados
  const porTopico = new Map<string, { topicName: string; subjectId: string; subjectName: string; count: number }>();
  for (const n of notes) {
    if (!n.topic_id) continue;
    const topicRaw = n.topics as CriticalNoteTopic | CriticalNoteTopic[] | null;
    const topic = Array.isArray(topicRaw) ? topicRaw[0] : topicRaw;
    const subj = topic?.subjects ? (Array.isArray(topic.subjects) ? topic.subjects[0] : topic.subjects) : null;
    const cur = porTopico.get(n.topic_id) ?? {
      topicName: topic?.name ?? 'Tópico',
      subjectId: topic?.subject_id ?? '',
      subjectName: subj?.name ?? 'Matéria',
      count: 0,
    };
    cur.count += 1;
    porTopico.set(n.topic_id, cur);
  }

  const topicIds = Array.from(porTopico.keys());
  if (topicIds.length === 0) return [];

  const logs = await repo.queryTopicStudyLogs(auth.supabase, auth.userId, topicIds);

  const acertoMap: Record<string, { total: number; acertos: number }> = {};
  for (const l of logs) {
    if (!l.topic_id) continue;
    const cur = acertoMap[l.topic_id] ?? { total: 0, acertos: 0 };
    cur.total += l.questions_total ?? 0;
    cur.acertos += l.questions_correct ?? 0;
    acertoMap[l.topic_id] = cur;
  }

  const out: repo.CriticalTopic[] = topicIds.map((id) => {
    const info = porTopico.get(id)!;
    const ac = acertoMap[id];
    const acertoPct = ac && ac.total > 0 ? Math.round((ac.acertos / ac.total) * 100) : null;
    const isAlert = info.count >= 3 && acertoPct !== null && acertoPct < 50;
    return {
      topicId: id,
      topicName: info.topicName,
      subjectId: info.subjectId,
      subjectName: info.subjectName,
      errorCount: info.count,
      acertoPct,
      isAlert,
    };
  });

  out.sort((a, b) => {
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
    const aAc = a.acertoPct ?? 101;
    const bAc = b.acertoPct ?? 101;
    return aAc - bAc;
  });

  return out;
}
