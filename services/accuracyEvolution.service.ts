// services/accuracyEvolution.service.ts
// Evolução da taxa de acerto ao longo do tempo (semanal), geral ou por matéria.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

export interface EvolutionPoint {
  label: string;        // rótulo da semana (ex: "12/06")
  pct: number | null;   // % de acerto naquela semana; null = semana SEM questões
  total: number;        // questões feitas na semana (para o tooltip)
}

export interface SubjectOption {
  id: string;
  name: string;
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

// Lista as matérias que REALMENTE têm sessões de questões — antes devolvia
// todas as matérias do usuário, então o seletor oferecia dezenas de opções que
// só levavam a "Sem questões registradas neste recorte" (beco sem saída).
export async function listSubjectsWithQuestions(): Promise<SubjectOption[]> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return [];

  const [{ data: logs, error: logsError }, { data: subjects, error: subjError }] = await Promise.all([
    supabase
      .from('study_logs')
      .select('subject_id')
      .eq('user_id', user.id)
      .eq('mode', 'questoes')
      .gt('questions_total', 0)
      .not('subject_id', 'is', null),
    supabase
      .from('subjects')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name', { ascending: true }),
  ]);
  if (logsError) throw new Error('Erro ao listar matérias: ' + logsError.message);
  if (subjError) throw new Error('Erro ao listar matérias: ' + subjError.message);

  const comQuestoes = new Set((logs ?? []).map((l) => l.subject_id as string));
  return (subjects ?? []).filter((s) => comQuestoes.has(s.id));
}

// Evolução semanal. subjectId null/undefined = geral (todas as matérias).
export async function getAccuracyEvolution(
  subjectId?: string | null,
): Promise<EvolutionPoint[]> {
  const supabase = createClient();
  const user = await getCachedUser();
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

  // Semana sem questões vira `null`, NÃO zero. Com 0, três semanas de teoria
  // pura desenhavam um mergulho de 78% para 0% — o usuário lia "meu desempenho
  // desabou" quando ele apenas não fez questões. O gráfico usa connectNulls
  // para ligar os pontos por cima da lacuna.
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
      pct: total === 0 ? null : Math.round((correct / total) * 100),
      total,
    });
  }

  return points;
}
