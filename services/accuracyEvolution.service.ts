// services/accuracyEvolution.service.ts
// Evolução da taxa de acerto ao longo do tempo (semanal), geral ou por matéria.

import { createClient } from '@/lib/supabase/client';

export interface EvolutionPoint {
  label: string;    // rótulo da semana (ex: "12/06")
  pct: number;      // % de acerto naquela semana
  total: number;    // questões feitas na semana (para o tooltip)
}

export interface SubjectOption {
  id: string;
  name: string;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Chave da semana a que uma data pertence (segunda-feira como início).
function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=domingo
  const diff = (day === 0 ? -6 : 1) - day; // recua até segunda
  x.setDate(x.getDate() + diff);
  return x;
}

// Lista as matérias que têm sessões de questões (para o seletor).
export async function listSubjectsWithQuestions(): Promise<SubjectOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw new Error('Erro ao listar matérias: ' + error.message);
  return data ?? [];
}

// Evolução semanal. subjectId null/undefined = geral (todas as matérias).
export async function getAccuracyEvolution(
  subjectId?: string | null,
): Promise<EvolutionPoint[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Últimas 12 semanas.
  const since = new Date();
  since.setDate(since.getDate() - 7 * 12);
  since.setHours(0, 0, 0, 0);

  let query = supabase
    .from('study_logs')
    .select('questions_total, questions_correct, started_at, subject_id')
    .eq('user_id', user.id)
    .eq('mode', 'questoes')
    .gt('questions_total', 0)
    .gte('started_at', since.toISOString());

  if (subjectId) query = query.eq('subject_id', subjectId);

  const { data: logs, error } = await query;
  if (error) throw new Error('Erro ao calcular evolução: ' + error.message);

  // Agrupa por semana: soma total e acertos.
  const byWeek = new Map<string, { total: number; correct: number }>();
  for (const log of logs ?? []) {
    const ws = localDateStr(weekStart(new Date(log.started_at)));
    const cur = byWeek.get(ws) ?? { total: 0, correct: 0 };
    cur.total += log.questions_total ?? 0;
    cur.correct += log.questions_correct ?? 0;
    byWeek.set(ws, cur);
  }

  // Monta as 12 semanas em ordem; semanas sem questões ficam de fora do cálculo
  // de % (mas mantemos o ponto com pct 0 para a linha do tempo ser contínua).
  const points: EvolutionPoint[] = [];
  const cursor = weekStart(new Date());
  for (let i = 11; i >= 0; i--) {
    const w = new Date(cursor);
    w.setDate(w.getDate() - i * 7);
    const key = localDateStr(w);
    const agg = byWeek.get(key);
    const total = agg?.total ?? 0;
    const correct = agg?.correct ?? 0;
    points.push({
      label: `${String(w.getDate()).padStart(2, '0')}/${String(w.getMonth() + 1).padStart(2, '0')}`,
      pct: total === 0 ? 0 : Math.round((correct / total) * 100),
      total,
    });
  }

  return points;
}