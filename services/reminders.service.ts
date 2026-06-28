// services/reminders.service.ts
// CRUD de lembretes manuais do calendário (tabela reminders).

import { createClient } from '@/lib/supabase/client';

export interface Reminder {
  id: string;
  title: string;
  date: string;   // 'YYYY-MM-DD'
}

// Lista lembretes num intervalo de datas (inclusive).
export async function listReminders(startDate: string, endDate: string): Promise<Reminder[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, date')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new Error('Erro ao listar lembretes: ' + error.message);
  return data ?? [];
}

export async function createReminder(title: string, date: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('reminders').insert({
    user_id: user.id,
    title: title.trim(),
    date,
  });
  if (error) throw new Error('Erro ao criar lembrete: ' + error.message);
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Erro ao apagar lembrete: ' + error.message);
}