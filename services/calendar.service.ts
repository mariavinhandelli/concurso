// services/calendar.service.ts
// Agrega eventos do calendário por data: revisões de tópicos, flashcards, provas
// e lembretes manuais. Lembretes carregam id (são apagáveis); o resto é derivado.

import { createClient } from '@/lib/supabase/client';
import { listReminders } from '@/services/reminders.service';

export interface CalendarEvent {
  date: string;              // 'YYYY-MM-DD'
  type: 'topic' | 'flashcard' | 'exam' | 'reminder';
  label: string;
  color: string;
  reminderId?: string;       // presente só quando type === 'reminder'
}

export async function listEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const events: CalendarEvent[] = [];

  // Revisões de tópicos agendadas no intervalo.
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('name, next_review_date, subjects(color)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .gte('next_review_date', startDate)
    .lte('next_review_date', endDate);
  if (topicsError) throw new Error('Erro ao carregar revisões do calendário: ' + topicsError.message);

  for (const t of topics ?? []) {
    if (!t.next_review_date) continue;
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    events.push({
      date: t.next_review_date,
      type: 'topic',
      label: t.name,
      color: subj?.color ?? '#22C55E',
    });
  }

  // Revisões de flashcards agendadas no intervalo (agrupadas por dia).
  const { data: cards, error: cardsError } = await supabase
    .from('flashcards')
    .select('next_review_date')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .gte('next_review_date', startDate)
    .lte('next_review_date', endDate);
  if (cardsError) throw new Error('Erro ao carregar flashcards do calendário: ' + cardsError.message);

  const cardsByDay: Record<string, number> = {};
  for (const c of cards ?? []) {
    if (!c.next_review_date) continue;
    cardsByDay[c.next_review_date] = (cardsByDay[c.next_review_date] ?? 0) + 1;
  }
  for (const [date, count] of Object.entries(cardsByDay)) {
    events.push({
      date,
      type: 'flashcard',
      label: `${count} flashcard${count > 1 ? 's' : ''}`,
      color: '#6366F1',
    });
  }

  // Provas no intervalo.
  const { data: exams, error: examsError } = await supabase
    .from('exam_targets')
    .select('name, exam_date, color')
    .eq('user_id', user.id)
    .gte('exam_date', startDate)
    .lte('exam_date', endDate);
  if (examsError) throw new Error('Erro ao carregar provas do calendário: ' + examsError.message);

  for (const e of exams ?? []) {
    if (!e.exam_date) continue;
    events.push({
      date: e.exam_date.slice(0, 10),
      type: 'exam',
      label: e.name,
      color: e.color ?? '#C2613D',
    });
  }

  // Lembretes manuais no intervalo (apagáveis — carregam o id).
  const reminders = await listReminders(startDate, endDate);
  for (const r of reminders) {
    events.push({
      date: r.date,
      type: 'reminder',
      label: r.title,
      color: '#143D45',
      reminderId: r.id,
    });
  }

  return events;
}
